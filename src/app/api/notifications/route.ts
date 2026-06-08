import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { notification } from '@/lib/db/schema';
import { requireSession } from '@/lib/server/require-session';

export async function GET() {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rows = await db.select().from(notification).where(eq(notification.userId, session.user.id)).orderBy(desc(notification.createdAt));

  return NextResponse.json(rows);
}

export async function PATCH(request: Request) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as { id?: string; isRead?: boolean };
  if (!body.id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const [updated] = await db
    .update(notification)
    .set({ isRead: body.isRead ?? true })
    .where(eq(notification.id, body.id))
    .returning();

  return NextResponse.json(updated ?? null);
}
