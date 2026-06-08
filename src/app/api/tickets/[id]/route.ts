import { NextResponse } from 'next/server';
import { and, eq, isNull, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { activityLog, ticket } from '@/lib/db/schema';
import { requireSession } from '@/lib/server/require-session';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = session.user.role;
  const id = params.id;
  let rows;

  if (role === 'PEGAWAI') {
    rows = await db
      .select()
      .from(ticket)
      .where(and(eq(ticket.id, id), eq(ticket.reporterId, session.user.id)));
  } else if (role === 'TEKNISI') {
    rows = await db
      .select()
      .from(ticket)
      .where(and(eq(ticket.id, id), or(eq(ticket.assigneeId, session.user.id), isNull(ticket.assigneeId))));
  } else {
    rows = await db.select().from(ticket).where(eq(ticket.id, id));
  }

  const item = rows[0];
  if (!item) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(item);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as {
    status?: 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'PENDING' | 'RESOLVED' | 'CLOSED' | 'REJECTED';
    assigneeId?: string | null;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    title?: string;
    description?: string;
  };

  const role = session.user.role;
  if (body.status && !['TEKNISI', 'ADMIN'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (body.assigneeId && !['TEKNISI', 'ADMIN'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const now = new Date();
  const updates: Record<string, unknown> = {
    updatedAt: now,
  };

  if (body.status) {
    updates.status = body.status;
    updates.resolvedAt = ['RESOLVED', 'CLOSED'].includes(body.status) ? now : null;
  }

  if (body.assigneeId !== undefined) {
    updates.assigneeId = body.assigneeId;
  }

  if (body.priority) {
    updates.priority = body.priority;
  }

  if (body.title) {
    updates.title = body.title;
  }

  if (body.description) {
    updates.description = body.description;
  }

  const [updated] = await db.update(ticket).set(updates).where(eq(ticket.id, params.id)).returning();

  if (!updated) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await db.insert(activityLog).values({
    id: `log-${Date.now()}`,
    userId: session.user.id,
    ticketId: updated.id,
    module: 'TICKET',
    action: 'STATUS_UPDATE',
    description: body.status ? `Mengubah status ${updated.code} menjadi ${body.status}.` : `Memperbarui tiket ${updated.code}.`,
    createdAt: now,
  });

  return NextResponse.json(updated);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [deleted] = await db.delete(ticket).where(eq(ticket.id, params.id)).returning();
  if (!deleted) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

// PUT alias untuk kompatibilitas PRD section 9 yang menggunakan PUT
export { PATCH as PUT };
