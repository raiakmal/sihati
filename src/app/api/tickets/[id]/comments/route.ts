import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { activityLog, comment, ticket } from '@/lib/db/schema';
import { requireSession } from '@/lib/server/require-session';

// 1. Ubah tipe params menjadi Promise<{ id: string }>
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Wajib di-await untuk Next.js 15
  const resolvedParams = await params;
  const ticketId = resolvedParams.id;

  const ticketRows = await db.select().from(ticket).where(eq(ticket.id, ticketId));
  const currentTicket = ticketRows[0];
  if (!currentTicket) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (session.user.role === 'PEGAWAI' && currentTicket.reporterId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rows = await db.select().from(comment).where(eq(comment.ticketId, ticketId)).orderBy(desc(comment.createdAt));
  return NextResponse.json(rows);
}

// 3. Ubah juga tipe params pada fungsi POST
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 4. Wajib di-await untuk Next.js 15
  const resolvedParams = await params;
  const ticketId = resolvedParams.id;

  const body = (await request.json()) as { message?: string; isInternal?: boolean };
  if (!body.message) {
    return NextResponse.json({ error: 'Missing message' }, { status: 400 });
  }

  const isInternal = session.user.role === 'PEGAWAI' ? false : Boolean(body.isInternal);
  const now = new Date();
  const commentId = `c-${Date.now()}`;

  const [created] = await db
    .insert(comment)
    .values({
      id: commentId,
      ticketId: ticketId,
      userId: session.user.id,
      message: body.message,
      isInternal,
      createdAt: now,
    })
    .returning();

  await db.insert(activityLog).values({
    id: `log-${Date.now()}`,
    userId: session.user.id,
    ticketId: ticketId,
    module: 'COMMENT',
    action: isInternal ? 'INTERNAL_NOTE' : 'PUBLIC_COMMENT',
    description: isInternal ? `Catatan internal ditambahkan pada ${ticketId}.` : `Komentar publik ditambahkan pada ${ticketId}.`,
    createdAt: now,
  });

  return NextResponse.json(created, { status: 201 });
}
