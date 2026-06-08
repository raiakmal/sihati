import { NextResponse } from 'next/server';
import { and, desc, eq, isNull, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { activityLog, ticket } from '@/lib/db/schema';
import { requireSession } from '@/lib/server/require-session';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Wajib menggunakan await pada Next.js 15
  const resolvedParams = await params;
  const ticketId = resolvedParams.id;

  const role = session.user.role;

  // Verifikasi akses ke tiket berdasarkan role (PRD: RBAC ketat)
  let ticketRows;
  if (role === 'PEGAWAI') {
    ticketRows = await db
      .select()
      .from(ticket)
      .where(and(eq(ticket.id, ticketId), eq(ticket.reporterId, session.user.id)));
  } else if (role === 'TEKNISI') {
    ticketRows = await db
      .select()
      .from(ticket)
      .where(and(eq(ticket.id, ticketId), or(eq(ticket.assigneeId, session.user.id), isNull(ticket.assigneeId))));
  } else {
    ticketRows = await db.select().from(ticket).where(eq(ticket.id, ticketId));
  }

  if (!ticketRows[0]) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Mengembalikan audit trail sesuai PRD section 9: GET /api/tickets/:id/history
  const logs = await db.select().from(activityLog).where(eq(activityLog.ticketId, ticketId)).orderBy(desc(activityLog.createdAt));

  return NextResponse.json(logs);
}
