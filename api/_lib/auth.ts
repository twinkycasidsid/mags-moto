import type { Role } from '../../src/types';
import type { ApiRequestLike } from './http';
import { supabaseAdmin, supabaseAuth } from './supabase';

export interface AuthenticatedUser {
  id: string;
  role: Role;
  name: string;
  username: string;
  active: boolean;
}

export interface AuthenticatedRequestLike extends ApiRequestLike {
  authUser?: AuthenticatedUser;
}

export const getBearerToken = (req: ApiRequestLike) => {
  const authorization = req.headers.authorization;
  const authHeader = Array.isArray(authorization) ? authorization[0] : authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.slice('Bearer '.length).trim();
};

export const requireAuth = async (req: AuthenticatedRequestLike) => {
  const token = getBearerToken(req);
  if (!token) {
    throw new Error('Unauthorized');
  }

  const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
  if (userError || !userData.user) {
    throw new Error('Unauthorized');
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, role, name, username, active')
    .eq('id', userData.user.id)
    .single();

  if (profileError || !profile || !profile.active) {
    throw new Error('Unauthorized');
  }

  req.authUser = {
    id: profile.id,
    role: profile.role,
    name: profile.name,
    username: profile.username,
    active: profile.active,
  };

  return req.authUser;
};

export const requireAdmin = async (req: AuthenticatedRequestLike) => {
  const authUser = await requireAuth(req);
  if (authUser.role !== 'admin') {
    throw new Error('Forbidden');
  }

  return authUser;
};
