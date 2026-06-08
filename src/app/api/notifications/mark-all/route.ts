import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { notification } from '@/lib/db/schema';
import { requireSession } from '@/lib/server/require-session';

// POST /api/notifications/mark-all — tandai semua notifikasi user sebagai dibaca
export async function POST() {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await db.update(notification).set({ isRead: true }).where(eq(notification.userId, session.user.id));

  return NextResponse.json({ success: true });
}
