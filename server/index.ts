import cors from 'cors';
import express from 'express';
import { z } from 'zod';
import { serverEnv } from './env';
import { requireAdmin, type AuthenticatedRequest } from './auth';
import { supabaseAdmin } from './supabaseAdmin';
import { normalizeUsername, usernameToAuthEmail } from '../src/lib/username';
import type { Role } from '../src/types';

const app = express();

app.use(
  cors({
    origin: serverEnv.corsOrigin,
    credentials: true,
  }),
);
app.use(express.json({ limit: '2mb' }));

const baseUserSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120),
  username: z
    .string()
    .trim()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9._-]+$/),
  role: z.enum(['admin', 'cashier']),
  active: z.boolean().optional(),
});

const createUserSchema = baseUserSchema.extend({
  password: z.string().min(6).max(72),
});

const updateUserSchema = baseUserSchema.extend({
  password: z.string().min(6).max(72).optional(),
});

const rolePermissions = (role: Role) =>
  role === 'admin'
    ? {
        canVoidSales: true,
        canEditProducts: true,
        canManageInventory: true,
        canViewReports: true,
        canManageExpenses: true,
      }
    : {
        canVoidSales: false,
        canEditProducts: false,
        canManageInventory: false,
        canViewReports: false,
        canManageExpenses: false,
      };

const insertAuditLog = async (
  actorId: string,
  action: string,
  affectedRecord: string,
  details: string,
) => {
  const { error } = await supabaseAdmin.rpc('admin_insert_audit_log', {
    p_actor_id: actorId,
    p_action: action,
    p_affected_record: affectedRecord,
    p_details: details,
  });

  if (error) {
    throw error;
  }
};

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/admin/users', async (req: AuthenticatedRequest, res) => {
  try {
    await requireAdmin(req);
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, name, username, role, active, created_at, updated_at')
      .order('name');

    if (error) {
      throw error;
    }

    res.json(
      (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        username: row.username,
        role: row.role,
        active: row.active,
        permissions: rolePermissions(row.role),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    );
  } catch (error) {
    const status =
      error instanceof Error && error.message === 'Forbidden'
        ? 403
        : error instanceof Error && error.message === 'Unauthorized'
          ? 401
          : 500;

    res.status(status).json({ error: error instanceof Error ? error.message : 'Request failed' });
  }
});

app.post('/api/admin/users', async (req: AuthenticatedRequest, res) => {
  try {
    const actor = await requireAdmin(req);
    const payload = createUserSchema.parse(req.body);
    const username = normalizeUsername(payload.username);
    const email = usernameToAuthEmail(username);

    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (existingProfile) {
      return res.status(409).json({ error: 'Username already exists.' });
    }

    const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        username,
        name: payload.name,
      },
    });

    if (createError || !createdUser.user) {
      throw createError ?? new Error('Unable to create user.');
    }

    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: createdUser.user.id,
      name: payload.name,
      username,
      role: payload.role,
      active: payload.active ?? true,
      created_by: actor.id,
      updated_by: actor.id,
    });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(createdUser.user.id);
      throw profileError;
    }

    await insertAuditLog(
      actor.id,
      'User Account Created',
      payload.name,
      `Created ${payload.role.toUpperCase()} account @${username}`,
    );

    res.status(201).json({
      id: createdUser.user.id,
      name: payload.name,
      username,
      role: payload.role,
      active: payload.active ?? true,
      permissions: rolePermissions(payload.role),
    });
  } catch (error) {
    const status =
      error instanceof Error && error.message === 'Forbidden'
        ? 403
        : error instanceof Error && error.message === 'Unauthorized'
          ? 401
          : 400;

    res.status(status).json({ error: error instanceof Error ? error.message : 'Request failed' });
  }
});

