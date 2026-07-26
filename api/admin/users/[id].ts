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

const getUserId = (req: AuthenticatedRequestLike) => z.string().uuid().parse(req.query?.id);

const getActiveAdminCount = async () => {
  const { count, error } = await supabaseAdmin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'admin')
    .eq('active', true);

  if (error) {
    throw error;
  }

  return count ?? 0;
};

const handleUpdateUser = async (req: AuthenticatedRequestLike, res: ApiResponseLike) => {
  try {
    const actor = await requireAdmin(req);
    const userId = getUserId(req);
    const requestBody =
      req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const payload = updateUserSchema.parse({ ...requestBody, id: userId });
    const username = normalizeUsername(payload.username);
    const email = usernameToAuthEmail(username);

    const { data: existingUser, error: existingUserError } = await supabaseAdmin
      .from('profiles')
      .select('id, name, username, role, active')
      .eq('id', userId)
      .single();

    if (existingUserError || !existingUser) {
      return sendError(res, 404, 'User not found.');
    }

    const { data: usernameConflict } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', username)
      .neq('id', userId)
      .maybeSingle();

    if (usernameConflict) {
      return sendError(res, 409, 'Username already exists.');
    }

    if (
      existingUser.role === 'admin' &&
      payload.role !== 'admin' &&
      existingUser.active
    ) {
      const activeAdminCount = await getActiveAdminCount();
      if (activeAdminCount <= 1) {
        return sendError(res, 400, 'At least one active administrator account is required.');
      }
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

    sendJson(res, 200, {
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

    sendError(res, status, error instanceof Error ? error.message : 'Request failed');
  }
};

const handleDeleteUser = async (req: AuthenticatedRequestLike, res: ApiResponseLike) => {
  try {
    const actor = await requireAdmin(req);
    const userId = getUserId(req);

    if (actor.id === userId) {
      return sendError(res, 400, 'You cannot delete your own account.');
    }

    const { data: existingUser, error: existingUserError } = await supabaseAdmin
      .from('profiles')
      .select('name, role, active')
      .eq('id', userId)
      .single();

    if (existingUserError || !existingUser) {
      return sendError(res, 404, 'User not found.');
    }

    if (existingUser.role === 'admin' && existingUser.active) {
      const activeAdminCount = await getActiveAdminCount();
      if (activeAdminCount <= 1) {
        return sendError(res, 400, 'At least one active administrator account is required.');
      }
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

    sendError(res, status, error instanceof Error ? error.message : 'Request failed');
  }
};

export default async function handler(req: AuthenticatedRequestLike, res: ApiResponseLike) {
  if (handleOptions(req, res, ['PUT', 'DELETE'])) {
    return;
  }

  if (req.method === 'PUT') {
    await handleUpdateUser(req, res);
    return;
  }

  if (req.method === 'DELETE') {
    await handleDeleteUser(req, res);
    return;
  }

  methodNotAllowed(res, ['PUT', 'DELETE']);
}
