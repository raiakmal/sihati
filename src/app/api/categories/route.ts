import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { category } from '@/lib/db/schema';
import { requireSession } from '@/lib/server/require-session';

export async function GET() {
  const rows = await db.select().from(category);
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json()) as { name?: string; description?: string; ownerTeam?: string };
  if (!body.name || !body.description || !body.ownerTeam) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const [created] = await db
    .insert(category)
    .values({
      id: `cat-${Date.now()}`,
      name: body.name,
      description: body.description,
      ownerTeam: body.ownerTeam,
      createdAt: new Date(),
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
