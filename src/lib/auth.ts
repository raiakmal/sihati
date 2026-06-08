import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
  },
  user: {
    additionalFields: {
      role: {
        type: ['PEGAWAI', 'TEKNISI', 'ADMIN', 'PIMPINAN'],
        required: false,
        defaultValue: 'PEGAWAI',
        input: false,
      },
      unit: {
        type: 'string',
        required: false,
        defaultValue: '',
        input: true,
      },
      phone: {
        type: 'string',
        required: false,
        defaultValue: '',
        input: true,
      },
    },
  },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  plugins: [nextCookies()],
});
