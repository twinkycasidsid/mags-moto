import 'dotenv/config';
import { z } from 'zod';
import { supabaseAdmin } from '../server/supabaseAdmin';
import { normalizeUsername, usernameToAuthEmail } from '../src/lib/username';
import type { Role } from '../src/types';

const schema = z.object({
  username: z.string().trim().min(3).max(50),
  password: z.string().min(6).max(72),
  name: z.string().trim().min(2).max(120),
  role: z.enum(['admin', 'cashier']),
});

const args = process.argv.slice(2);

const getArg = (flag: string) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};

const permissionsByRole = (role: Role) =>
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

const run = async () => {
  const payload = schema.parse({
    username: getArg('--username'),
    password: getArg('--password'),
    name: getArg('--name'),
    role: getArg('--role'),
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
    role: payload.role,
    active: true,
  });

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(createdUser.user.id);
    throw profileError;
  }

  console.log(
    `Created ${payload.role} account for @${username} with access: ${JSON.stringify(permissionsByRole(payload.role))}`,
  );
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
