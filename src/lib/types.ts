export type RoleType = "PEGAWAI" | "TEKNISI" | "ADMIN" | "PIMPINAN";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type TicketStatus =
  | "OPEN"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "PENDING"
  | "RESOLVED"
  | "CLOSED"
  | "REJECTED";

export type User = {
  id: string;
  username: string;
  password: string;
  name: string;
  email: string;
  role: RoleType;
  unit: string;
  phone?: string;
  createdAt: string;
};

export type Category = {
  id: string;
  name: string;
  description: string;
  ownerTeam: string;
};

export type Attachment = {
  id: string;
  ticketId: string;
  name: string;
  url: string;
  fileType: string;
  size: string;
  createdAt: string;
};

export type Comment = {
  id: string;
  ticketId: string;
  userId: string;
  message: string;
  isInternal: boolean;
  createdAt: string;
};

export type Ticket = {
  id: string;
  code: string;
  title: string;
  description: string;
  priority: Priority;
  status: TicketStatus;
  categoryId: string;
  reporterId: string;
  assigneeId?: string;
  location: string;
  slaDueAt: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  attachments: Attachment[];
};

export type Notification = {
  id: string;
  userId: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

export type ActivityLog = {
  id: string;
  userId: string;
  ticketId?: string;
  module: "AUTH" | "TICKET" | "COMMENT" | "USER" | "CATEGORY" | "SETTINGS";
  action: string;
  description: string;
  createdAt: string;
};
