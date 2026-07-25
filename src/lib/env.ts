const required = (value: string | undefined, name: string) => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

export const env = {
  supabaseUrl: required(import.meta.env.VITE_SUPABASE_URL, 'VITE_SUPABASE_URL'),
  supabaseAnonKey: required(import.meta.env.VITE_SUPABASE_ANON_KEY, 'VITE_SUPABASE_ANON_KEY'),
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
};
