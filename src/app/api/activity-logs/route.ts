import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { activityLog } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { requireSession } from '@/lib/server/require-session';

export async function GET() {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Tambahkan fallback || '' agar tipe datanya selalu string
  const role = session.user.role || '';

  if (!['ADMIN', 'TEKNISI', 'PIMPINAN'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const logs = await db.select().from(activityLog).orderBy(desc(activityLog.createdAt));
  return NextResponse.json(logs);
}
