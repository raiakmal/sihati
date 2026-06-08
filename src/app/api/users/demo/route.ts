import { NextResponse } from 'next/server';
import { asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { user } from '@/lib/db/schema';

// GET /api/users/demo — mengembalikan SEMUA user dari database untuk halaman login
// Endpoint PUBLIC (tidak perlu auth) — hanya mengekspos nama + email
export async function GET() {
  const users = await db.select({ id: user.id, name: user.name, email: user.email, role: user.role }).from(user).orderBy(asc(user.role), asc(user.name));

  return NextResponse.json(users.map((u) => ({ role: u.role, name: u.name, email: u.email })));
}
