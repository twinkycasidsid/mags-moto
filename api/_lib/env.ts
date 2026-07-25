const required = (value: string | undefined, name: string) => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

export const apiEnv = {
  supabaseUrl: required(process.env.SUPABASE_URL, 'SUPABASE_URL'),
  serviceRoleKey: required(process.env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY'),
  anonKey:
    process.env.VITE_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    required(process.env.VITE_SUPABASE_ANON_KEY, 'VITE_SUPABASE_ANON_KEY'),
};
