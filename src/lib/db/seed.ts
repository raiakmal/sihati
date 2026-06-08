import { config } from 'dotenv';
config({ path: '.env.local' });
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from './index';
import { activityLog, category, comment, notification, ticket, ticketAttachment, user } from './schema';

const demoUsers = [
  {
    name: 'Rina Wulandari',
    email: 'rina@pemda.go.id',
    password: 'password123',
    role: 'PEGAWAI',
    unit: 'Dinas Kependudukan',
    phone: '0812-1100-2211',
  },
  {
    name: 'Budi Santoso',
    email: 'budi@pemda.go.id',
    password: 'password123',
    role: 'PEGAWAI',
    unit: 'Dinas Kesehatan',
  },
  {
    name: 'Andika Pratama',
    email: 'andika.it@pemda.go.id',
    password: 'password123',
    role: 'TEKNISI',
    unit: 'Tim Infrastruktur',
    phone: '0813-7777-1001',
  },
  {
    name: 'Sari Lestari',
    email: 'sari.sec@pemda.go.id',
    password: 'password123',
    role: 'TEKNISI',
    unit: 'Tim Keamanan Informasi',
  },
  {
    name: 'Maya Kartika',
    email: 'admin.sihati@pemda.go.id',
    password: 'admin123',
    role: 'ADMIN',
    unit: 'UPT Layanan TIK',
  },
  {
    name: 'Drs. Hendra Wijaya',
    email: 'kadis@pemda.go.id',
    password: 'pimpinan123',
    role: 'PIMPINAN',
    unit: 'Kepala Dinas Kominfo',
  },
] as const;

const categories = [
  {
    id: 'cat-network',
    name: 'Jaringan & MikroTik',
    description: 'Gangguan koneksi, VLAN, firewall, routing, dan perangkat jaringan.',
    ownerTeam: 'Tim Infrastruktur',
    createdAt: new Date('2026-06-05T08:00:00.000Z'),
  },
  {
    id: 'cat-cloud',
    name: 'Cloud & Server',
    description: 'Konfigurasi VM, storage, backup, sertifikat, dan layanan cloud.',
    ownerTeam: 'Tim Infrastruktur',
    createdAt: new Date('2026-06-05T08:00:00.000Z'),
  },
  {
    id: 'cat-security',
    name: 'Keamanan Informasi',
    description: 'Akun mencurigakan, akses tidak sah, hardening, dan audit insiden.',
    ownerTeam: 'Tim Keamanan Informasi',
    createdAt: new Date('2026-06-05T08:00:00.000Z'),
  },
  {
    id: 'cat-hardware',
    name: 'Hardware',
    description: 'PC, printer, scanner, UPS, dan perangkat kerja pegawai.',
    ownerTeam: 'Tim Layanan Perangkat',
    createdAt: new Date('2026-06-05T08:00:00.000Z'),
  },
  {
    id: 'cat-app',
    name: 'Aplikasi Internal',
    description: 'Aplikasi dinas, SSO, integrasi, dan kendala transaksi layanan.',
    ownerTeam: 'Tim Aplikasi',
    createdAt: new Date('2026-06-05T08:00:00.000Z'),
  },
];

async function seedUsers() {
  for (const demo of demoUsers) {
    const existing = await db.select().from(user).where(eq(user.email, demo.email));
    if (!existing.length) {
      await auth.api.signUpEmail({
        body: {
          name: demo.name,
          email: demo.email,
          password: demo.password,
        },
      });
    }
    await db
      .update(user)
      .set({
        role: demo.role,
        unit: demo.unit,
        phone: demo.phone ?? null,
      })
      .where(eq(user.email, demo.email));
  }
}

