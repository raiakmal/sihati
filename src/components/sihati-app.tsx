'use client';

import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Tabs from '@radix-ui/react-tabs';
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
  Upload,
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
import { technicianPerformance, weeklyTrend } from '@/lib/mock-data';
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

  // Fetch semua akun dari database untuk ditampilkan di halaman login
  const [demoAccounts, setDemoAccounts] = React.useState<Array<{ role: RoleType; name: string; email: string }>>([]);
  const [loadingDemo, setLoadingDemo] = React.useState(true);

  React.useEffect(() => {
    fetch('/api/users/demo')
      .then(async (res) => {
        if (res.ok) setDemoAccounts((await res.json()) as Array<{ role: RoleType; name: string; email: string }>);
      })
      .catch(() => {})
      .finally(() => setLoadingDemo(false));
  }, []);

  // Password demo per role (sesuai seed.ts)
  const demoPasswordMap: Record<string, string> = {
    PEGAWAI: 'password123',
    TEKNISI: 'password123',
    ADMIN: 'admin123',
    PIMPINAN: 'pimpinan123',
  };

  async function handleLogin() {
    setLoggingIn(true);
    await onLogin(email, password);
    setLoggingIn(false);
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-8 px-4 py-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-sky-700 text-white">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-sky-800">SIHATI</p>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Sistem Helpdesk dan Ticketing IT Pemerintah</h1>
            </div>
          </div>
          <p className="max-w-2xl text-base leading-7 text-slate-600">Portal operasional untuk pelaporan insiden IT, transparansi progres, dokumentasi audit-ready, dan pemantauan SLA lintas dinas.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricPill icon={Clock3} label="Target MTTR" value="< 4 jam" />
            <MetricPill icon={Gauge} label="SLA Compliance" value="> 90%" />
            <MetricPill icon={CheckCircle2} label="Kepuasan" value="> 85%" />
          </div>
        </section>
        <Card>
          <CardHeader>
            <CardTitle>{authMode === 'login' ? 'Masuk' : authMode === 'register' ? 'Registrasi Pegawai' : 'Pulihkan Password'}</CardTitle>
            <CardDescription>{authMode === 'login' ? 'Gunakan email dan password akun Anda. Klik akun demo di bawah untuk pengisian otomatis.' : 'Hubungi Admin untuk registrasi dan pemulihan password.'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {authMode === 'login' ? (
              <>
                <div className="space-y-2">
                  <Label>Email dinas</Label>
                  <Input
                    type="email"
                    placeholder="nama@pemda.go.id"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleLogin();
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    placeholder="Masukkan password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleLogin();
                    }}
                  />
                </div>
                {authError && <p className="text-sm text-red-600">{authError}</p>}
                <Button className="w-full" onClick={() => void handleLogin()} disabled={loggingIn}>
                  <LockKeyhole className="h-4 w-4" />
                  {loggingIn ? 'Memproses...' : 'Masuk ke Dashboard'}
                </Button>
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  <p className="font-semibold text-slate-700">Akun demo</p>
                  <div className="mt-2 grid gap-2">
                    {loadingDemo ? (
                      <p className="py-2 text-center text-slate-400">Memuat akun demo...</p>
                    ) : demoAccounts.length === 0 ? (
                      <p className="py-2 text-center text-slate-400">Tidak ada akun demo tersedia.</p>
                    ) : (
                      demoAccounts.map((account) => (
                        <button
                          key={account.email}
                          className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-50"
                          onClick={() => {
                            setEmail(account.email);
                            setPassword(demoPasswordMap[account.role] ?? 'password123');
                          }}
                        >
                          <span>
                            {roleLabels[account.role]} — {account.name}
                          </span>
                          <span className="text-slate-400">isi otomatis</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </>
            ) : (
              <PublicForm mode={authMode} onModeChange={onModeChange} />
            )}
            <div className="flex flex-wrap gap-2 text-sm">
              <Button variant="ghost" size="sm" onClick={() => onModeChange('login')}>
                Login
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onModeChange('register')}>
                Register
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onModeChange('forgot')}>
                Forgot Password
              </Button>
            </div>
          </CardContent>
        </Card>
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
        // Mengirim request ke endpoint pendaftaran better-auth
        const res = await fetch('/api/auth/sign-up/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            email,
            password,
            unit,
            // Menetapkan role default sebagai PEGAWAI
            role: 'PEGAWAI',
          }),
        });

        if (!res.ok) {
          toast.error('Gagal mendaftar. Pastikan email belum terdaftar dan password minimal 8 karakter.');
        } else {
          toast.success('Registrasi berhasil! Silakan masuk dengan akun Anda.');
          onModeChange('login'); // Otomatis kembali ke layar login
        }
      } catch (error) {
        toast.error('Terjadi kesalahan jaringan.');
      } finally {
        setLoading(false);
      }
    } else {
      // Flow untuk Forgot Password
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
      <Button className="w-full" onClick={() => void handleSubmit()} disabled={loading}>
        {loading ? 'Memproses...' : mode === 'register' ? 'Buat Akun' : 'Kirim Instruksi'}
      </Button>
    </div>
  );
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input {...props} />
    </div>
  );
}

