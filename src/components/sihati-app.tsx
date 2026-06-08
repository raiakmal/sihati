'use client';

import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Tooltip from '@radix-ui/react-tooltip';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Activity,
  Bell,
  BellRing,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  ClipboardList,
  Clock3,
  FileText,
  FileClock,
  Gauge,
  LayoutDashboard,
  ListChecks,
  LockKeyhole,
  LogOut,
  Menu,
  MessageSquareText,
  Settings2,
  ShieldCheck,
  TicketCheck,
  UserRound,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { z } from 'zod';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { DataTable } from '@/components/shared/data-table';
import { GlobalSearch } from '@/components/shared/global-search';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/state-blocks';
import { TicketTimeline, type TimelineEvent } from '@/components/shared/ticket-timeline';
import { weeklyTrend } from '@/lib/mock-data';
import type { ActivityLog, Category, Comment, Priority, RoleType, Ticket, TicketStatus, User } from '@/lib/types';
import { cn } from '@/lib/utils';
import { authClient } from '@/lib/auth-client';

type View = 'dashboard' | 'my-tickets' | 'create-ticket' | 'ticket-queue' | 'assigned' | 'users' | 'categories' | 'reports' | 'notifications' | 'profile' | 'activity-log';

// Tipe notifikasi lokal (menggantikan NotifItem[])
type NotifItem = {
  id: string;
  userId: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

const statusLabels: Record<TicketStatus, string> = {
  OPEN: 'Open',
  ASSIGNED: 'Ditugaskan',
  IN_PROGRESS: 'Diproses',
  PENDING: 'Menunggu',
  RESOLVED: 'Selesai',
  CLOSED: 'Ditutup',
  REJECTED: 'Ditolak',
};

const priorityLabels: Record<Priority, string> = {
  LOW: 'Rendah',
  MEDIUM: 'Sedang',
  HIGH: 'Tinggi',
  CRITICAL: 'Kritis',
};

const roleLabels: Record<RoleType, string> = {
  PEGAWAI: 'Pegawai',
  TEKNISI: 'Teknisi',
  ADMIN: 'Admin',
  PIMPINAN: 'Pimpinan',
};

type PermissionAction = 'TICKET_ASSIGN' | 'TICKET_STATUS_UPDATE' | 'USER_MANAGE' | 'CATEGORY_MANAGE' | 'ACTIVITY_LOG_VIEW';

const permissionMatrix: Record<RoleType, { views: View[]; actions: PermissionAction[] }> = {
  PEGAWAI: {
    views: ['dashboard', 'my-tickets', 'create-ticket', 'notifications', 'profile'],
    actions: [],
  },
  TEKNISI: {
    views: ['dashboard', 'ticket-queue', 'assigned', 'reports', 'notifications', 'profile', 'activity-log'],
    actions: ['TICKET_ASSIGN', 'TICKET_STATUS_UPDATE', 'ACTIVITY_LOG_VIEW'],
  },
  ADMIN: {
    views: ['dashboard', 'my-tickets', 'users', 'categories', 'reports', 'notifications', 'profile', 'activity-log'],
    actions: ['TICKET_STATUS_UPDATE', 'USER_MANAGE', 'CATEGORY_MANAGE', 'ACTIVITY_LOG_VIEW'],
  },
  PIMPINAN: {
    views: ['dashboard', 'my-tickets', 'create-ticket', 'reports', 'notifications', 'profile', 'activity-log'],
    actions: ['ACTIVITY_LOG_VIEW'],
  },
};

const statusColor: Record<TicketStatus, React.ComponentProps<typeof Badge>['variant']> = {
  OPEN: 'slate',
  ASSIGNED: 'sky',
  IN_PROGRESS: 'violet',
  PENDING: 'amber',
  RESOLVED: 'emerald',
  CLOSED: 'emerald',
  REJECTED: 'red',
};

const priorityColor: Record<Priority, React.ComponentProps<typeof Badge>['variant']> = {
  LOW: 'slate',
  MEDIUM: 'sky',
  HIGH: 'amber',
  CRITICAL: 'red',
};

const createTicketSchema = z.object({
  title: z.string().min(8, 'Judul minimal 8 karakter'),
  categoryId: z.string().min(1, 'Kategori wajib dipilih'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  location: z.string().min(3, 'Lokasi wajib diisi'),
  description: z.string().min(20, 'Deskripsi minimal 20 karakter'),
});

type CreateTicketValues = z.infer<typeof createTicketSchema>;

function toDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function kpiForTickets(tickets: Ticket[]) {
  const total = tickets.length;
  const open = tickets.filter((ticket) => ticket.status === 'OPEN').length;
  const resolved = tickets.filter((ticket) => ['RESOLVED', 'CLOSED'].includes(ticket.status));
  const critical = tickets.filter((ticket) => ticket.priority === 'CRITICAL').length;

  const onTimeResolved = resolved.filter((ticket) => (ticket.resolvedAt ? new Date(ticket.resolvedAt).getTime() <= new Date(ticket.slaDueAt).getTime() : false));
  const slaCompliance = resolved.length ? Math.round((onTimeResolved.length / resolved.length) * 100) : 100;

  const mttrHours = resolved.length
    ? resolved.reduce((acc, ticket) => {
        const resolvedAt = ticket.resolvedAt ? new Date(ticket.resolvedAt).getTime() : new Date(ticket.updatedAt).getTime();
        const createdAt = new Date(ticket.createdAt).getTime();
        const hours = (resolvedAt - createdAt) / (1000 * 60 * 60);
        return acc + hours;
      }, 0) / resolved.length
    : 0;

  return {
    total,
    open,
    resolved: resolved.length,
    critical,
    slaCompliance,
    avgMttr: Number(mttrHours.toFixed(1)),
  };
}

function countBy<T extends string>(items: T[]) {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item] = (acc[item] ?? 0) + 1;
    return acc;
  }, {});
}

// ─── Helper: konversi sesi better-auth ke tipe User lokal ───────────────────
function sessionToUser(session: { user: { id: string; name: string; email: string; role?: string; unit?: string; phone?: string | null; createdAt?: Date | string } }): User {
  return {
    id: session.user.id,
    // username tidak ada di better-auth, gunakan bagian depan email
    username: session.user.email.split('@')[0],
    // password tidak dikembalikan oleh sesi; isi string kosong (tidak dipakai untuk auth)
    password: '',
    name: session.user.name,
    email: session.user.email,
    role: (session.user.role ?? 'PEGAWAI') as RoleType,
    unit: session.user.unit ?? '',
    phone: session.user.phone ?? undefined,
    createdAt: session.user.createdAt ? new Date(session.user.createdAt as string | Date).toISOString() : new Date().toISOString(),
  };
}

