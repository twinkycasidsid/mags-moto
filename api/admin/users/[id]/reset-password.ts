import { z } from 'zod';
import { requireAdmin, type AuthenticatedRequestLike } from '../../../_lib/auth';
import { handleOptions, methodNotAllowed, sendError, sendJson, type ApiResponseLike } from '../../../_lib/http';
import { supabaseAdmin } from '../../../_lib/supabase';

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

export default async function handler(req: AuthenticatedRequestLike, res: ApiResponseLike) {
  if (handleOptions(req, res, ['POST'])) {
    return;
  }

  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST']);
    return;
  }

  try {
    const actor = await requireAdmin(req);
    const schema = z.object({ password: z.string().min(6).max(72) });
    const payload = schema.parse(req.body);
    const userId = z.string().uuid().parse(req.query?.id);

    const { data: existingUser, error: existingUserError } = await supabaseAdmin
      .from('profiles')
      .select('name')
      .eq('id', userId)
      .single();

    if (existingUserError || !existingUser) {
      return sendError(res, 404, 'User not found.');
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

    sendJson(res, 200, { ok: true });
  } catch (error) {
    const status =
      error instanceof Error && error.message === 'Forbidden'
        ? 403
        : error instanceof Error && error.message === 'Unauthorized'
          ? 401
          : 400;

    sendError(res, status, error instanceof Error ? error.message : 'Request failed');
  }
}