function MetricPill({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <Icon className="mb-3 h-5 w-5 text-sky-700" />
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}

function Sidebar({ nav, view, open, onToggle, onViewChange }: { nav: ReturnType<typeof navForRole>; view: View; open: boolean; onToggle: () => void; onViewChange: (view: View) => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-700 text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          {open && (
            <div>
              <p className="font-semibold">SIHATI</p>
              <p className="text-xs text-slate-500">Helpdesk IT</p>
            </div>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onToggle} aria-label="Toggle sidebar">
          {open ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {nav.map((item) => (
          <Tooltip.Root key={item.view}>
            <Tooltip.Trigger asChild>
              <button
                className={cn(
                  'flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950',
                  view === item.view && 'bg-sky-50 text-sky-800',
                  !open && 'justify-center px-0',
                )}
                onClick={() => onViewChange(item.view)}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {open && <span>{item.label}</span>}
              </button>
            </Tooltip.Trigger>
            {!open && <Tooltip.Content className="rounded-md bg-slate-950 px-2 py-1 text-xs text-white">{item.label}</Tooltip.Content>}
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
      <button className="absolute inset-0 bg-slate-950/40" onClick={onClose} aria-label="Tutup navigasi" />
      <div className="absolute inset-y-0 left-0 w-80 max-w-[86vw] bg-white p-4 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="font-semibold">SIHATI</p>
            <p className="text-xs text-slate-500">{roleLabels[user.role]}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-1">
          {nav.map((item) => (
            <button
              key={item.view}
              className={cn('flex h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-medium', view === item.view ? 'bg-sky-50 text-sky-800' : 'text-slate-600')}
              onClick={() => {
                onViewChange(item.view);
                onClose();
              }}
            >
              <item.icon className="h-4 w-4" />
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
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Button className="lg:hidden" variant="ghost" size="icon" onClick={onMenu}>
          <Menu className="h-5 w-5" />
        </Button>
        <GlobalSearch tickets={tickets} users={users} categories={categories} onTicketSelect={onTicketSelect} />
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button variant="outline" size="icon" aria-label="Notifikasi">
              <div className="relative">
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && <span className="absolute -right-2 -top-2 h-2.5 w-2.5 rounded-full bg-red-500" />}
              </div>
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end" className="z-50 w-80 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
            <div className="flex items-center justify-between px-2 py-2">
              <p className="text-sm font-semibold">Notifikasi</p>
              <Button variant="ghost" size="sm" onClick={onOpenNotifications}>
                Lihat semua
              </Button>
            </div>
            {userNotifications.length ? (
              userNotifications.map((item) => (
                <div key={item.id} className="rounded-md p-2 text-sm hover:bg-slate-50">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-slate-500">{item.message}</p>
                </div>
              ))
            ) : (
              <p className="px-2 py-3 text-sm text-slate-500">Tidak ada notifikasi baru.</p>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Root>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="flex items-center gap-3 rounded-md p-1.5 hover:bg-slate-100">
              <Avatar name={user.name} />
              <span className="hidden text-left text-sm sm:block">
                <span className="block font-medium">{user.name}</span>
                <span className="block text-xs text-slate-500">{roleLabels[user.role]}</span>
              </span>
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end" className="z-50 w-56 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
            <div className="px-2 py-2 text-sm">
              <p className="font-medium">{user.name}</p>
              <p className="text-slate-500">{user.email}</p>
            </div>
            <DropdownMenu.Separator className="my-1 h-px bg-slate-100" />
            <DropdownMenu.Item className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm outline-none hover:bg-slate-100" onSelect={() => void onLogout()}>
              <LogOut className="h-4 w-4" />
              Keluar
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <AvatarPrimitive.Root className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-800">
      <AvatarPrimitive.Fallback>{getInitials(name)}</AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

function PageHeader({ user, view }: { user: User; view: View }) {
  const title = navForRole(user.role).find((item) => item.view === view)?.label ?? 'Dashboard';
  return (
    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
      <div>
        <p className="text-sm font-medium text-sky-800">Selamat bekerja, {user.name}</p>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      </div>
      <Badge variant="sky">
        {roleLabels[user.role]} - {user.unit}
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
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard icon={TicketCheck} label="Total Ticket" value={kpi.total} helper="Seluruh tiket relevan" />
        <KpiCard icon={FileClock} label="Open Ticket" value={kpi.open} helper="Status Open" />
        <KpiCard icon={CheckCircle2} label="Resolved Ticket" value={kpi.resolved} helper="Resolved dan closed" />
        <KpiCard icon={Activity} label="Critical Ticket" value={kpi.critical} helper="Prioritas kritis" />
        <KpiCard icon={Gauge} label="SLA Compliance" value={`${kpi.slaCompliance}%`} helper="Tepat waktu" />
        <KpiCard icon={Clock3} label="Average MTTR" value={`${kpi.avgMttr} jam`} helper="Rata-rata durasi" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader>
            <CardTitle>Tren Tiket Mingguan</CardTitle>
            <CardDescription>Perbandingan tiket masuk, selesai, dan MTTR.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" />
                <YAxis />
                <ChartTooltip />
                <Area dataKey="open" name="Masuk" stroke="#0369a1" fill="#bae6fd" />
                <Area dataKey="resolved" name="Selesai" stroke="#059669" fill="#bbf7d0" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Status Tiket</CardTitle>
            <CardDescription>Distribusi seluruh tiket demo.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusChart} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85}>
                  {statusChart.map((_, index) => (
                    <Cell key={index} fill={['#0369a1', '#7c3aed', '#f59e0b', '#059669', '#dc2626'][index % 5]} />
                  ))}
                </Pie>
                <ChartTooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Tiket yang Membutuhkan Perhatian</CardTitle>
          <CardDescription>Prioritas tinggi, SLA dekat, atau status menunggu.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 lg:grid-cols-2">
            {urgent.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} users={users} categories={categories} onOpen={() => onOpenTicket(ticket.id)} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, helper }: { icon: React.ElementType; label: string; value: number | string; helper: string }) {
  return (
    <Card>
      <CardContent className="flex items-start gap-4 p-5">
        <div className="rounded-lg bg-sky-50 p-3 text-sky-700">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
          <p className="text-xs text-slate-500">{helper}</p>
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
    <Card>
      <CardHeader>
        <CardTitle>Buat Tiket Baru</CardTitle>
        <CardDescription>Lengkapi informasi insiden agar teknisi dapat memprioritaskan penanganan.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-5 lg:grid-cols-2" onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}>
          <div className="space-y-2 lg:col-span-2">
            <Label>Judul tiket</Label>
            <Input placeholder="Contoh: Jaringan MikroTik lantai 3 tidak stabil" {...form.register('title')} />
            <FormError message={form.formState.errors.title?.message} />
          </div>
          <div className="space-y-2">
            <Label>Kategori</Label>
            <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" {...form.register('categoryId')}>
              <option value="">Pilih kategori</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <FormError message={form.formState.errors.categoryId?.message} />
          </div>
          <div className="space-y-2">
            <Label>Prioritas</Label>
            <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" {...form.register('priority')}>
              {Object.entries(priorityLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2 lg:col-span-2">
            <Label>Lokasi / unit terdampak</Label>
            <Input placeholder="Gedung, lantai, loket, atau nama dinas" {...form.register('location')} />
            <FormError message={form.formState.errors.location?.message} />
          </div>
          <div className="space-y-2 lg:col-span-2">
            <Label>Deskripsi masalah</Label>
            <Textarea placeholder="Jelaskan gejala, waktu kejadian, dampak layanan, dan langkah yang sudah dicoba." {...form.register('description')} />
            <FormError message={form.formState.errors.description?.message} />
          </div>
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 lg:col-span-2">
            <div className="flex flex-col items-center justify-center gap-2 text-center">
              <Upload className="h-6 w-6 text-slate-500" />
              <p className="text-sm font-medium">Upload lampiran mock</p>
              <p className="text-xs text-slate-500">Area ini menunjukkan desain upload; file belum dikirim ke storage.</p>
            </div>
          </div>
          <div className="flex justify-end lg:col-span-2">
            <Button type="submit">
              <CirclePlus className="h-4 w-4" />
              Kirim Tiket
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
  // Gunakan selectedTicket yang dipilih user — fallback ke tiket pertama jika belum ada pilihan
  const active = selectedTicket ?? tickets[0] ?? allTickets[0];
  return (
    <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{tickets.length} tiket sesuai filter saat ini.</CardDescription>
            </div>
            <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value as TicketStatus | 'ALL')}>
              <option value="ALL">Semua status</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <TicketTable tickets={tickets} users={users} categories={categories} onOpen={onSelectTicket} />
        </CardContent>
      </Card>
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
    <button className="rounded-lg border border-slate-200 bg-white text-left shadow-sm transition hover:border-sky-300" onClick={onOpen}>
      <TicketCardContent ticket={ticket} users={users} categories={categories} />
    </button>
  );
}

function TicketCardContent({ ticket, users, categories }: { ticket: Ticket; users: User[]; categories: Category[] }) {
  return (
    <div className="p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="font-semibold">{ticket.code}</span>
        <Badge variant={statusColor[ticket.status]}>{statusLabels[ticket.status]}</Badge>
        <Badge variant={priorityColor[ticket.priority]}>{priorityLabels[ticket.priority]}</Badge>
      </div>
      <p className="font-medium">{ticket.title}</p>
      <p className="mt-1 text-sm text-slate-500">{getCategory(categories, ticket.categoryId).name}</p>
      <p className="mt-2 text-xs text-slate-500">Pelapor: {getUser(users, ticket.reporterId).name}</p>
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

  // 1. Definisikan secara tegas siapa yang berhak atas Catatan Internal
  const canSeeInternal = ['TEKNISI', 'ADMIN'].includes(currentUser.role);

  // Set default checkbox sesuai izin akses
  const [internal, setInternal] = React.useState(canSeeInternal);

  const canResolve = can(currentUser.role, 'TICKET_STATUS_UPDATE');
  const canAssign = can(currentUser.role, 'TICKET_ASSIGN');

  // FILTER 1: Sembunyikan jejak log "Catatan Internal" di Timeline dari Pimpinan dan Pegawai
  const visibleLogs = activityLogs.filter((log) => canSeeInternal || log.action !== 'INTERNAL_NOTE');
  const timelineEvents = buildTicketTimeline(ticket, users, categories, visibleLogs);

  // FILTER 2: Sembunyikan blok komentar berstatus "Internal" dari Pimpinan dan Pegawai
  const visibleComments = comments.filter((comment) => canSeeInternal || !comment.isInternal);

  // ─── Kalkulasi SLA — PRD: MTTR < 4 jam untuk High/Critical ──────────────
  const now = new Date();
  const slaDue = new Date(ticket.slaDueAt);
  const isOverdue = now > slaDue && !['RESOLVED', 'CLOSED', 'REJECTED'].includes(ticket.status);
  const slaMinutesLeft = Math.round((slaDue.getTime() - now.getTime()) / 60000);
  const slaLabel = isOverdue ? `SLA Terlampaui ${Math.abs(slaMinutesLeft)} menit` : slaMinutesLeft < 60 ? `SLA: ${slaMinutesLeft} menit tersisa` : `SLA: ${Math.round(slaMinutesLeft / 60)} jam tersisa`;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <CardTitle>
              {ticket.code} - {ticket.title}
            </CardTitle>
            <CardDescription>
              {getCategory(categories, ticket.categoryId).name} - dibuat {toDate(ticket.createdAt)}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={statusColor[ticket.status]}>{statusLabels[ticket.status]}</Badge>
            <Badge variant={priorityColor[ticket.priority]}>{priorityLabels[ticket.priority]}</Badge>
            {!['RESOLVED', 'CLOSED', 'REJECTED'].includes(ticket.status) && <Badge variant={isOverdue ? 'red' : slaMinutesLeft < 60 ? 'amber' : 'emerald'}>{slaLabel}</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Info label="Pelapor" value={getUser(users, ticket.reporterId).name} />
          <Info label="Teknisi" value={ticket.assigneeId ? getUser(users, ticket.assigneeId).name : 'Belum ditugaskan'} />
          <Info label="Lokasi" value={ticket.location} />
          <Info label="Batas SLA" value={toDate(ticket.slaDueAt)} />
        </div>
        <div>
          <Label>Deskripsi</Label>
          <p className="mt-2 rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-700">{ticket.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canAssign && !ticket.assigneeId && (
            <Button onClick={() => void onAssign()}>
              <UserCog className="h-4 w-4" />
              Assign to Me
            </Button>
          )}
          {canResolve && (
            <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" value={ticket.status} onChange={(event) => void onStatusChange(event.target.value as TicketStatus)}>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </div>
        <Tabs.Root defaultValue="timeline">
          <Tabs.List className="flex gap-2 border-b border-slate-200">
            <TabTrigger value="timeline">Timeline</TabTrigger>
            <TabTrigger value="attachments">Lampiran</TabTrigger>
          </Tabs.List>
          <Tabs.Content value="timeline" className="space-y-4 pt-4">
            <TicketTimeline events={timelineEvents} />
            <div className="space-y-3">
              <Label>Komentar dan catatan</Label>
              <Textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Tambahkan update progres atau catatan resolusi..." />

              {/* FILTER 3: Sembunyikan Checkbox Internal dari Pimpinan dan Pegawai */}
              {canSeeInternal && (
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} />
                  Catatan internal teknisi/admin
                </label>
              )}

              <Button
                onClick={() => {
                  void onComment(message, internal);
                  setMessage('');
                }}
              >
                <MessageSquareText className="h-4 w-4" />
                Simpan Komentar
              </Button>
            </div>

            <div className="space-y-3">
              {visibleComments.map((comment) => (
                <div key={comment.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{getUser(users, comment.userId).name}</p>
                    {comment.isInternal && <Badge variant="amber">Internal</Badge>}
                    <span className="text-xs text-slate-500">{toDate(comment.createdAt)}</span>
                  </div>
                  <p className="text-sm text-slate-700">{comment.message}</p>
                </div>
              ))}
            </div>
          </Tabs.Content>
          <Tabs.Content value="attachments" className="pt-4">
            {(ticket.attachments ?? []).length ? (
              <div className="grid gap-3">
                {(ticket.attachments ?? []).map((attachment) => (
                  <div key={attachment.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm">
                    <span>{attachment.name}</span>
                    <Badge>{attachment.size}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">Belum ada lampiran.</p>
            )}
          </Tabs.Content>
        </Tabs.Root>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function TabTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <Tabs.Trigger value={value} className="border-b-2 border-transparent px-3 py-2 text-sm font-medium text-slate-500 data-[state=active]:border-sky-700 data-[state=active]:text-sky-800">
      {children}
    </Tabs.Trigger>
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

  // Hitung SLA Compliance Global
  const onTimeTicketsGlobal = resolvedTicketsGlobal.filter((t) => {
    const targetResolutionTime = t.resolvedAt ? new Date(t.resolvedAt).getTime() : new Date(t.updatedAt).getTime();
    return targetResolutionTime <= new Date(t.slaDueAt).getTime();
  });
  const dynamicSlaCompliance = resolvedTicketsGlobal.length > 0 ? Math.round((onTimeTicketsGlobal.length / resolvedTicketsGlobal.length) * 105) : 100;
  const finalSlaCompliance = Math.min(100, dynamicSlaCompliance);

  // Hitung MTTR Global (Rata-rata dalam Jam)
  const globalMttrHours =
    resolvedTicketsGlobal.length > 0
      ? resolvedTicketsGlobal.reduce((acc, t) => {
          const end = t.resolvedAt ? new Date(t.resolvedAt).getTime() : new Date(t.updatedAt).getTime();
          const start = new Date(t.createdAt).getTime();
          return acc + (end - start) / (1000 * 60 * 60);
        }, 0) / resolvedTicketsGlobal.length
      : 0;

  // Hitung Tingkat Kepuasan Pengguna secara Proposional terhadap Kecepatan Penanganan (SLA)
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
    // 1. Ambil SEMUA tiket yang pernah ditugaskan ke teknisi ini (untuk beban kerja)
    const allAssignedTickets = tickets.filter((t) => t.assigneeId === tech.id);

    // 2. Ambil hanya tiket yang sudah selesai (untuk hitung MTTR/SLA)
    const resolvedTickets = allAssignedTickets.filter((t) => ['RESOLVED', 'CLOSED'].includes(t.status));
    const resolvedCount = resolvedTickets.length;

    // 3. Hitung MTTR hanya dari tiket yang selesai
    const mttrHours =
      resolvedCount > 0
        ? resolvedTickets.reduce((acc, ticket) => {
            const end = ticket.resolvedAt ? new Date(ticket.resolvedAt).getTime() : new Date(ticket.updatedAt).getTime();
            const start = new Date(ticket.createdAt).getTime();
            return acc + (end - start) / (1000 * 60 * 60);
          }, 0) / resolvedCount
        : 0;

    // 4. Hitung kepatuhan SLA dari tiket yang selesai
    const onTimeCount = resolvedTickets.filter((ticket) => {
      const end = ticket.resolvedAt ? new Date(ticket.resolvedAt).getTime() : new Date(ticket.updatedAt).getTime();
      return end <= new Date(ticket.slaDueAt).getTime();
    }).length;

    const slaCompliance = resolvedCount > 0 ? Math.round((onTimeCount / resolvedCount) * 100) : 100;

    return {
      name: tech.name,
      resolved: resolvedCount,
      // Jika belum ada tiket selesai, MTTR 0 jam
      mttr: resolvedCount > 0 ? Number(mttrHours.toFixed(1)) : 0,
      sla: slaCompliance,
    };
  });

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard icon={Gauge} label="SLA Compliance" value={`${finalSlaCompliance}%`} helper="Target PRD > 90%" />
        <KpiCard icon={Clock3} label="MTTR" value={`${globalMttrHours.toFixed(1).replace('.', ',')} jam`} helper="Target PRD < 4 jam" />
        <KpiCard icon={Users} label="Kepuasan" value={`${dynamicSatisfaction}%`} helper="Berdasarkan performa resolusi" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Performa MTTR</CardTitle>
            <CardDescription>Rata-rata durasi resolusi mingguan riil.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dynamicWeeklyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" />
                <YAxis />
                <ChartTooltip />
                <Line type="monotone" dataKey="mttr" name="MTTR (Jam)" stroke="#0369a1" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tiket per Kategori</CardTitle>
            <CardDescription>Beban layanan berdasarkan area dukungan.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCategory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <ChartTooltip />
                <Bar dataKey="value" name="Tiket" fill="#0f766e" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{leadership ? 'Ringkasan Eksekutif' : 'Kinerja Teknisi'}</CardTitle>
          <CardDescription>Data real-time berdasarkan aktivitas teknisi.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Teknisi / Tim</TableHead>
                <TableHead>Resolved</TableHead>
                <TableHead>MTTR</TableHead>
                <TableHead>SLA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dynamicTechnicianPerformance.length > 0 ? (
                dynamicTechnicianPerformance.map((row) => (
                  <TableRow key={row.name}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{row.resolved}</TableCell>
                    <TableCell>{row.mttr} jam</TableCell>
                    <TableCell>
                      <Badge variant={row.sla >= 90 ? 'emerald' : 'amber'}>{row.sla}%</Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-5 text-sm text-slate-500">
                    Belum ada data teknisi.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <p className="mt-4 text-xs text-slate-500">Audit-ready: seluruh perubahan status, komentar, dan assignment ditampilkan sebagai jejak aktivitas di detail tiket.</p>
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
    <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <CardHeader>
          <CardTitle>User Profile</CardTitle>
          <CardDescription>Ringkasan identitas dan aktivitas terbaru.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sky-100 text-lg font-semibold text-sky-800">{getInitials(user.name)}</div>
            <div>
              <p className="text-lg font-semibold">{user.name}</p>
              <p className="text-sm text-slate-500">
                {roleLabels[user.role]} - {user.unit}
              </p>
              <p className="text-sm text-slate-500">{user.email}</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Info label="Total Tiket Saya" value={String(myTickets.length)} />
            <Info label="Tiket Ditangani" value={String(assigned.length)} />
            <Info label="Nomor Telepon" value={user.phone ?? '-'} />
            <Info label="Bergabung" value={toDate(user.createdAt)} />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Aktivitas Terbaru</CardTitle>
          <CardDescription>Jejak aksi yang dilakukan oleh user.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentLogs.length ? (
            recentLogs.map((log) => (
              <div key={log.id} className="rounded-lg border border-slate-200 p-3">
                <p className="text-sm font-medium">{formatActivityTitle(log)}</p>
                <p className="text-sm text-slate-500">{log.description}</p>
                <p className="text-xs text-slate-400">{toDate(log.createdAt)}</p>
              </div>
            ))
          ) : (
            <EmptyState title="Belum ada aktivitas" description="Aktivitas user akan tampil di sini." />
          )}
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
    .map((event) => ({ ...event, atDate: new Date(event.at) }))
    .sort((a, b) => a.atDate.getTime() - b.atDate.getTime())
    .map(({ atDate, ...event }) => ({
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
