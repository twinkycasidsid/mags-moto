import 'dotenv/config';
import { z } from 'zod';
import { supabaseAdmin } from '../server/supabaseAdmin';
import { normalizeUsername, usernameToAuthEmail } from '../src/lib/username';

const schema = z.object({
  username: z.string().trim().min(3).max(50),
  password: z.string().min(6).max(72),
  name: z.string().trim().min(2).max(120),
});

const args = process.argv.slice(2);

const getArg = (flag: string) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};

const run = async () => {
  const payload = schema.parse({
    username: getArg('--username'),
    password: getArg('--password'),
    name: getArg('--name'),
  });

  const username = normalizeUsername(payload.username);
  const email = usernameToAuthEmail(username);

  const { data: existingProfile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();

  if (existingProfile) {
    throw new Error(`Username "${username}" already exists.`);
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
    throw createError ?? new Error('Unable to create auth user.');
  }

  const { error: profileError } = await supabaseAdmin.from('profiles').insert({
    id: createdUser.user.id,
    name: payload.name,
    username,
    role: 'admin',
    active: true,
  });

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(createdUser.user.id);
    throw profileError;
  }

  console.log(`Created first admin account for @${username}.`);
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
