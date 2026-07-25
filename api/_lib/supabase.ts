import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { apiEnv } from './env';

const WebSocketTransport = WebSocket as unknown as typeof globalThis.WebSocket;

export const supabaseAdmin = createClient(apiEnv.supabaseUrl, apiEnv.serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  realtime: {
    transport: WebSocketTransport,
  },
});

export const supabaseAuth = createClient(apiEnv.supabaseUrl, apiEnv.anonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  realtime: {
    transport: WebSocketTransport,
  },
});
