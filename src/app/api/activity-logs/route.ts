import { NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { activityLog } from '@/lib/db/schema';
import { requireSession } from '@/lib/server/require-session';

export async function GET() {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!['ADMIN', 'TEKNISI', 'PIMPINAN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rows = await db.select().from(activityLog).orderBy(desc(activityLog.createdAt));
  return NextResponse.json(rows);
}
