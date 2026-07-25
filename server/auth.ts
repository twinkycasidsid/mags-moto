import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import type { Request } from 'express';
import { serverEnv } from './env';
import { supabaseAdmin } from './supabaseAdmin';
import type { Role } from '../src/types';

const WebSocketTransport = WebSocket as unknown as typeof globalThis.WebSocket;

export interface AuthenticatedRequest extends Request {
  authUser?: {
    id: string;
    role: Role;
    name: string;
    username: string;
    active: boolean;
  };
}

const supabaseAuth = createClient(serverEnv.supabaseUrl, serverEnv.anonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  realtime: {
    transport: WebSocketTransport,
  },
});

export const getBearerToken = (req: Request) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.slice('Bearer '.length).trim();
};

export const requireAuth = async (req: AuthenticatedRequest) => {
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

export const requireAdmin = async (req: AuthenticatedRequest) => {
  const authUser = await requireAuth(req);
  if (authUser.role !== 'admin') {
    throw new Error('Forbidden');
  }

  return authUser;
};