async function seedAppData() {
  await db.insert(category).values(categories).onConflictDoNothing({ target: category.id });

  const dbUsers = await db.select().from(user);
  const userByEmail = new Map(dbUsers.map((item) => [item.email, item]));

  const tickets = [
    {
      id: 't-001',
      code: 'TK-001',
      title: 'Jaringan MikroTik lantai 3 tidak stabil',
      description: 'Koneksi pegawai sering terputus sejak pagi. Aplikasi pelayanan menjadi lambat saat mengakses server internal.',
      priority: 'CRITICAL',
      status: 'IN_PROGRESS',
      categoryId: 'cat-network',
      reporterId: userByEmail.get('rina@pemda.go.id')?.id ?? '',
      assigneeId: userByEmail.get('andika.it@pemda.go.id')?.id ?? null,
      location: 'Gedung A Lt. 3',
      slaDueAt: new Date('2026-06-05T13:30:00.000Z'),
      createdAt: new Date('2026-06-05T08:40:00.000Z'),
      updatedAt: new Date('2026-06-05T10:20:00.000Z'),
    },
    {
      id: 't-002',
      code: 'TK-002',
      title: 'Error konfigurasi security group cloud',
      description: 'Aplikasi perizinan tidak dapat menerima callback dari gateway pembayaran setelah perubahan rule keamanan.',
      priority: 'HIGH',
      status: 'ASSIGNED',
      categoryId: 'cat-cloud',
      reporterId: userByEmail.get('budi@pemda.go.id')?.id ?? '',
      assigneeId: userByEmail.get('sari.sec@pemda.go.id')?.id ?? null,
      location: 'Dinas Kesehatan',
      slaDueAt: new Date('2026-06-05T15:00:00.000Z'),
      createdAt: new Date('2026-06-05T09:05:00.000Z'),
      updatedAt: new Date('2026-06-05T09:30:00.000Z'),
    },
    {
      id: 't-003',
      code: 'TK-003',
      title: 'Printer pelayanan tidak terdeteksi',
      description: 'Printer loket 2 tidak muncul di daftar perangkat setelah pergantian router ruangan.',
      priority: 'MEDIUM',
      status: 'OPEN',
      categoryId: 'cat-hardware',
      reporterId: userByEmail.get('rina@pemda.go.id')?.id ?? '',
      assigneeId: null,
      location: 'Mall Pelayanan Publik',
      slaDueAt: new Date('2026-06-06T09:00:00.000Z'),
      createdAt: new Date('2026-06-05T09:28:00.000Z'),
      updatedAt: new Date('2026-06-05T09:28:00.000Z'),
    },
    {
      id: 't-004',
      code: 'TK-004',
      title: 'Reset akses aplikasi arsip digital',
      description: 'Pegawai baru belum mendapatkan akses aplikasi arsip digital dan membutuhkan akun hari ini.',
      priority: 'LOW',
      status: 'RESOLVED',
      categoryId: 'cat-app',
      reporterId: userByEmail.get('budi@pemda.go.id')?.id ?? '',
      assigneeId: userByEmail.get('andika.it@pemda.go.id')?.id ?? null,
      location: 'Sekretariat Daerah',
      slaDueAt: new Date('2026-06-04T15:00:00.000Z'),
      createdAt: new Date('2026-06-04T10:10:00.000Z'),
      updatedAt: new Date('2026-06-04T12:00:00.000Z'),
      resolvedAt: new Date('2026-06-04T12:00:00.000Z'),
    },
    {
      id: 't-005',
      code: 'TK-005',
      title: 'Indikasi login tidak sah pada akun operator',
      description: 'Operator menerima notifikasi login dari lokasi asing. Mohon pemeriksaan audit dan rotasi kredensial.',
      priority: 'HIGH',
      status: 'PENDING',
      categoryId: 'cat-security',
      reporterId: userByEmail.get('rina@pemda.go.id')?.id ?? '',
      assigneeId: userByEmail.get('sari.sec@pemda.go.id')?.id ?? null,
      location: 'Dinas Kependudukan',
      slaDueAt: new Date('2026-06-05T14:30:00.000Z'),
      createdAt: new Date('2026-06-05T07:55:00.000Z'),
      updatedAt: new Date('2026-06-05T10:05:00.000Z'),
    },
    {
      id: 't-006',
      code: 'TK-006',
      title: 'Scanner dokumen lambat membaca berkas',
      description: 'Pemindaian dokumen kependudukan membutuhkan waktu lebih dari 2 menit per halaman.',
      priority: 'MEDIUM',
      status: 'CLOSED',
      categoryId: 'cat-hardware',
      reporterId: userByEmail.get('rina@pemda.go.id')?.id ?? '',
      assigneeId: userByEmail.get('andika.it@pemda.go.id')?.id ?? null,
      location: 'Loket Dukcapil',
      slaDueAt: new Date('2026-06-03T16:00:00.000Z'),
      createdAt: new Date('2026-06-03T11:00:00.000Z'),
      updatedAt: new Date('2026-06-03T13:45:00.000Z'),
      resolvedAt: new Date('2026-06-03T13:20:00.000Z'),
    },
  ];

  await db.insert(ticket).values(tickets).onConflictDoNothing({ target: ticket.id });

  await db
    .insert(ticketAttachment)
    .values([
      {
        id: 'a-001',
        ticketId: 't-001',
        name: 'capture-ping.png',
        url: '#',
        fileType: 'image/png',
        size: '340 KB',
        createdAt: new Date('2026-06-05T08:43:00.000Z'),
      },
      {
        id: 'a-005',
        ticketId: 't-005',
        name: 'notifikasi-login.pdf',
        url: '#',
        fileType: 'application/pdf',
        size: '190 KB',
        createdAt: new Date('2026-06-05T08:00:00.000Z'),
      },
    ])
    .onConflictDoNothing({ target: ticketAttachment.id });

  const rinaId = userByEmail.get('rina@pemda.go.id')?.id ?? '';
  const andikaId = userByEmail.get('andika.it@pemda.go.id')?.id ?? '';
  const sariId = userByEmail.get('sari.sec@pemda.go.id')?.id ?? '';

  await db
    .insert(comment)
    .values([
      {
        id: 'c-001',
        ticketId: 't-001',
        userId: rinaId,
        message: 'Gangguan masih terjadi setelah router ruangan di-restart.',
        isInternal: false,
        createdAt: new Date('2026-06-05T08:48:00.000Z'),
      },
      {
        id: 'c-002',
        ticketId: 't-001',
        userId: andikaId,
        message: 'Sedang cek log interface dan utilisasi bandwidth antar gedung.',
        isInternal: false,
        createdAt: new Date('2026-06-05T09:25:00.000Z'),
      },
      {
        id: 'c-003',
        ticketId: 't-005',
        userId: sariId,
        message: 'Internal: wajib reset MFA dan tarik audit log 24 jam terakhir.',
        isInternal: true,
        createdAt: new Date('2026-06-05T10:05:00.000Z'),
      },
    ])
    .onConflictDoNothing({ target: comment.id });

  const adminId = userByEmail.get('admin.sihati@pemda.go.id')?.id ?? '';
  const pimpinanId = userByEmail.get('kadis@pemda.go.id')?.id ?? '';

  await db
    .insert(notification)
    .values([
      {
        id: 'n-001',
        userId: andikaId,
        title: 'SLA kritikal mendekat',
        message: 'TK-001 tersisa kurang dari 3 jam.',
        isRead: false,
        createdAt: new Date('2026-06-05T10:15:00.000Z'),
      },
      {
        id: 'n-002',
        userId: adminId,
        title: 'Antrian tiket baru',
        message: '1 tiket Open belum ditugaskan.',
        isRead: false,
        createdAt: new Date('2026-06-05T09:35:00.000Z'),
      },
      {
        id: 'n-003',
        userId: pimpinanId,
        title: 'Laporan SLA harian',
        message: 'Compliance hari ini berada di 92%.',
        isRead: true,
        createdAt: new Date('2026-06-05T08:00:00.000Z'),
      },
    ])
    .onConflictDoNothing({ target: notification.id });

  await db
    .insert(activityLog)
    .values([
      {
        id: 'log-001',
        userId: rinaId,
        ticketId: 't-001',
        module: 'TICKET',
        action: 'CREATE_TICKET',
        description: 'Membuat tiket TK-001 tentang gangguan jaringan MikroTik.',
        createdAt: new Date('2026-06-05T08:40:00.000Z'),
      },
      {
        id: 'log-002',
        userId: andikaId,
        ticketId: 't-001',
        module: 'TICKET',
        action: 'STATUS_UPDATE',
        description: 'Mengubah status TK-001 menjadi Diproses.',
        createdAt: new Date('2026-06-05T10:20:00.000Z'),
      },
      {
        id: 'log-003',
        userId: sariId,
        ticketId: 't-005',
        module: 'COMMENT',
        action: 'INTERNAL_NOTE',
        description: 'Menambahkan catatan internal untuk audit keamanan TK-005.',
        createdAt: new Date('2026-06-05T10:05:00.000Z'),
      },
      {
        id: 'log-004',
        userId: adminId,
        module: 'USER',
        action: 'ROLE_REVIEW',
        description: 'Meninjau akses role teknisi dan admin pada permission matrix.',
        createdAt: new Date('2026-06-05T09:10:00.000Z'),
      },
    ])
    .onConflictDoNothing({ target: activityLog.id });
}

async function seed() {
  await seedUsers();
  await seedAppData();
}

seed()
  .then(() => {
    console.log('Seed completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seed failed', error);
    process.exit(1);
  });