app.put('/api/admin/users/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const actor = await requireAdmin(req);
    const payload = updateUserSchema.parse({ ...req.body, id: req.params.id });
    const userId = payload.id!;
    const username = normalizeUsername(payload.username);
    const email = usernameToAuthEmail(username);

    const { data: existingUser, error: existingUserError } = await supabaseAdmin
      .from('profiles')
      .select('id, name, username, role, active')
      .eq('id', userId)
      .single();

    if (existingUserError || !existingUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const { data: usernameConflict } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', username)
      .neq('id', userId)
      .maybeSingle();

    if (usernameConflict) {
      return res.status(409).json({ error: 'Username already exists.' });
    }

    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email,
      ...(payload.password ? { password: payload.password } : {}),
      user_metadata: {
        username,
        name: payload.name,
      },
    });

    if (authUpdateError) {
      throw authUpdateError;
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        name: payload.name,
        username,
        role: payload.role,
        active: payload.active ?? existingUser.active,
        updated_by: actor.id,
      })
      .eq('id', userId);

    if (profileError) {
      throw profileError;
    }

    await insertAuditLog(
      actor.id,
      'User Account Modified',
      payload.name,
      `Updated account role=${payload.role.toUpperCase()} active=${String(payload.active ?? existingUser.active)}`,
    );

    res.json({
      id: userId,
      name: payload.name,
      username,
      role: payload.role,
      active: payload.active ?? existingUser.active,
      permissions: rolePermissions(payload.role),
    });
  } catch (error) {
    const status =
      error instanceof Error && error.message === 'Forbidden'
        ? 403
        : error instanceof Error && error.message === 'Unauthorized'
          ? 401
          : 400;

    res.status(status).json({ error: error instanceof Error ? error.message : 'Request failed' });
  }
});

app.post('/api/admin/users/:id/reset-password', async (req: AuthenticatedRequest, res) => {
  try {
    const actor = await requireAdmin(req);
    const schema = z.object({ password: z.string().min(6).max(72) });
    const payload = schema.parse(req.body);
    const userId = z.string().uuid().parse(req.params.id);

    const { data: existingUser, error: existingUserError } = await supabaseAdmin
      .from('profiles')
      .select('name')
      .eq('id', userId)
      .single();

    if (existingUserError || !existingUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: payload.password,
    });

    if (error) {
      throw error;
    }

    await insertAuditLog(
      actor.id,
      'User Password Reset',
      existingUser.name,
      'Reset account password',
    );

    res.json({ ok: true });
  } catch (error) {
    const status =
      error instanceof Error && error.message === 'Forbidden'
        ? 403
        : error instanceof Error && error.message === 'Unauthorized'
          ? 401
          : 400;

    res.status(status).json({ error: error instanceof Error ? error.message : 'Request failed' });
  }
});

app.patch('/api/admin/users/:id/active', async (req: AuthenticatedRequest, res) => {
  try {
    const actor = await requireAdmin(req);
    const schema = z.object({ active: z.boolean() });
    const payload = schema.parse(req.body);
    const userId = z.string().uuid().parse(req.params.id);

    const { data: existingUser, error: existingUserError } = await supabaseAdmin
      .from('profiles')
      .select('name, active')
      .eq('id', userId)
      .single();

    if (existingUserError || !existingUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        active: payload.active,
        updated_by: actor.id,
      })
      .eq('id', userId);

    if (error) {
      throw error;
    }

    await insertAuditLog(
      actor.id,
      'User Account Status Changed',
      existingUser.name,
      payload.active ? 'Activated user account' : 'Deactivated user account',
    );

    res.json({ ok: true });
  } catch (error) {
    const status =
      error instanceof Error && error.message === 'Forbidden'
        ? 403
        : error instanceof Error && error.message === 'Unauthorized'
          ? 401
          : 400;

    res.status(status).json({ error: error instanceof Error ? error.message : 'Request failed' });
  }
});

app.delete('/api/admin/users/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const actor = await requireAdmin(req);
    const userId = z.string().uuid().parse(req.params.id);

    if (actor.id === userId) {
      return res.status(400).json({ error: 'You cannot delete your own account.' });
    }

    const { data: existingUser, error: existingUserError } = await supabaseAdmin
      .from('profiles')
      .select('name')
      .eq('id', userId)
      .single();

    if (existingUserError || !existingUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      throw deleteAuthError;
    }

    await insertAuditLog(
      actor.id,
      'User Account Deleted',
      existingUser.name,
      'Deleted user account permanently',
    );

    res.status(204).send();
  } catch (error) {
    const status =
      error instanceof Error && error.message === 'Forbidden'
        ? 403
        : error instanceof Error && error.message === 'Unauthorized'
          ? 401
          : 400;

    res.status(status).json({ error: error instanceof Error ? error.message : 'Request failed' });
  }
});

app.listen(serverEnv.port, () => {
  console.log(`Mags Moto backend listening on port ${serverEnv.port}`);
});
