import { NextResponse } from 'next/server';
import { desc, eq, isNull, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { activityLog, ticket } from '@/lib/db/schema';
import { requireSession } from '@/lib/server/require-session';

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = session.user.role;
  const { searchParams } = new URL(request.url);
  // ?all=true digunakan oleh ReportsView agar TEKNISI bisa melihat semua tiket untuk kalkulasi kinerja
  const fetchAll = searchParams.get('all') === 'true' && ['TEKNISI', 'ADMIN', 'PIMPINAN'].includes(role);

  let rows;

  if (fetchAll || role === 'ADMIN' || role === 'PIMPINAN') {
    // Semua tiket — untuk laporan global dan role admin/pimpinan
    rows = await db.select().from(ticket).orderBy(desc(ticket.createdAt));
  } else if (role === 'TEKNISI') {
    // Tiket milik teknisi + tiket OPEN yang belum diassign
    rows = await db
      .select()
      .from(ticket)
      .where(or(eq(ticket.assigneeId, session.user.id), isNull(ticket.assigneeId)))
      .orderBy(desc(ticket.createdAt));
  } else {
    // PEGAWAI — hanya tiket milik sendiri
    rows = await db.select().from(ticket).where(eq(ticket.reporterId, session.user.id)).orderBy(desc(ticket.createdAt));
  }

  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as {
    title?: string;
    description?: string;
    categoryId?: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    location?: string;
  };

  if (!body.title || !body.description || !body.categoryId || !body.priority || !body.location) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const now = new Date();
  const id = `t-${Date.now()}`;
  const code = `TK-${String(Date.now()).slice(-6)}`;

  const [created] = await db
    .insert(ticket)
    .values({
      id,
      code,
      title: body.title,
      description: body.description,
      priority: body.priority,
      status: 'OPEN',
      categoryId: body.categoryId,
      reporterId: session.user.id,
      location: body.location,
      slaDueAt: new Date(now.getTime() + 4 * 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await db.insert(activityLog).values({
    id: `log-${Date.now()}`,
    userId: session.user.id,
    ticketId: created.id,
    module: 'TICKET',
    action: 'CREATE_TICKET',
    description: `Membuat tiket ${created.code}.`,
    createdAt: now,
  });

  return NextResponse.json(created, { status: 201 });
}
