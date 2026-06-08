import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { activityLog, comment, ticket } from '@/lib/db/schema';
import { requireSession } from '@/lib/server/require-session';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ticketRows = await db.select().from(ticket).where(eq(ticket.id, params.id));
  const currentTicket = ticketRows[0];
  if (!currentTicket) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (session.user.role === 'PEGAWAI' && currentTicket.reporterId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rows = await db.select().from(comment).where(eq(comment.ticketId, params.id)).orderBy(desc(comment.createdAt));
  return NextResponse.json(rows);
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as { message?: string; isInternal?: boolean };
  if (!body.message) {
    return NextResponse.json({ error: 'Missing message' }, { status: 400 });
  }

  const isInternal = session.user.role === 'PEGAWAI' ? false : Boolean(body.isInternal);
  const now = new Date();
  const id = `c-${Date.now()}`;

  const [created] = await db
    .insert(comment)
    .values({
      id,
      ticketId: params.id,
      userId: session.user.id,
      message: body.message,
      isInternal,
      createdAt: now,
    })
    .returning();

  await db.insert(activityLog).values({
    id: `log-${Date.now()}`,
    userId: session.user.id,
    ticketId: params.id,
    module: 'COMMENT',
    action: isInternal ? 'INTERNAL_NOTE' : 'PUBLIC_COMMENT',
    description: isInternal ? `Catatan internal ditambahkan pada ${params.id}.` : `Komentar publik ditambahkan pada ${params.id}.`,
    createdAt: now,
  });

  return NextResponse.json(created, { status: 201 });
}
