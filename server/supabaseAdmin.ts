import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { serverEnv } from './env';

const WebSocketTransport = WebSocket as unknown as typeof globalThis.WebSocket;

export const supabaseAdmin = createClient(serverEnv.supabaseUrl, serverEnv.serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  realtime: {
    transport: WebSocketTransport,
  },
});