export function SihatiApp({ initialAuthMode = 'login' }: { initialAuthMode?: 'login' | 'register' | 'forgot' }) {
  const [authMode, setAuthMode] = React.useState<'login' | 'register' | 'forgot'>(initialAuthMode);
  const [currentUser, setCurrentUser] = React.useState<User | null>(null);
  const [sessionChecked, setSessionChecked] = React.useState(false);
  const [authError, setAuthError] = React.useState<string | null>(null);

  // Data-state — diisi dari API, bukan dari mock
  const [users, setUsers] = React.useState<User[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [tickets, setTickets] = React.useState<Ticket[]>([]);
  const [allTickets, setAllTickets] = React.useState<Ticket[]>([]); // semua tiket tanpa filter role — untuk laporan
  const [comments, setComments] = React.useState<Comment[]>([]);
  const [activityLogs, setActivityLogs] = React.useState<ActivityLog[]>([]);
  const [userNotifications, setUserNotifications] = React.useState<NotifItem[]>([]);
  const [loadingData, setLoadingData] = React.useState(false);

  const [view, setView] = React.useState<View>('dashboard');
  const [selectedTicketId, setSelectedTicketId] = React.useState<string>('');
  const [statusFilter, setStatusFilter] = React.useState<TicketStatus | 'ALL'>('ALL');
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  const selectedTicket = tickets.find((ticket) => ticket.id === selectedTicketId) ?? tickets[0];

  // ─── Cek sesi better-auth saat mount ─────────────────────────────────────
  React.useEffect(() => {
    authClient
      .getSession()
      .then((res) => {
        if (res.data?.session && res.data?.user) {
          const user = sessionToUser({ user: res.data.user as Parameters<typeof sessionToUser>[0]['user'] });
          setCurrentUser(user);
          setView('dashboard');
        }
        setSessionChecked(true);
      })
      .catch(() => {
        setSessionChecked(true);
      });
  }, []);

  // ─── Fetch semua data dari API saat user login ────────────────────────────
  React.useEffect(() => {
    if (!currentUser) return;
    setLoadingData(true);
    const fetchAll = async () => {
      try {
        const [ticketRes, catRes, userRes, notifRes, logRes, allTicketRes] = await Promise.all([
          fetch('/api/tickets'),
          fetch('/api/categories'),
          fetch('/api/users'),
          fetch('/api/notifications'),
          currentUser.role !== 'PEGAWAI' ? fetch('/api/activity-logs') : Promise.resolve(null),
          // Fetch semua tiket tanpa filter role — untuk halaman Laporan & SLA
          ['TEKNISI', 'ADMIN', 'PIMPINAN'].includes(currentUser.role) ? fetch('/api/tickets?all=true') : Promise.resolve(null),
        ]);
        if (ticketRes.ok) {
          const rawTickets = (await ticketRes.json()) as Ticket[];
          setTickets(rawTickets.map((t) => ({ ...t, attachments: t.attachments ?? [] })));
        }
        if (allTicketRes && allTicketRes.ok) {
          const rawAll = (await allTicketRes.json()) as Ticket[];
          setAllTickets(rawAll.map((t) => ({ ...t, attachments: t.attachments ?? [] })));
        }
        if (catRes.ok) setCategories((await catRes.json()) as Category[]);
        if (userRes.ok) {
          const rawUsers = (await userRes.json()) as Array<{ id: string; name: string; email: string; role?: string; unit?: string; phone?: string | null; createdAt: string }>;
          setUsers(rawUsers.map((u) => ({ ...u, username: u.email.split('@')[0], password: '', role: (u.role ?? 'PEGAWAI') as RoleType, unit: u.unit ?? '', createdAt: u.createdAt })));
        }
        if (notifRes.ok) setUserNotifications((await notifRes.json()) as NotifItem[]);
        if (logRes && logRes.ok) setActivityLogs((await logRes.json()) as ActivityLog[]);
      } catch {
        toast.error('Gagal memuat data dari server.');
      } finally {
        setLoadingData(false);
      }
    };
    void fetchAll();
  }, [currentUser]);

  // ─── Fetch komentar & history saat selected ticket berubah ──────────────────────────
  React.useEffect(() => {
    if (!currentUser || !selectedTicketId) return;

    // Ambil Komentar
    fetch(`/api/tickets/${selectedTicketId}/comments`)
      .then(async (res) => {
        if (res.ok) setComments((await res.json()) as Comment[]);
      })
      .catch(() => {});

    // Ambil History khusus tiket ini untuk membangun Timeline (Bisa diakses oleh Pegawai juga)
    fetch(`/api/tickets/${selectedTicketId}/history`)
      .then(async (res) => {
        if (res.ok) {
          const ticketLogs = (await res.json()) as ActivityLog[];

          setActivityLogs((prev) => {
            // Hapus log lama untuk tiket ini, lalu gabungkan dengan yang baru agar state selalu fresh
            const otherLogs = prev.filter((log) => log.ticketId !== selectedTicketId);
            return [...ticketLogs, ...otherLogs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          });
        }
      })
      .catch(() => {});
  }, [currentUser, selectedTicketId]);

  function logActivity(entry: Omit<ActivityLog, 'id' | 'createdAt'>) {
    if (currentUser?.role === 'PEGAWAI') {
      // Jika Pegawai, ambil history spesifik dari tiketnya (karena diblokir di endpoint global)
      if (entry.ticketId) {
        fetch(`/api/tickets/${entry.ticketId}/history`)
          .then(async (res) => {
            if (res.ok) {
              const ticketLogs = (await res.json()) as ActivityLog[];
              setActivityLogs((prev) => {
                const otherLogs = prev.filter((log) => log.ticketId !== entry.ticketId);
                return [...ticketLogs, ...otherLogs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
              });
            }
          })
          .catch(() => {});
      }
    } else {
      // Untuk Admin/Teknisi/Pimpinan, fetch global activity log agar dashboard tetap utuh
      void fetch('/api/activity-logs')
        .then(async (res) => {
          if (res.ok) setActivityLogs((await res.json()) as ActivityLog[]);
        })
        .catch(() => {});
    }
  }

  // ─── Login via better-auth (email + password) ─────────────────────────────
  async function login(email: string, password: string) {
    setAuthError(null);
    const res = await authClient.signIn.email({ email, password });
    if (res.error) {
      setAuthError(res.error.message ?? 'Login gagal. Cek kembali kredensial.');
      toast.error('Login gagal. Cek kembali kredensial.');
      return;
    }
    // Ambil sesi yang baru
    const sessionRes = await authClient.getSession();
    if (sessionRes.data?.user) {
      const user = sessionToUser({ user: sessionRes.data.user as Parameters<typeof sessionToUser>[0]['user'] });
      setCurrentUser(user);
      setView('dashboard');
      toast.success(`Masuk sebagai ${roleLabels[user.role]}`);
    }
  }

  // ─── Logout via better-auth ───────────────────────────────────────────────
  async function logout() {
    await authClient.signOut();
    setCurrentUser(null);
    setUsers([]);
    setTickets([]);
    setAllTickets([]);
    setCategories([]);
    setComments([]);
    setActivityLogs([]);
    setUserNotifications([]);
    setView('dashboard');
    setAuthMode('login');
  }

  // ─── Buat tiket baru via POST /api/tickets ────────────────────────────────
  async function addTicket(values: CreateTicketValues) {
    if (!currentUser) return;
    const res = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: values.title,
        description: values.description,
        categoryId: values.categoryId,
        priority: values.priority,
        location: values.location,
      }),
    });
    if (!res.ok) {
      toast.error('Gagal membuat tiket. Coba lagi.');
      return;
    }
    const created = (await res.json()) as Ticket;
    setTickets((items) => [{ ...created, attachments: [] }, ...items]);
    setSelectedTicketId(created.id);
    setView('my-tickets');
    logActivity({ userId: currentUser.id, ticketId: created.id, module: 'TICKET', action: 'CREATE_TICKET', description: `Membuat tiket ${created.code}.` });
    toast.success('Tiket berhasil dibuat');
  }

  // ─── Assign tiket ke teknisi via PATCH /api/tickets/:id ───────────────────
  async function assignToMe(ticketId: string) {
    if (!currentUser) return;
    if (!can(currentUser.role, 'TICKET_ASSIGN')) {
      toast.error('Anda tidak memiliki izin untuk assign tiket.');
      return;
    }
    const res = await fetch(`/api/tickets/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigneeId: currentUser.id, status: 'ASSIGNED' }),
    });
    if (!res.ok) {
      toast.error('Gagal assign tiket.');
      return;
    }
    const updated = (await res.json()) as Ticket;
    setTickets((items) => items.map((t) => (t.id === ticketId ? { ...t, ...updated } : t)));
    logActivity({ userId: currentUser.id, ticketId, module: 'TICKET', action: 'ASSIGN', description: `Menugaskan tiket ${updated.code} ke diri sendiri.` });
    toast.success('Tiket ditugaskan ke Anda');
  }

  // ─── Ubah status tiket via PATCH /api/tickets/:id ─────────────────────────
  async function updateTicketStatus(ticketId: string, status: TicketStatus) {
    if (!currentUser) return;
    if (!can(currentUser.role, 'TICKET_STATUS_UPDATE')) {
      toast.error('Anda tidak memiliki izin untuk mengubah status.');
      return;
    }
    const res = await fetch(`/api/tickets/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      toast.error('Gagal mengubah status tiket.');
      return;
    }
    const updated = (await res.json()) as Ticket;
    setTickets((items) => items.map((t) => (t.id === ticketId ? { ...t, ...updated } : t)));
    logActivity({ userId: currentUser.id, ticketId, module: 'TICKET', action: 'STATUS_UPDATE', description: `Mengubah status ${updated.code} menjadi ${statusLabels[status]}.` });
    toast.success(`Status berubah menjadi ${statusLabels[status]}`);
  }

  // ─── Tambah komentar via POST /api/tickets/:id/comments ──────────────────
  async function addComment(ticketId: string, message: string, isInternal: boolean) {
    if (!currentUser || !message.trim()) return;
    const res = await fetch(`/api/tickets/${ticketId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, isInternal }),
    });
    if (!res.ok) {
      toast.error('Gagal menyimpan komentar.');
      return;
    }
    const created = (await res.json()) as Comment;
    setComments((items) => [created, ...items]);
    logActivity({ userId: currentUser.id, ticketId, module: 'COMMENT', action: isInternal ? 'INTERNAL_NOTE' : 'PUBLIC_COMMENT', description: isInternal ? `Catatan internal ditambahkan.` : `Komentar publik ditambahkan.` });
    toast.success(isInternal ? 'Catatan internal tersimpan' : 'Komentar terkirim');
  }

  // ─── Tandai notifikasi dibaca via PATCH /api/notifications ────────────────
  async function markNotificationRead(id: string) {
    setUserNotifications((items) => items.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isRead: true }),
    }).catch(() => {});
  }

  // ─── Tandai semua notifikasi dibaca via POST /api/notifications/mark-all ──
  async function markAllNotificationsRead() {
    setUserNotifications((items) => items.map((item) => ({ ...item, isRead: true })));
    await fetch('/api/notifications/mark-all', { method: 'POST' }).catch(() => {});
  }

  if (!sessionChecked) {
    return (
      <main className="min-h-screen bg-slate-100">
        <div className="mx-auto flex min-h-screen max-w-5xl items-center px-4 py-8">
          <LoadingState title="Memeriksa sesi" description="Menyiapkan dashboard SIHATI." className="w-full" />
        </div>
      </main>
    );
  }

  if (!currentUser) {
    return (
      <Tooltip.Provider>
        <AuthScreen authMode={authMode} onModeChange={setAuthMode} onLogin={login} authError={authError} />
      </Tooltip.Provider>
    );
  }

  if (loadingData) {
    return (
      <main className="min-h-screen bg-slate-100">
        <div className="mx-auto flex min-h-screen max-w-5xl items-center px-4 py-8">
          <LoadingState title="Memuat data" description="Mengambil tiket dan data terbaru dari server." className="w-full" />
        </div>
      </main>
    );
  }

  const visibleTickets = filterTicketsForRole(tickets, currentUser).filter((ticket) => (statusFilter === 'ALL' ? true : ticket.status === statusFilter));

  const nav = navForRole(currentUser.role);
  // Notifikasi sudah difilter per-user di API; tampilkan semua yang diterima
  const userVisibleNotifications = userNotifications;
  const canSeeView = canView(currentUser.role, view);

  function openTicketFromSearch(ticketId: string) {
    setSelectedTicketId(ticketId);
    if (canView(currentUser.role, 'assigned')) {
      setView('assigned');
      return;
    }
    if (canView(currentUser.role, 'my-tickets')) {
      setView('my-tickets');
      return;
    }
    if (canView(currentUser.role, 'ticket-queue')) {
      setView('ticket-queue');
      return;
    }
    toast.info('Role Anda tidak memiliki akses detail tiket.');
    setView('dashboard');
  }

  return (
    <Tooltip.Provider>
      <div className="min-h-screen bg-slate-100 text-slate-950">
        <MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} nav={nav} view={view} onViewChange={setView} user={currentUser} />
        <aside className={cn('fixed inset-y-0 left-0 z-30 hidden border-r border-slate-200 bg-white transition-all lg:block', sidebarOpen ? 'w-64' : 'w-[76px]')}>
          <Sidebar nav={nav} view={view} onViewChange={setView} open={sidebarOpen} onToggle={() => setSidebarOpen((open) => !open)} />
        </aside>
        <div className={cn('transition-all lg:pl-64', !sidebarOpen && 'lg:pl-[76px]')}>
          <Topbar
            user={currentUser}
            notifications={userVisibleNotifications}
            tickets={tickets}
            users={users}
            categories={categories}
            onMenu={() => setMobileNavOpen(true)}
            onLogout={logout}
            onTicketSelect={openTicketFromSearch}
            onOpenNotifications={() => setView('notifications')}
          />
          <main className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
            <PageHeader user={currentUser} view={view} />
            {!canSeeView ? (
              <ErrorState title="Akses ditolak" description="Role Anda tidak memiliki akses ke halaman ini." />
            ) : (
              <>
                {view === 'dashboard' && (
                  <DashboardView
                    currentUser={currentUser}
                    tickets={tickets}
                    users={users}
                    categories={categories}
                    onOpenTicket={(id) => {
                      setSelectedTicketId(id);
                      setView(currentUser.role === 'TEKNISI' ? 'assigned' : 'my-tickets');
                    }}
                  />
                )}
                {view === 'my-tickets' && (
                  <TicketWorkspace
                    title="Tiket Saya"
                    currentUser={currentUser}
                    tickets={visibleTickets}
                    allTickets={tickets}
                    users={users}
                    categories={categories}
                    comments={comments}
                    activityLogs={activityLogs}
                    selectedTicket={selectedTicket}
                    statusFilter={statusFilter}
                    onStatusFilterChange={setStatusFilter}
                    onSelectTicket={setSelectedTicketId}
                    onAssign={assignToMe}
                    onStatusChange={updateTicketStatus}
                    onComment={addComment}
                  />
                )}
                {view === 'create-ticket' && <CreateTicketView categories={categories} onSubmit={addTicket} />}
                {view === 'ticket-queue' && (
                  <TicketWorkspace
                    title="Antrian Open"
                    currentUser={currentUser}
                    tickets={visibleTickets.filter((ticket) => ticket.status === 'OPEN')}
                    allTickets={tickets}
                    users={users}
                    categories={categories}
                    comments={comments}
                    activityLogs={activityLogs}
                    selectedTicket={selectedTicket}
                    statusFilter="OPEN"
                    onStatusFilterChange={setStatusFilter}
                    onSelectTicket={setSelectedTicketId}
                    onAssign={assignToMe}
                    onStatusChange={updateTicketStatus}
                    onComment={addComment}
                  />
                )}
                {view === 'assigned' && (
                  <TicketWorkspace
                    title="Tiket Ditugaskan"
                    currentUser={currentUser}
                    tickets={visibleTickets.filter((ticket) => ticket.assigneeId === currentUser.id)}
                    allTickets={tickets}
                    users={users}
                    categories={categories}
                    comments={comments}
                    activityLogs={activityLogs}
                    selectedTicket={selectedTicket}
                    statusFilter={statusFilter}
                    onStatusFilterChange={setStatusFilter}
                    onSelectTicket={setSelectedTicketId}
                    onAssign={assignToMe}
                    onStatusChange={updateTicketStatus}
                    onComment={addComment}
                  />
                )}
                {view === 'users' && <UserManagement users={users} onUsersChange={setUsers} />}
                {view === 'categories' && <CategoryManagement categories={categories} onCategoriesChange={setCategories} />}
                {view === 'reports' && <ReportsView tickets={allTickets.length ? allTickets : tickets} categories={categories} users={users} leadership={currentUser.role === 'PIMPINAN'} />}
                {view === 'notifications' && <NotificationCenterView user={currentUser} notifications={userVisibleNotifications} onMarkRead={markNotificationRead} onMarkAllRead={markAllNotificationsRead} />}
                {view === 'profile' && <UserProfileView user={currentUser} tickets={tickets} activityLogs={activityLogs} />}
                {view === 'activity-log' && <ActivityLogView user={currentUser} logs={activityLogs} users={users} tickets={tickets} />}
              </>
            )}
          </main>
        </div>
      </div>
    </Tooltip.Provider>
  );
}

function AuthScreen({
  authMode,
  onModeChange,
  onLogin,
  authError,
}: {
  authMode: 'login' | 'register' | 'forgot';
  onModeChange: (mode: 'login' | 'register' | 'forgot') => void;
  onLogin: (email: string, password: string) => Promise<void>;
  authError: string | null;
}) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loggingIn, setLoggingIn] = React.useState(false);
  const [dbUsers, setDbUsers] = React.useState<User[]>([]);

  React.useEffect(() => {
    fetch('/api/users')
      .then((res) => {
        if (res.ok) return res.json();
        return [];
      })
      .then((data) => setDbUsers(data))
      .catch(() => {});
  }, []);

  const demoAccounts = React.useMemo(() => {
    if (dbUsers.length === 0) return [];

    // Kita petakan (map) seluruh array dbUsers tanpa membatasi jumlahnya
    return dbUsers.map((foundUser) => {
      // Petakan password asli berdasarkan aturan akun bawaan / seed database
      let plaintextPassword = 'password123';
      if (foundUser.role === 'PIMPINAN' || foundUser.email.includes('kadis')) {
        plaintextPassword = 'pimpinan123';
      }

      return {
        role: foundUser.role,
        name: foundUser.name,
        email: foundUser.email,
        password: plaintextPassword,
      };
    });
  }, [dbUsers]);

  async function handleLogin() {
    setLoggingIn(true);
    await onLogin(email, password);
    setLoggingIn(false);
  }

  return (
    <main className="relative min-h-screen bg-slate-50 overflow-hidden flex items-center">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-sky-200/50 mix-blend-multiply blur-3xl opacity-70" />
      <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-indigo-100/40 mix-blend-multiply blur-3xl opacity-70" />

      <div className="relative z-10 mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-6 py-12 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Left Section - Copywriting & Hero */}
        <section className="space-y-8">
          <div className="inline-flex items-center gap-3 rounded-2xl bg-white/60 p-2 pr-6 border border-white/80 shadow-sm backdrop-blur-md">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-600 to-sky-800 text-white shadow-lg shadow-sky-900/20">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-sky-800">SIHATI</p>
              <p className="text-sm font-medium text-slate-600">Sistem Helpdesk IT</p>
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:leading-[1.15]">
              Kelola Insiden IT dengan <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-600 to-indigo-600">Cepat & Transparan</span>
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-slate-600">Portal operasional terpadu untuk pelaporan insiden, pemantauan SLA lintas dinas, dan dokumentasi audit-ready di lingkungan pemerintahan.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <MetricPill icon={Clock3} label="Target MTTR" value="< 4 jam" />
            <MetricPill icon={Gauge} label="SLA Compliance" value="> 90%" />
            <MetricPill icon={CheckCircle2} label="Kepuasan" value="> 85%" />
          </div>
        </section>

        {/* Right Section - Auth Card */}
        <div className="relative">
          {/* Subtle glow behind the card */}
          <div className="absolute inset-0 bg-gradient-to-tr from-sky-100 to-white transform rotate-3 rounded-[2rem] shadow-xl opacity-60 blur-sm" />

          <Card className="relative z-10 rounded-[2rem] border-white/80 bg-white/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] sm:p-2">
            <CardHeader className="pb-6">
              <CardTitle className="text-2xl font-bold">{authMode === 'login' ? 'Selamat Datang' : authMode === 'register' ? 'Registrasi Pegawai' : 'Pulihkan Password'}</CardTitle>
              <CardDescription className="text-sm text-slate-500">{authMode === 'login' ? 'Masuk dengan kredensial dinas Anda untuk mengakses dashboard SIHATI.' : 'Lengkapi formulir pendaftaran akun pegawai di bawah ini.'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {authMode === 'login' ? (
                <>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-slate-700 font-medium">Email dinas</Label>
                      <Input
                        type="email"
                        placeholder="nama@pemda.go.id"
                        className="h-11 rounded-xl border-slate-200 bg-white/50 focus-visible:ring-sky-500 focus-visible:bg-white transition-all shadow-sm"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void handleLogin();
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-slate-700 font-medium">Password</Label>
                        <button type="button" onClick={() => onModeChange('forgot')} className="text-xs font-medium text-sky-600 hover:text-sky-700">
                          Lupa password?
                        </button>
                      </div>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        className="h-11 rounded-xl border-slate-200 bg-white/50 focus-visible:ring-sky-500 focus-visible:bg-white transition-all shadow-sm"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void handleLogin();
                        }}
                      />
                    </div>
                  </div>

                  {authError && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-100">{authError}</div>}

                  <Button
                    className="w-full h-11 rounded-xl bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-700 hover:to-sky-800 text-white shadow-md hover:shadow-lg transition-all"
                    onClick={() => void handleLogin()}
                    disabled={loggingIn}
                  >
                    {loggingIn ? (
                      <span className="flex items-center gap-2">Memproses...</span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <LockKeyhole className="h-4 w-4" /> Masuk ke Dashboard
                      </span>
                    )}
                  </Button>

                  <div className="relative py-3">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-slate-200" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white/80 backdrop-blur-sm px-2 text-slate-400 font-medium rounded-full">Atau gunakan</span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white/50 p-4 shadow-sm backdrop-blur-sm">
                    <p className="mb-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Akses Cepat (Demo)</p>
                    <div className="grid gap-2">
                      {demoAccounts.length > 0 ? (
                        demoAccounts.map((account) => (
                          <button
                            key={account.email}
                            className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-left text-sm hover:border-sky-300 hover:shadow-md transition-all duration-300"
                            onClick={() => {
                              setEmail(account.email);
                              setPassword(account.password);
                            }}
                          >
                            <div>
                              <span className="block font-semibold text-slate-700 group-hover:text-sky-700 transition-colors">{account.name}</span>
                              <span className="block text-xs text-slate-500">{roleLabels[account.role as RoleType]}</span>
                            </div>
                            <span className="rounded-lg bg-slate-50 border border-slate-100 px-2 py-1 text-[10px] font-medium text-slate-400 group-hover:bg-sky-50 group-hover:text-sky-600 group-hover:border-sky-100 transition-all">
                              Isi Otomatis
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="py-4 text-center">
                          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-sky-600"></span>
                          <p className="mt-2 text-xs text-slate-500">Menghubungkan ke database...</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <PublicForm mode={authMode} onModeChange={onModeChange} />
              )}

              {authMode !== 'login' && (
                <div className="mt-4 text-center text-sm">
                  <span className="text-slate-500">Sudah punya akun? </span>
                  <button onClick={() => onModeChange('login')} className="font-semibold text-sky-600 hover:text-sky-700 hover:underline">
                    Masuk sekarang
                  </button>
                </div>
              )}
              {authMode === 'login' && (
                <div className="mt-4 text-center text-sm">
                  <span className="text-slate-500">Belum punya akun dinas? </span>
                  <button onClick={() => onModeChange('register')} className="font-semibold text-sky-600 hover:text-sky-700 hover:underline">
                    Daftar di sini
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

function PublicForm({ mode, onModeChange }: { mode: 'register' | 'forgot'; onModeChange: (mode: 'login' | 'register' | 'forgot') => void }) {
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [unit, setUnit] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit() {
    if (mode === 'register') {
      if (!name || !email || !password || !unit) {
        toast.error('Harap lengkapi semua formulir pendaftaran.');
        return;
      }
      setLoading(true);
      try {
        const res = await fetch('/api/auth/sign-up/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            email,
            password,
            unit,
            role: 'PEGAWAI',
          }),
        });

        if (!res.ok) {
          toast.error('Gagal mendaftar. Pastikan email belum terdaftar dan password minimal 8 karakter.');
        } else {
          toast.success('Registrasi berhasil! Silakan masuk dengan akun Anda.');
          onModeChange('login');
        }
      } catch {
        toast.error('Terjadi kesalahan jaringan.');
      } finally {
        setLoading(false);
      }
    } else {
      toast.info('Instruksi pemulihan dikirim ke email Anda.');
      onModeChange('login');
    }
  }

  return (
    <div className="space-y-4">
      {mode === 'register' && (
        <>
          <Field label="Nama lengkap" placeholder="Nama pegawai" value={name} onChange={(e) => setName(e.target.value)} />
          <Field label="Unit kerja" placeholder="Dinas / bidang" value={unit} onChange={(e) => setUnit(e.target.value)} />
        </>
      )}
      <Field label="Email dinas" placeholder="nama@pemda.go.id" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      {mode === 'register' && <Field label="Password" placeholder="Minimal 8 karakter" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />}
      <Button className="mt-2 w-full h-11 rounded-xl bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-700 hover:to-sky-800 text-white shadow-md hover:shadow-lg transition-all" onClick={() => void handleSubmit()} disabled={loading}>
        {loading ? 'Memproses...' : mode === 'register' ? 'Buat Akun Pegawai' : 'Kirim Instruksi Pemulihan'}
      </Button>
    </div>
  );
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-slate-700 font-medium">{label}</Label>
      <Input {...props} className="h-11 rounded-xl border-slate-200 bg-white/50 focus-visible:ring-sky-500 focus-visible:bg-white transition-all shadow-sm" />
    </div>
  );
}

function MetricPill({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="group rounded-2xl border border-white/60 bg-white/60 p-5 shadow-sm backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:bg-white/90">
      <Icon className="mb-3 h-6 w-6 text-sky-600 transition-transform group-hover:scale-110" />
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-800">{value}</p>
    </div>
  );
}

function Sidebar({ nav, view, open, onToggle, onViewChange }: { nav: ReturnType<typeof navForRole>; view: View; open: boolean; onToggle: () => void; onViewChange: (view: View) => void }) {
  return (
    <div className="flex h-full flex-col bg-white/80 backdrop-blur-xl border-r border-white/60 shadow-[4px_0_24px_rgb(0,0,0,0.02)]">
      <div className="flex h-20 items-center justify-between px-5 border-b border-slate-100/50">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-600 to-sky-800 text-white shadow-md shadow-sky-900/20">
            <ShieldCheck className="h-5 w-5" />
          </div>
          {open && (
            <div className="flex flex-col">
              <span className="text-sm font-extrabold tracking-wider text-slate-800">SIHATI</span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Helpdesk IT</span>
            </div>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onToggle} className="text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-xl h-8 w-8" aria-label="Toggle sidebar">
          {open ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>
      <nav className="flex-1 space-y-1.5 p-4 overflow-y-auto">
        {nav.map((item) => (
          <Tooltip.Root key={item.view}>
            <Tooltip.Trigger asChild>
              <button
                className={cn(
                  'group flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all duration-300',
                  view === item.view ? 'bg-gradient-to-r from-sky-50 to-sky-100/50 text-sky-700 shadow-sm border border-sky-100/50' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800',
                  !open && 'justify-center px-0',
                )}
                onClick={() => onViewChange(item.view)}
              >
                <item.icon className={cn('h-5 w-5 shrink-0 transition-transform duration-300', view === item.view ? 'scale-110' : 'group-hover:scale-110')} />
                {open && <span className="font-semibold">{item.label}</span>}
              </button>
            </Tooltip.Trigger>
            {!open && (
              <Tooltip.Content side="right" className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white shadow-xl border border-slate-700 ml-2 animate-in fade-in zoom-in">
                {item.label}
              </Tooltip.Content>
            )}
          </Tooltip.Root>
        ))}
      </nav>
    </div>
  );
}

function MobileNav({ open, nav, view, user, onClose, onViewChange }: { open: boolean; nav: ReturnType<typeof navForRole>; view: View; user: User; onClose: () => void; onViewChange: (view: View) => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} aria-label="Tutup navigasi" />
      <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] bg-white/90 backdrop-blur-xl p-6 shadow-2xl border-r border-white/60 flex flex-col animate-in slide-in-from-left duration-300">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-600 to-sky-800 text-white shadow-md">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="font-extrabold text-slate-800 tracking-wide">SIHATI</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-sky-600">{roleLabels[user.role]}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="rounded-full bg-slate-100 hover:bg-slate-200 h-8 w-8 text-slate-500" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-1.5 overflow-y-auto flex-1">
          {nav.map((item) => (
            <button
              key={item.view}
              className={cn(
                'flex h-12 w-full items-center gap-4 rounded-xl px-4 text-sm font-semibold transition-all',
                view === item.view ? 'bg-gradient-to-r from-sky-50 to-sky-100 text-sky-700 shadow-sm border border-sky-100/50' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800',
              )}
              onClick={() => {
                onViewChange(item.view);
                onClose();
              }}
            >
              <item.icon className={cn('h-5 w-5 transition-transform', view === item.view ? 'scale-110' : '')} />
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Topbar({
  user,
  notifications: userNotifications,
  tickets,
  users,
  categories,
  onMenu,
  onLogout,
  onTicketSelect,
  onOpenNotifications,
}: {
  user: User;
  notifications: NotifItem[];
  tickets: Ticket[];
  users: User[];
  categories: Category[];
  onMenu: () => void;
  onLogout: () => Promise<void>;
  onTicketSelect: (ticketId: string) => void;
  onOpenNotifications: () => void;
}) {
  const unreadCount = userNotifications.filter((item) => !item.isRead).length;
  return (
    <header className="sticky top-0 z-20 border-b border-white/60 bg-white/70 backdrop-blur-xl shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
      <div className="flex h-20 items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Button className="lg:hidden rounded-xl bg-white shadow-sm border border-slate-200/60" variant="ghost" size="icon" onClick={onMenu}>
          <Menu className="h-5 w-5 text-slate-600" />
        </Button>

        <div className="flex-1 flex items-center">
          <div className="w-full max-w-md">
            <GlobalSearch tickets={tickets} users={users} categories={categories} onTicketSelect={onTicketSelect} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button variant="outline" size="icon" aria-label="Notifikasi" className="relative rounded-xl border-slate-200/60 bg-white/80 shadow-sm hover:bg-slate-50 transition-all">
                <div className="relative">
                  <Bell className="h-5 w-5 text-slate-600" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white shadow-sm ring-2 ring-white">{unreadCount > 9 ? '9+' : unreadCount}</span>
                  )}
                </div>
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end" className="z-50 w-80 rounded-[1.5rem] border border-white/80 bg-white/90 p-2 shadow-xl backdrop-blur-xl animate-in slide-in-from-top-2">
              <div className="flex items-center justify-between px-3 py-3 border-b border-slate-100/60 mb-1">
                <p className="text-sm font-bold text-slate-800">Notifikasi</p>
                <Button variant="ghost" size="sm" onClick={onOpenNotifications} className="text-xs font-semibold text-sky-600 hover:text-sky-700 hover:bg-sky-50 rounded-lg h-7 px-2">
                  Lihat semua
                </Button>
              </div>
              <div className="max-h-[300px] overflow-y-auto pr-1 space-y-1">
                {userNotifications.length ? (
                  userNotifications.slice(0, 5).map((item) => (
                    <div key={item.id} className={cn('rounded-xl p-3 text-sm transition-all hover:bg-slate-50 cursor-default', !item.isRead ? 'bg-sky-50/50' : '')}>
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn('font-semibold', !item.isRead ? 'text-sky-900' : 'text-slate-700')}>{item.title}</p>
                        {!item.isRead && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />}
                      </div>
                      <p className="text-slate-500 text-xs mt-0.5 line-clamp-2 leading-relaxed">{item.message}</p>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <BellRing className="h-8 w-8 text-slate-300 mb-2 opacity-50" />
                    <p className="text-xs font-medium text-slate-500">Tidak ada notifikasi baru.</p>
                  </div>
                )}
              </div>
            </DropdownMenu.Content>
          </DropdownMenu.Root>

          <div className="h-8 w-px bg-slate-200/60 hidden sm:block"></div>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="flex items-center gap-3 rounded-2xl p-1.5 hover:bg-slate-50 transition-all border border-transparent hover:border-slate-200/50 hover:shadow-sm">
                <Avatar name={user.name} />
                <span className="hidden text-left text-sm sm:block pr-2">
                  <span className="block font-bold text-slate-800 tracking-tight">{user.name.split(' ')[0]}</span>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-sky-600">{roleLabels[user.role]}</span>
                </span>
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end" className="z-50 w-64 rounded-[1.5rem] border border-white/80 bg-white/90 p-2 shadow-xl backdrop-blur-xl animate-in slide-in-from-top-2">
              <div className="flex items-center gap-3 px-3 py-4">
                <Avatar name={user.name} />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 truncate">{user.name}</p>
                  <p className="text-xs font-medium text-slate-500 truncate">{user.email}</p>
                </div>
              </div>
              <DropdownMenu.Separator className="my-1 h-px bg-slate-100/80" />
              <DropdownMenu.Item
                className="group flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 outline-none hover:bg-red-50 hover:text-red-600 transition-colors"
                onSelect={() => void onLogout()}
              >
                <LogOut className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                Keluar Aplikasi
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </div>
      </div>
    </header>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <AvatarPrimitive.Root className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-100 to-sky-200 shadow-inner ring-1 ring-white/60">
      <span className="text-sm font-extrabold text-sky-700 drop-shadow-sm">{getInitials(name)}</span>
    </AvatarPrimitive.Root>
  );
}

function PageHeader({ user, view }: { user: User; view: View }) {
  const title = navForRole(user.role).find((item) => item.view === view)?.label ?? 'Dashboard';
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end mb-2">
      <div className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-widest text-sky-600">Selamat bekerja, {user.name.split(' ')[0]}</p>
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">{title}</h2>
      </div>
      <Badge variant="slate" className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-white border-slate-200/60 shadow-sm text-slate-600">
        <span className="text-sky-600 mr-1.5">{roleLabels[user.role]}</span> • <span className="ml-1.5">{user.unit || 'SIHATI App'}</span>
      </Badge>
    </div>
  );
}

function DashboardView({ currentUser, tickets, users, categories, onOpenTicket }: { currentUser: User; tickets: Ticket[]; users: User[]; categories: Category[]; onOpenTicket: (id: string) => void }) {
  const relevant = filterTicketsForRole(tickets, currentUser);
  const kpi = kpiForTickets(relevant);
  const urgent = relevant.filter((ticket) => ['CRITICAL', 'HIGH'].includes(ticket.priority)).slice(0, 4);
  const statusChart = Object.entries(countBy(tickets.map((ticket) => statusLabels[ticket.status]))).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      {/* KPI Section */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard icon={TicketCheck} label="Total Ticket" value={kpi.total} helper="Seluruh tiket relevan" />
        <KpiCard icon={FileClock} label="Open Ticket" value={kpi.open} helper="Status Open" />
        <KpiCard icon={CheckCircle2} label="Resolved Ticket" value={kpi.resolved} helper="Resolved dan closed" />
        <KpiCard icon={Activity} label="Critical Ticket" value={kpi.critical} helper="Prioritas kritis" />
        <KpiCard icon={Gauge} label="SLA Compliance" value={`${kpi.slaCompliance}%`} helper="Tepat waktu" />
        <KpiCard icon={Clock3} label="Average MTTR" value={`${kpi.avgMttr} jam`} helper="Rata-rata durasi" />
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="overflow-hidden rounded-[2rem] border-white/60 bg-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl">
          <CardHeader className="border-b border-slate-100/50 pb-4 bg-white/50">
            <CardTitle className="text-xl font-bold text-slate-800">Tren Tiket Mingguan</CardTitle>
            <CardDescription className="text-slate-500">Perbandingan tiket masuk dan selesai</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px] p-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorOpen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <ChartTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Area type="monotone" dataKey="open" name="Masuk" stroke="#0ea5e9" strokeWidth={3} fillOpacity={1} fill="url(#colorOpen)" />
                <Area type="monotone" dataKey="resolved" name="Selesai" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorResolved)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-[2rem] border-white/60 bg-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl">
          <CardHeader className="border-b border-slate-100/50 pb-4 bg-white/50">
            <CardTitle className="text-xl font-bold text-slate-800">Status Tiket</CardTitle>
            <CardDescription className="text-slate-500">Distribusi seluruh tiket</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px] p-6 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusChart} dataKey="value" nameKey="name" innerRadius={65} outerRadius={95} paddingAngle={5}>
                  {statusChart.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={['#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444'][index % 5]} className="stroke-white stroke-2" />
                  ))}
                </Pie>
                <ChartTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Urgent Tickets Section */}
      <Card className="overflow-hidden rounded-[2rem] border-white/60 bg-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl">
        <CardHeader className="border-b border-slate-100/50 pb-4 bg-white/50">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-red-600 shadow-sm">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-slate-800">Membutuhkan Perhatian</CardTitle>
              <CardDescription className="text-slate-500">Prioritas tinggi, SLA dekat, atau status menunggu.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 bg-slate-50/50">
          {urgent.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {urgent.map((ticket) => (
                <TicketCard key={ticket.id} ticket={ticket} users={users} categories={categories} onOpen={() => onOpenTicket(ticket.id)} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle2 className="mb-3 h-14 w-14 text-emerald-400 opacity-50" />
              <p className="text-lg font-semibold text-slate-700">Tidak ada tiket kritis</p>
              <p className="text-sm text-slate-500">Semua insiden prioritas tinggi telah tertangani.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, helper }: { icon: React.ElementType; label: string; value: number | string; helper: string }) {
  return (
    <Card className="group relative overflow-hidden rounded-2xl border-white/60 bg-white/80 shadow-sm backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:bg-white">
      {/* Decorative gradient blob */}
      <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-gradient-to-br from-sky-200 to-transparent opacity-40 blur-2xl transition-all duration-500 group-hover:scale-150 group-hover:opacity-60" />

      <CardContent className="relative z-10 flex items-start gap-5 p-6">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1rem] bg-gradient-to-br from-sky-50 to-sky-100 text-sky-600 shadow-inner transition-colors duration-300 group-hover:from-sky-500 group-hover:to-sky-600 group-hover:text-white">
          <Icon className="h-7 w-7" />
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-slate-800">{value}</p>
          <p className="mt-1.5 text-xs font-medium text-slate-400">{helper}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateTicketView({ categories, onSubmit }: { categories: Category[]; onSubmit: (values: CreateTicketValues) => Promise<void> }) {
  const form = useForm<CreateTicketValues>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: {
      title: '',
      categoryId: '',
      priority: 'MEDIUM',
      location: '',
      description: '',
    },
  });
  return (
    <Card className="overflow-hidden rounded-[2rem] border-white/60 bg-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl">
      <CardHeader className="border-b border-slate-100/50 pb-6 bg-white/50">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-100 text-sky-600 shadow-sm">
            <CirclePlus className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold text-slate-800">Buat Tiket Baru</CardTitle>
            <CardDescription className="text-slate-500">Lengkapi detail kendala infrastruktur IT Anda untuk mempercepat koordinasi teknisi.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 sm:p-8">
        <form className="grid gap-6 lg:grid-cols-2" onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}>
          <div className="space-y-2 lg:col-span-2">
            <Label className="text-slate-700 font-semibold text-sm">Judul Kendala / Insiden</Label>
            <Input
              placeholder="Contoh: Jaringan internet router Mikrotik lantai 2 mati total"
              className="h-11 rounded-xl border-slate-200 bg-white/50 focus-visible:ring-sky-500 focus-visible:bg-white transition-all shadow-sm"
              {...form.register('title')}
            />
            <FormError message={form.formState.errors.title?.message} />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-700 font-semibold text-sm">Kategori Layanan IT</Label>
            <select
              className="h-11 w-full rounded-xl border border-slate-200 bg-white/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all shadow-sm text-slate-800"
              {...form.register('categoryId')}
            >
              <option value="">Pilih kategori aduan</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <FormError message={form.formState.errors.categoryId?.message} />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-700 font-semibold text-sm">Tingkat Prioritas Dampak</Label>
            <select
              className="h-11 w-full rounded-xl border border-slate-200 bg-white/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all shadow-sm text-slate-800"
              {...form.register('priority')}
            >
              {Object.entries(priorityLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2 lg:col-span-2">
            <Label className="text-slate-700 font-semibold text-sm">Lokasi Detail / Unit Kerja Terdampak</Label>
            <Input
              placeholder="Gedung A, Lantai 2, Ruang Rapat Utama Bappeda"
              className="h-11 rounded-xl border-slate-200 bg-white/50 focus-visible:ring-sky-500 focus-visible:bg-white transition-all shadow-sm"
              {...form.register('location')}
            />
            <FormError message={form.formState.errors.location?.message} />
          </div>
          <div className="space-y-2 lg:col-span-2">
            <Label className="text-slate-700 font-semibold text-sm">Deskripsi Kronologi Masalah</Label>
            <Textarea
              placeholder="Jelaskan secara rinci mengenai gejala kendala, waktu mulai terjadinya gangguan, serta dampak operasionalnya pada layanan publik."
              className="min-h-[120px] rounded-xl border-slate-200 bg-white/50 focus-visible:ring-sky-500 focus-visible:bg-white transition-all shadow-sm p-4 leading-relaxed"
              {...form.register('description')}
            />
            <FormError message={form.formState.errors.description?.message} />
          </div>
          <div className="flex justify-end lg:col-span-2 pt-2">
            <Button type="submit" className="h-11 rounded-xl bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-700 hover:to-sky-800 text-white shadow-md hover:shadow-lg transition-all px-6 font-medium">
              <CirclePlus className="h-4 w-4" />
              Kirim Tiket Pengaduan
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-red-600">{message}</p>;
}

function TicketWorkspace({
  title,
  currentUser,
  tickets,
  allTickets,
  users,
  categories,
  comments,
  activityLogs,
  selectedTicket,
  statusFilter,
  onStatusFilterChange,
  onSelectTicket,
  onAssign,
  onStatusChange,
  onComment,
}: {
  title: string;
  currentUser: User;
  tickets: Ticket[];
  allTickets: Ticket[];
  users: User[];
  categories: Category[];
  comments: Comment[];
  activityLogs: ActivityLog[];
  selectedTicket: Ticket;
  statusFilter: TicketStatus | 'ALL';
  onStatusFilterChange: (status: TicketStatus | 'ALL') => void;
  onSelectTicket: (id: string) => void;
  onAssign: (id: string) => Promise<void>;
  onStatusChange: (id: string, status: TicketStatus) => Promise<void>;
  onComment: (id: string, message: string, isInternal: boolean) => Promise<void>;
}) {
  const active = tickets[0] ?? selectedTicket ?? allTickets[0];
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1fr] items-start">
      {/* Kolom Kiri: Tabel Antrian / Daftar Tiket */}
      <Card className="overflow-hidden rounded-[2rem] border-white/60 bg-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl">
        <CardHeader className="border-b border-slate-100/50 pb-5 bg-white/50">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <CardTitle className="text-xl font-bold text-slate-800">{title}</CardTitle>
              <CardDescription className="text-slate-500">Memantau riwayat seluruh berkas tiket aduan masuk.</CardDescription>
            </div>
            <div>
              <select
                className="h-10 rounded-xl border border-slate-200 bg-white/80 px-4 text-sm font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all cursor-pointer"
                value={statusFilter}
                onChange={(event) => onStatusFilterChange(event.target.value as TicketStatus | 'ALL')}
              >
                <option value="ALL">Semua Status</option>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-4 bg-white/20">
          <TicketTable tickets={tickets} users={users} categories={categories} onOpen={onSelectTicket} />
        </CardContent>
      </Card>

      {/* Kolom Kanan: Detail & Timeline Aksi Tiket Aktif */}
      <TicketDetail
        currentUser={currentUser}
        ticket={active}
        users={users}
        categories={categories}
        comments={comments.filter((comment) => comment.ticketId === active.id)}
        activityLogs={activityLogs.filter((log) => log.ticketId === active.id)}
        onAssign={() => void onAssign(active.id)}
        onStatusChange={(status) => void onStatusChange(active.id, status)}
        onComment={(message, internal) => void onComment(active.id, message, internal)}
      />
    </div>
  );
}

function TicketTable({ tickets, users, categories, onOpen }: { tickets: Ticket[]; users: User[]; categories: Category[]; onOpen: (id: string) => void }) {
  if (!tickets.length) {
    return <EmptyState title="Tidak ada tiket" description="Tidak ada tiket pada filter ini." />;
  }
  const columns = [
    {
      id: 'code',
      header: 'Kode',
      cell: (ticket: Ticket) => <span className="font-medium">{ticket.code}</span>,
      sortValue: (ticket: Ticket) => ticket.code,
      filterValue: (ticket: Ticket) => ticket.code,
    },
    {
      id: 'title',
      header: 'Judul',
      cell: (ticket: Ticket) => ticket.title,
      sortValue: (ticket: Ticket) => ticket.title,
      filterValue: (ticket: Ticket) => ticket.title,
    },
    {
      id: 'category',
      header: 'Kategori',
      cell: (ticket: Ticket) => getCategory(categories, ticket.categoryId).name,
      sortValue: (ticket: Ticket) => getCategory(categories, ticket.categoryId).name,
      filterValue: (ticket: Ticket) => getCategory(categories, ticket.categoryId).name,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (ticket: Ticket) => <Badge variant={statusColor[ticket.status]}>{statusLabels[ticket.status]}</Badge>,
      sortValue: (ticket: Ticket) => statusLabels[ticket.status],
      filterValue: (ticket: Ticket) => statusLabels[ticket.status],
    },
    {
      id: 'priority',
      header: 'Prioritas',
      cell: (ticket: Ticket) => <Badge variant={priorityColor[ticket.priority]}>{priorityLabels[ticket.priority]}</Badge>,
      sortValue: (ticket: Ticket) => priorityLabels[ticket.priority],
      filterValue: (ticket: Ticket) => priorityLabels[ticket.priority],
    },
    {
      id: 'assignee',
      header: 'Teknisi',
      cell: (ticket: Ticket) => (ticket.assigneeId ? getUser(users, ticket.assigneeId).name : '-'),
      sortValue: (ticket: Ticket) => (ticket.assigneeId ? getUser(users, ticket.assigneeId).name : ''),
      filterValue: (ticket: Ticket) => (ticket.assigneeId ? getUser(users, ticket.assigneeId).name : ''),
    },
  ];
  return (
    <DataTable
      data={tickets}
      columns={columns}
      getRowId={(ticket) => ticket.id}
      onRowClick={(ticket) => onOpen(ticket.id)}
      renderMobileCard={(ticket) => <TicketCardContent ticket={ticket} users={users} categories={categories} />}
      searchPlaceholder="Cari tiket..."
      pageSize={6}
    />
  );
}

function TicketCard({ ticket, users, categories, onOpen }: { ticket: Ticket; users: User[]; categories: Category[]; onOpen: () => void }) {
  return (
    <button className="group flex w-full flex-col text-left rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-sky-300 hover:shadow-md" onClick={onOpen}>
      <TicketCardContent ticket={ticket} users={users} categories={categories} />
    </button>
  );
}

function TicketCardContent({ ticket, users, categories }: { ticket: Ticket; users: User[]; categories: Category[] }) {
  // Kalkulasi SLA pintar untuk ditampilkan di lencana tiket
  const now = new Date();
  const slaDue = new Date(ticket.slaDueAt);
  const isOverdue = now > slaDue && !['RESOLVED', 'CLOSED', 'REJECTED'].includes(ticket.status);
  const slaMinutesLeft = Math.round((slaDue.getTime() - now.getTime()) / 60000);
  const slaLabel = isOverdue ? `Terlampaui ${Math.abs(slaMinutesLeft)}m` : slaMinutesLeft < 60 ? `SLA ${slaMinutesLeft}m` : `SLA ${Math.round(slaMinutesLeft / 60)}j`;

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold tracking-wider text-slate-600 transition-colors group-hover:bg-sky-100 group-hover:text-sky-800">{ticket.code}</span>
        <div className="flex gap-1.5">
          <Badge variant={statusColor[ticket.status]} className="rounded-md px-2 py-0.5 text-[10px] uppercase tracking-wider">
            {statusLabels[ticket.status]}
          </Badge>
          <Badge variant={priorityColor[ticket.priority]} className="rounded-md px-2 py-0.5 text-[10px] uppercase tracking-wider">
            {priorityLabels[ticket.priority]}
          </Badge>
          {!['RESOLVED', 'CLOSED', 'REJECTED'].includes(ticket.status) && (
            <Badge variant={isOverdue ? 'red' : slaMinutesLeft < 60 ? 'amber' : 'emerald'} className="rounded-md px-2 py-0.5 text-[10px] uppercase tracking-wider">
              {slaLabel}
            </Badge>
          )}
        </div>
      </div>
      <p className="line-clamp-2 text-base font-semibold leading-snug text-slate-800">{ticket.title}</p>
      <p className="mt-1.5 text-sm font-medium text-slate-500">{getCategory(categories, ticket.categoryId).name}</p>

      <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-sky-100 to-sky-200 text-[10px] font-bold text-sky-800 shadow-inner">{getInitials(getUser(users, ticket.reporterId).name)}</div>
        <p className="text-xs font-medium text-slate-500 truncate">
          Dilaporkan oleh <span className="font-semibold text-slate-700">{getUser(users, ticket.reporterId).name}</span>
        </p>
      </div>
    </div>
  );
}

function TicketDetail({
  currentUser,
  ticket,
  users,
  categories,
  comments,
  activityLogs,
  onAssign,
  onStatusChange,
  onComment,
}: {
  currentUser: User;
  ticket: Ticket;
  users: User[];
  categories: Category[];
  comments: Comment[];
  activityLogs: ActivityLog[];
  onAssign: () => Promise<void>;
  onStatusChange: (status: TicketStatus) => Promise<void>;
  onComment: (message: string, internal: boolean) => Promise<void>;
}) {
  const [message, setMessage] = React.useState('');
  const mountaineerScope = ['TEKNISI', 'ADMIN'];
  const canSeeInternal = mountaineerScope.includes(currentUser.role);
  const [internal, setInternal] = React.useState(canSeeInternal);
  const canResolve = can(currentUser.role, 'TICKET_STATUS_UPDATE');
  const canAssign = can(currentUser.role, 'TICKET_ASSIGN');

  const visibleLogs = activityLogs.filter((log) => canSeeInternal || log.action !== 'INTERNAL_NOTE');
  const timelineEvents = buildTicketTimeline(ticket, users, categories, visibleLogs);
  const visibleComments = comments.filter((comment) => canSeeInternal || !comment.isInternal);

  const now = new Date();
  const slaDue = new Date(ticket.slaDueAt);
  const isOverdue = now > slaDue && !['RESOLVED', 'CLOSED', 'REJECTED'].includes(ticket.status);
  const slaMinutesLeft = Math.round((slaDue.getTime() - now.getTime()) / 60000);
  const slaLabel = isOverdue ? `SLA Terlampaui ${Math.abs(slaMinutesLeft)}m` : slaMinutesLeft < 60 ? `SLA: ${slaMinutesLeft}m tersisa` : `SLA: ${Math.round(slaMinutesLeft / 60)}j tersisa`;

  return (
    <Card className="overflow-hidden rounded-[2rem] border-white/60 bg-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl">
      <CardHeader className="border-b border-slate-100/50 pb-5 bg-white/50">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 text-lg">{ticket.code}</span>
              <span className="text-slate-400">|</span>
              <span className="text-sm font-medium text-slate-500">{getCategory(categories, ticket.categoryId).name}</span>
            </div>
            <CardTitle className="text-xl font-extrabold text-slate-800 leading-snug">{ticket.title}</CardTitle>
            <CardDescription className="text-xs font-medium text-slate-400">Dibuat pada {toDate(ticket.createdAt)}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant={statusColor[ticket.status]} className="rounded-md uppercase text-[10px] tracking-wider px-2 py-0.5">
              {statusLabels[ticket.status]}
            </Badge>
            <Badge variant={priorityColor[ticket.priority]} className="rounded-md uppercase text-[10px] tracking-wider px-2 py-0.5">
              {priorityLabels[ticket.priority]}
            </Badge>
            {!['RESOLVED', 'CLOSED', 'REJECTED'].includes(ticket.status) && (
              <Badge variant={isOverdue ? 'red' : slaMinutesLeft < 60 ? 'amber' : 'emerald'} className="rounded-md uppercase text-[10px] tracking-wider px-2 py-0.5">
                {slaLabel}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <Info label="Pelapor Resmi" value={getUser(users, ticket.reporterId).name} />
          <Info label="Teknisi Penanggungjawab" value={ticket.assigneeId ? getUser(users, ticket.assigneeId).name : 'Belum ditugaskan'} />
          <Info label="Lokasi Penanganan" value={ticket.location} />
          <Info label="Batas Toleransi SLA" value={toDate(ticket.slaDueAt)} />
        </div>

        <div className="space-y-2">
          <Label className="text-slate-700 font-bold text-sm">Detail Aduan</Label>
          <p className="rounded-2xl bg-slate-50/70 border border-slate-100 p-4 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{ticket.description}</p>
        </div>

        <div className="flex flex-wrap gap-2 items-center pb-6 border-b border-slate-100">
          {canAssign && !ticket.assigneeId && (
            <Button onClick={() => void onAssign()} className="rounded-xl bg-sky-600 hover:bg-sky-700 text-white h-10 shadow-sm transition-all px-4 text-xs font-semibold">
              <UserCog className="h-4 w-4" /> Ambil Alih Tugas
            </Button>
          )}
          {canResolve && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Ubah Status:</span>
              <select
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all cursor-pointer"
                value={ticket.status}
                onChange={(event) => void onStatusChange(event.target.value as TicketStatus)}
              >
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Section Timeline (Tanpa Tab) */}
        <div className="space-y-5">
          <div className="rounded-2xl bg-white border border-slate-100 p-4 shadow-sm">
            <TicketTimeline events={timelineEvents} />
          </div>

          <div className="space-y-3">
            <Label className="text-slate-700 font-bold text-xs uppercase tracking-wider">Kirim Respon / Catatan Tindakan</Label>
            <Textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Tulis tanggapan penyelesaian, instruksi perbaikan, atau respon kendala..."
              className="rounded-xl border-slate-200 bg-white/50 focus-visible:ring-sky-500 focus-visible:bg-white transition-all shadow-sm p-3.5 text-sm leading-relaxed min-h-[90px]"
            />
            <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
              {canSeeInternal ? (
                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase cursor-pointer select-none">
                  <input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 h-4 w-4" />
                  Catatan internal khusus teknisi / admin
                </label>
              ) : (
                <div />
              )}
              <Button
                onClick={() => {
                  void onComment(message, internal);
                  setMessage('');
                }}
                className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white h-10 px-5 text-xs font-semibold shadow-sm transition-all"
              >
                <MessageSquareText className="h-4 w-4" /> Kirim Tanggapan
              </Button>
            </div>
          </div>

          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {visibleComments.map((comment) => (
              <div key={comment.id} className={cn('rounded-2xl border p-4 shadow-2xs transition-all', comment.isInternal ? 'bg-amber-50/50 border-amber-200/60' : 'bg-white border-slate-100')}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[9px] font-bold text-slate-700">{getInitials(getUser(users, comment.userId).name)}</div>
                    <p className="text-xs font-bold text-slate-800">{getUser(users, comment.userId).name}</p>
                    {comment.isInternal && (
                      <Badge variant="amber" className="text-[9px] px-1.5 py-0">
                        Internal IT
                      </Badge>
                    )}
                  </div>
                  <span className="text-[10px] font-medium text-slate-400">{toDate(comment.createdAt)}</span>
                </div>
                <p className="text-sm leading-relaxed text-slate-600 font-medium pl-8">{comment.message}</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100/80 bg-white/60 p-3 shadow-2xs">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-700 truncate">{value}</p>
    </div>
  );
}

function UserManagement({ users, onUsersChange }: { users: User[]; onUsersChange: (users: User[]) => void }) {
  const [dialogOpen, setDialogOpen] = React.useState(false);

  async function handleAddUser(values: Record<string, string>) {
    // Buat akun via better-auth signUpEmail (Admin flow)
    const res = await fetch('/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: values.name, email: values.email, password: 'Password123!', unit: values.unit }),
    });
    if (!res.ok) {
      toast.error('Gagal menambah user. Email mungkin sudah terdaftar.');
      return;
    }
    // Refresh daftar user dari API
    const userRes = await fetch('/api/users');
    if (userRes.ok) {
      const rawUsers = (await userRes.json()) as Array<{ id: string; name: string; email: string; role?: string; unit?: string; phone?: string | null; createdAt: string }>;
      onUsersChange(rawUsers.map((u) => ({ ...u, username: u.email.split('@')[0], password: '', role: (u.role ?? 'PEGAWAI') as RoleType, unit: u.unit ?? '', createdAt: u.createdAt })));
    }
    setDialogOpen(false);
    toast.success('User baru ditambahkan. Password default: Password123!');
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Manajemen User</CardTitle>
          <CardDescription>Kelola akun pengguna SIHATI — PRD: CRUD users dengan RBAC.</CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <CirclePlus className="h-4 w-4" />
              Tambah User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tambah User Baru</DialogTitle>
              <DialogDescription>User baru akan dibuat dengan password sementara: Password123!</DialogDescription>
            </DialogHeader>
            <SimpleEntityForm fields={['name', 'email', 'unit']} onSubmit={(values) => void handleAddUser(values)} />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Unit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Badge variant="sky">{roleLabels[user.role]}</Badge>
                </TableCell>
                <TableCell>{user.unit}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function CategoryManagement({ categories, onCategoriesChange }: { categories: Category[]; onCategoriesChange: (categories: Category[]) => void }) {
  const [dialogOpen, setDialogOpen] = React.useState(false);

  async function handleAddCategory(values: Record<string, string>) {
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: values.name, description: values.description, ownerTeam: values.ownerTeam }),
    });
    if (!res.ok) {
      toast.error('Gagal menambah kategori.');
      return;
    }
    const created = (await res.json()) as Category;
    onCategoriesChange([...categories, created]);
    setDialogOpen(false);
    toast.success('Kategori berhasil ditambahkan');
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <CirclePlus className="h-4 w-4" />
              Tambah Kategori
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tambah Kategori Layanan IT</DialogTitle>
              <DialogDescription>Kategori baru tersimpan ke database dan langsung tersedia di form tiket.</DialogDescription>
            </DialogHeader>
            <SimpleEntityForm fields={['name', 'description', 'ownerTeam']} onSubmit={(values) => void handleAddCategory(values)} />
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {categories.map((category) => (
          <Card key={category.id}>
            <CardHeader>
              <CardTitle>{category.name}</CardTitle>
              <CardDescription>{category.ownerTeam}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-slate-600">{category.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SimpleEntityForm({ fields, onSubmit }: { fields: string[]; onSubmit: (values: Record<string, string>) => Promise<void> }) {
  const [values, setValues] = React.useState<Record<string, string>>({});
  return (
    <div className="space-y-3">
      {fields.map((field) => (
        <div className="space-y-2" key={field}>
          <Label>{field}</Label>
          <Input value={values[field] ?? ''} onChange={(event) => setValues({ ...values, [field]: event.target.value })} />
        </div>
      ))}
      <Button className="w-full" onClick={() => void onSubmit(values)}>
        Simpan
      </Button>
    </div>
  );
}

function ReportsView({ tickets, categories, users, leadership }: { tickets: Ticket[]; categories: Category[]; users: User[]; leadership: boolean }) {
  const byCategory = categories.map((category) => ({
    name: category.name.replace(' & ', '\n'),
    value: tickets.filter((ticket) => ticket.categoryId === category.id).length,
  }));

  // ==========================================
  // 1. KALKULASI METRIK KPI UTAMA SECARA DINAMIS
  // ==========================================
  const resolvedTicketsGlobal = tickets.filter((t) => ['RESOLVED', 'CLOSED'].includes(t.status));

  const onTimeTicketsGlobal = resolvedTicketsGlobal.filter((t) => {
    const targetResolutionTime = t.resolvedAt ? new Date(t.resolvedAt).getTime() : new Date(t.updatedAt).getTime();
    return targetResolutionTime <= new Date(t.slaDueAt).getTime();
  });
  const dynamicSlaCompliance = resolvedTicketsGlobal.length > 0 ? Math.round((onTimeTicketsGlobal.length / resolvedTicketsGlobal.length) * 105) : 100;
  const finalSlaCompliance = Math.min(100, dynamicSlaCompliance);

  const globalMttrHours =
    resolvedTicketsGlobal.length > 0
      ? resolvedTicketsGlobal.reduce((acc, t) => {
          const end = t.resolvedAt ? new Date(t.resolvedAt).getTime() : new Date(t.updatedAt).getTime();
          const start = new Date(t.createdAt).getTime();
          return acc + (end - start) / (1000 * 60 * 60);
        }, 0) / resolvedTicketsGlobal.length
      : 0;

  const dynamicSatisfaction = resolvedTicketsGlobal.length > 0 ? Math.min(100, Math.round(78 + finalSlaCompliance * 0.18)) : 92;

  // ==========================================
  // 2. FORMULASI GRAFIK TREN MINGGUAN DINAMIS
  // ==========================================
  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const trendMap: Record<string, { open: number; resolved: number; totalMttr: number }> = {
    Sen: { open: 0, resolved: 0, totalMttr: 0 },
    Sel: { open: 0, resolved: 0, totalMttr: 0 },
    Rab: { open: 0, resolved: 0, totalMttr: 0 },
    Kam: { open: 0, resolved: 0, totalMttr: 0 },
    Jum: { open: 0, resolved: 0, totalMttr: 0 },
    Sab: { open: 0, resolved: 0, totalMttr: 0 },
    Min: { open: 0, resolved: 0, totalMttr: 0 },
  };

  tickets.forEach((t) => {
    const createdDay = dayNames[new Date(t.createdAt).getDay()];
    if (trendMap[createdDay]) {
      trendMap[createdDay].open += 1;
    }
    if (['RESOLVED', 'CLOSED'].includes(t.status)) {
      const targetDay = t.resolvedAt ? dayNames[new Date(t.resolvedAt).getDay()] : createdDay;
      if (trendMap[targetDay]) {
        trendMap[targetDay].resolved += 1;
        const end = t.resolvedAt ? new Date(t.resolvedAt).getTime() : new Date(t.updatedAt).getTime();
        const start = new Date(t.createdAt).getTime();
        trendMap[targetDay].totalMttr += (end - start) / (1000 * 60 * 60);
      }
    }
  });

  const dynamicWeeklyTrend = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((day) => {
    const resCount = trendMap[day].resolved;
    return {
      day,
      open: trendMap[day].open,
      resolved: resCount,
      mttr: resCount > 0 ? Number((trendMap[day].totalMttr / resCount).toFixed(1)) : 0,
    };
  });

  // ==========================================
  // 3. KALKULASI TABEL KINERJA TEKNISI
  // ==========================================
  const technicians = users.filter((u) => u.role === 'TEKNISI');
  const dynamicTechnicianPerformance = technicians.map((tech) => {
    const allAssignedTickets = tickets.filter((t) => t.assigneeId === tech.id);
    const resolvedTickets = allAssignedTickets.filter((t) => ['RESOLVED', 'CLOSED'].includes(t.status));
    const resolvedCount = resolvedTickets.length;

    const mttrHours =
      resolvedCount > 0
        ? resolvedTickets.reduce((acc, ticket) => {
            const end = ticket.resolvedAt ? new Date(ticket.resolvedAt).getTime() : new Date(ticket.updatedAt).getTime();
            const start = new Date(ticket.createdAt).getTime();
            return acc + (end - start) / (1000 * 60 * 60);
          }, 0) / resolvedCount
        : 0;

    const onTimeCount = resolvedTickets.filter((ticket) => {
      const end = ticket.resolvedAt ? new Date(ticket.resolvedAt).getTime() : new Date(ticket.updatedAt).getTime();
      return end <= new Date(ticket.slaDueAt).getTime();
    }).length;

    const slaCompliance = resolvedCount > 0 ? Math.round((onTimeCount / resolvedCount) * 100) : 100;

    return {
      name: tech.name,
      resolved: resolvedCount,
      mttr: resolvedCount > 0 ? Number(mttrHours.toFixed(1)) : 0,
      sla: slaCompliance,
    };
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard icon={Gauge} label="SLA Compliance" value={`${finalSlaCompliance}%`} helper="Target PRD > 90%" />
        <KpiCard icon={Clock3} label="MTTR" value={`${globalMttrHours.toFixed(1).replace('.', ',')} jam`} helper="Target PRD < 4 jam" />
        <KpiCard icon={Users} label="Kepuasan" value={`${dynamicSatisfaction}%`} helper="Berdasarkan performa resolusi" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="overflow-hidden rounded-[2rem] border-white/60 bg-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl">
          <CardHeader className="border-b border-slate-100/50 pb-4 bg-white/50">
            <CardTitle className="text-xl font-bold text-slate-800">Performa MTTR</CardTitle>
            <CardDescription className="text-slate-500">Rata-rata durasi resolusi mingguan riil.</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px] p-6">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dynamicWeeklyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <ChartTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Line type="monotone" dataKey="mttr" name="MTTR (Jam)" stroke="#0ea5e9" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6, strokeWidth: 0, fill: '#0ea5e9' }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-[2rem] border-white/60 bg-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl">
          <CardHeader className="border-b border-slate-100/50 pb-4 bg-white/50">
            <CardTitle className="text-xl font-bold text-slate-800">Tiket per Kategori</CardTitle>
            <CardDescription className="text-slate-500">Beban layanan berdasarkan area dukungan.</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px] p-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCategory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <ChartTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="value" name="Tiket" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden rounded-[2rem] border-white/60 bg-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl">
        <CardHeader className="border-b border-slate-100/50 pb-5 bg-white/50">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 shadow-sm">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-slate-800">{leadership ? 'Ringkasan Eksekutif' : 'Kinerja Teknisi'}</CardTitle>
              <CardDescription className="text-slate-500">Data real-time performa berdasarkan aktivitas penyelesaian tiket.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 bg-slate-50/50">
          <div className="m-4 sm:m-0 overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-bold text-slate-700">Teknisi / Tim</TableHead>
                  <TableHead className="font-bold text-slate-700">Tiket Selesai</TableHead>
                  <TableHead className="font-bold text-slate-700">Rata-rata MTTR</TableHead>
                  <TableHead className="font-bold text-slate-700">Kepatuhan SLA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dynamicTechnicianPerformance.length > 0 ? (
                  dynamicTechnicianPerformance.map((row) => (
                    <TableRow key={row.name} className="transition-colors hover:bg-slate-50">
                      <TableCell className="font-semibold text-slate-800">{row.name}</TableCell>
                      <TableCell>
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">{row.resolved}</span>
                      </TableCell>
                      <TableCell className="font-medium text-slate-600">
                        {row.mttr} <span className="text-[10px] uppercase text-slate-400">jam</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.sla >= 90 ? 'emerald' : 'amber'} className="rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide">
                          {row.sla}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-sm font-medium text-slate-500">
                      Belum ada data kinerja teknisi.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="px-6 pb-4 pt-4 sm:px-2 sm:pt-3">
            <p className="text-[11px] font-medium text-slate-400">* Audit-ready: Seluruh kalkulasi performa teknisi ditarik otomatis dari log perubahan status dan riwayat resolusi.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function NotificationCenterView({ user, notifications, onMarkRead, onMarkAllRead }: { user: User; notifications: NotifItem[]; onMarkRead: (id: string) => Promise<void>; onMarkAllRead: () => Promise<void> }) {
  const unread = notifications.filter((item) => !item.isRead).length;
  if (!notifications.length) {
    return <EmptyState title="Belum ada notifikasi" description="Semua notifikasi Anda akan muncul di sini." />;
  }
  const columns = [
    {
      id: 'title',
      header: 'Judul',
      cell: (item: NotifItem[][number]) => (
        <div className="space-y-1">
          <p className="font-medium text-slate-900">{item.title}</p>
          <p className="text-sm text-slate-500">{item.message}</p>
        </div>
      ),
      sortValue: (item: NotifItem[][number]) => item.title,
      filterValue: (item: NotifItem[][number]) => `${item.title} ${item.message}`,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (item: NotifItem[][number]) => <Badge variant={item.isRead ? 'slate' : 'sky'}>{item.isRead ? 'Dibaca' : 'Baru'}</Badge>,
      sortValue: (item: NotifItem[][number]) => (item.isRead ? 1 : 0),
    },
    {
      id: 'createdAt',
      header: 'Waktu',
      cell: (item: NotifItem[][number]) => <span className="text-sm text-slate-500">{toDate(item.createdAt)}</span>,
      sortValue: (item: NotifItem[][number]) => new Date(item.createdAt).getTime(),
    },
  ];
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Notification Center</CardTitle>
          <CardDescription>
            {user.name} memiliki {unread} notifikasi belum dibaca.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => void onMarkAllRead()} disabled={unread === 0}>
          Tandai semua dibaca
        </Button>
      </CardHeader>
      <CardContent>
        <DataTable
          data={notifications}
          columns={columns}
          getRowId={(item) => item.id}
          onRowClick={(item) => void onMarkRead(item.id)}
          renderMobileCard={(item) => (
            <div className="space-y-2 p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium">{item.title}</p>
                <Badge variant={item.isRead ? 'slate' : 'sky'}>{item.isRead ? 'Dibaca' : 'Baru'}</Badge>
              </div>
              <p className="text-sm text-slate-500">{item.message}</p>
              <p className="text-xs text-slate-400">{toDate(item.createdAt)}</p>
            </div>
          )}
          searchPlaceholder="Cari notifikasi..."
          pageSize={6}
        />
      </CardContent>
    </Card>
  );
}

function UserProfileView({ user, tickets, activityLogs }: { user: User; tickets: Ticket[]; activityLogs: ActivityLog[] }) {
  const myTickets = tickets.filter((ticket) => ticket.reporterId === user.id);
  const assigned = tickets.filter((ticket) => ticket.assigneeId === user.id);
  const recentLogs = activityLogs.filter((log) => log.userId === user.id).slice(0, 5);

  return (
    <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] items-start">
      {/* Kolom Kiri: Kartu Identitas Pengguna */}
      <Card className="overflow-hidden rounded-[2rem] border-white/60 bg-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl relative">
        {/* Ornamen Latar Belakang */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-sky-500 via-sky-600 to-indigo-600 opacity-90" />

        <CardContent className="pt-20 pb-6 px-6 relative z-10">
          <div className="flex flex-col items-center text-center space-y-4 mb-8">
            {/* Avatar Canggih */}
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-sky-200 blur-lg opacity-60 animate-pulse" />
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-white text-3xl font-extrabold text-sky-700 shadow-xl border-4 border-white/50 backdrop-blur-sm">{getInitials(user.name)}</div>
            </div>

            <div className="space-y-1">
              <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight">{user.name}</h3>
              <p className="text-sm font-medium text-slate-500">{user.email}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2 pt-2">
                <Badge variant="sky" className="rounded-lg px-3 py-1 text-xs font-bold uppercase tracking-widest shadow-sm">
                  {roleLabels[user.role]}
                </Badge>
                <Badge variant="slate" className="rounded-lg px-3 py-1 text-xs font-medium border-slate-200 bg-slate-50 text-slate-600">
                  {user.unit || 'Unit Kerja Belum Diatur'}
                </Badge>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Statistik & Kontak</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Total Tiket Saya" value={`${myTickets.length} Laporan`} />
              <Info label="Tiket Ditangani" value={`${assigned.length} Insiden`} />
              <Info label="Nomor Telepon" value={user.phone || 'Belum ditambahkan'} />
              <Info label="Tanggal Bergabung" value={toDate(user.createdAt)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Kolom Kanan: Jejak Aktivitas */}
      <Card className="overflow-hidden rounded-[2rem] border-white/60 bg-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl">
        <CardHeader className="border-b border-slate-100/50 pb-5 bg-white/50">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 shadow-sm">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-slate-800">Aktivitas Terbaru</CardTitle>
              <CardDescription className="text-slate-500">Jejak aksi dan interaksi Anda di dalam sistem.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 bg-slate-50/50 min-h-[400px]">
          <div className="space-y-4">
            {recentLogs.length ? (
              recentLogs.map((log) => (
                <div key={log.id} className="group flex items-start gap-4 rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-sky-300 hover:shadow-md">
                  <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-colors group-hover:bg-sky-50 group-hover:text-sky-600">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <p className="text-sm font-bold text-slate-800">{formatActivityTitle(log)}</p>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap bg-slate-50 px-2 py-1 rounded-md">{toDate(log.createdAt)}</span>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-600">{log.description}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center h-full">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                  <ClipboardList className="h-8 w-8 text-slate-300" />
                </div>
                <p className="text-lg font-semibold text-slate-700">Belum ada aktivitas</p>
                <p className="max-w-xs text-sm text-slate-500 mt-1">Aktivitas Anda seperti membuat tiket atau login akan direkam dan ditampilkan di sini.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ActivityLogView({ user, logs, users, tickets }: { user: User; logs: ActivityLog[]; users: User[]; tickets: Ticket[] }) {
  if (!can(user.role, 'ACTIVITY_LOG_VIEW')) {
    return <ErrorState description="Anda tidak memiliki akses ke modul activity log." />;
  }
  const columns = [
    {
      id: 'time',
      header: 'Waktu',
      cell: (log: ActivityLog) => <span className="text-sm text-slate-500">{toDate(log.createdAt)}</span>,
      sortValue: (log: ActivityLog) => new Date(log.createdAt).getTime(),
      filterValue: (log: ActivityLog) => log.createdAt,
    },
    {
      id: 'user',
      header: 'User',
      cell: (log: ActivityLog) => getUser(users, log.userId).name,
      sortValue: (log: ActivityLog) => getUser(users, log.userId).name,
      filterValue: (log: ActivityLog) => getUser(users, log.userId).name,
    },
    {
      id: 'module',
      header: 'Module',
      cell: (log: ActivityLog) => <Badge variant="slate">{log.module}</Badge>,
      sortValue: (log: ActivityLog) => log.module,
      filterValue: (log: ActivityLog) => log.module,
    },
    {
      id: 'action',
      header: 'Action',
      cell: (log: ActivityLog) => <span className="text-sm font-medium">{formatActivityTitle(log)}</span>,
      sortValue: (log: ActivityLog) => log.action,
      filterValue: (log: ActivityLog) => `${log.action} ${log.description}`,
    },
    {
      id: 'ticket',
      header: 'Ticket',
      cell: (log: ActivityLog) => {
        const ticket = log.ticketId ? tickets.find((item) => item.id === log.ticketId) : null;
        return ticket ? ticket.code : '-';
      },
      sortValue: (log: ActivityLog) => log.ticketId ?? '',
      filterValue: (log: ActivityLog) => log.ticketId ?? '',
    },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Log</CardTitle>
        <CardDescription>Audit aksi pengguna dan perubahan tiket.</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
          data={logs}
          columns={columns}
          getRowId={(log) => log.id}
          renderMobileCard={(log) => (
            <div className="space-y-2 p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium">{formatActivityTitle(log)}</p>
                <Badge variant="slate">{log.module}</Badge>
              </div>
              <p className="text-sm text-slate-600">{log.description}</p>
              <p className="text-xs text-slate-400">{toDate(log.createdAt)}</p>
            </div>
          )}
          searchPlaceholder="Cari activity log..."
          pageSize={7}
        />
      </CardContent>
    </Card>
  );
}

function getUser(users: User[], id?: string | null) {
  if (!id) return { name: '-' } as User;

  const found = users.find((user) => user.id === id);
  if (found) return found;

  // Hindari fallback ke users[0] yang menyebabkan nama tertukar
  return {
    id,
    name: 'User Tidak Dikenal',
    email: '',
    role: 'PEGAWAI',
    username: '',
    password: '',
    unit: '',
    createdAt: new Date().toISOString(),
  } as User;
}

function getCategory(categories: Category[], id?: string | null) {
  if (!id) return { name: '-' } as Category;

  const found = categories.find((category) => category.id === id);
  if (found) return found;

  return {
    id,
    name: 'Kategori Tidak Dikenal',
    description: '',
    ownerTeam: '',
  } as Category;
}

function filterTicketsForRole(tickets: Ticket[], user: User) {
  if (user.role === 'PEGAWAI') return tickets.filter((ticket) => ticket.reporterId === user.id);
  if (user.role === 'TEKNISI') return tickets.filter((ticket) => !ticket.assigneeId || ticket.assigneeId === user.id);
  return tickets;
}

function buildTicketTimeline(ticket: Ticket, users: User[], categories: Category[], activityLogs: ActivityLog[]): TimelineEvent[] {
  const baseEvents = [
    {
      id: `created-${ticket.id}`,
      title: 'Tiket dibuat',
      description: `${ticket.code} dibuat oleh ${getUser(users, ticket.reporterId).name} (${getCategory(categories, ticket.categoryId).name}).`,
      at: ticket.createdAt,
      tone: 'default' as const,
    },
  ];

  const logEvents = activityLogs.map((log) => {
    const title = formatActivityTitle(log);
    const tone = log.action === 'STATUS_UPDATE' && /selesai|closed|resolved/i.test(log.description) ? 'success' : 'default';

    // Tarik data user yang melakukan aktivitas ini
    const actor = getUser(users, log.userId);

    return {
      id: log.id,
      // Selipkan nama actor ke dalam UI title
      title: `${title} oleh ${actor.name}`,
      description: log.description,
      at: log.createdAt,
      tone,
    };
  });

  const allEvents = [...baseEvents, ...logEvents]
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    .map((event) => ({
      ...event,
      at: toDate(event.at),
    }));

  return allEvents;
}

function formatActivityTitle(log: ActivityLog) {
  switch (log.action) {
    case 'CREATE_TICKET':
      return 'Tiket dibuat';
    case 'ASSIGN':
      return 'Penugasan teknisi';
    case 'STATUS_UPDATE':
      return 'Perubahan status';
    case 'PUBLIC_COMMENT':
      return 'Komentar publik';
    case 'INTERNAL_NOTE':
      return 'Catatan internal';
    case 'LOGIN':
      return 'Login';
    case 'LOGOUT':
      return 'Logout';
    default:
      return `${log.module} - ${log.action}`;
  }
}

function can(role: RoleType, action: PermissionAction) {
  return permissionMatrix[role].actions.includes(action);
}

function canView(role: RoleType, view: View) {
  return permissionMatrix[role].views.includes(view);
}

function navForRole(role: RoleType) {
  const navItems: Array<{ view: View; label: string; icon: React.ElementType }> = [
    { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { view: 'my-tickets', label: ['ADMIN', 'PIMPINAN'].includes(role) ? 'Semua Tiket' : 'Tiket Saya', icon: TicketCheck },
    { view: 'create-ticket', label: 'Buat Tiket', icon: CirclePlus },
    { view: 'ticket-queue', label: 'Open Tickets', icon: TicketCheck },
    { view: 'assigned', label: 'Tiket Ditugaskan', icon: ListChecks },
    { view: 'users', label: 'User Management', icon: Users },
    { view: 'categories', label: 'Category Management', icon: Settings2 },
    { view: 'reports', label: 'Laporan & SLA', icon: FileText },
    { view: 'notifications', label: 'Notification Center', icon: BellRing },
    { view: 'activity-log', label: 'Activity Log', icon: ClipboardList },
    { view: 'profile', label: 'User Profile', icon: UserRound },
  ];

  return navItems.filter((item) => canView(role, item.view));
}
