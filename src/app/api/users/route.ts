import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { user } from '@/lib/db/schema';
import { requireSession } from '@/lib/server/require-session';

export async function GET() {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (session.user.role === 'ADMIN') {
    const rows = await db.select().from(user);
    return NextResponse.json(rows);
  }

  const rows = await db.select().from(user).where(eq(user.id, session.user.id));
  return NextResponse.json(rows);
}
