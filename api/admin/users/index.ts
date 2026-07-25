import { z } from 'zod';
import type { Role } from '../../../src/types';
import { normalizeUsername, usernameToAuthEmail } from '../../../src/lib/username';
import { requireAdmin, type AuthenticatedRequestLike } from '../../_lib/auth';
import { handleOptions, methodNotAllowed, sendError, sendJson, type ApiResponseLike } from '../../_lib/http';
import { supabaseAdmin } from '../../_lib/supabase';

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

const handleListUsers = async (req: AuthenticatedRequestLike, res: ApiResponseLike) => {
  try {
    await requireAdmin(req);

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, name, username, role, active, created_at, updated_at')
      .order('name');

    if (error) {
      throw error;
    }

    sendJson(
      res,
      200,
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

    sendError(res, status, error instanceof Error ? error.message : 'Request failed');
  }
};

const handleCreateUser = async (req: AuthenticatedRequestLike, res: ApiResponseLike) => {
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
      return sendError(res, 409, 'Username already exists.');
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

    sendJson(res, 201, {
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

    sendError(res, status, error instanceof Error ? error.message : 'Request failed');
  }
};

export default async function handler(req: AuthenticatedRequestLike, res: ApiResponseLike) {
  if (handleOptions(req, res, ['GET', 'POST'])) {
    return;
  }

  if (req.method === 'GET') {
    await handleListUsers(req, res);
    return;
  }

  if (req.method === 'POST') {
    await handleCreateUser(req, res);
    return;
  }

  methodNotAllowed(res, ['GET', 'POST']);
}
