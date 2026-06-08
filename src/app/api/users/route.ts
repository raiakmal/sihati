import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { user } from '@/lib/db/schema';

export async function GET() {
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      unit: user.unit,
      phone: user.phone,
      createdAt: user.createdAt,
    })
    .from(user);

  return NextResponse.json(rows);
}
