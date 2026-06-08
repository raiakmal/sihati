"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Category, Ticket, User } from "@/lib/types";

export function GlobalSearch({
  tickets,
  users,
  categories,
  onTicketSelect,
}: {
  tickets: Ticket[];
  users: User[];
  categories: Category[];
  onTicketSelect: (ticketId: string) => void;
}) {
  const [query, setQuery] = React.useState("");
  const results = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (normalized.length < 2) return [];
    return tickets
      .filter((ticket) =>
        [
          ticket.code,
          ticket.title,
          ticket.description,
          categories.find((category) => category.id === ticket.categoryId)?.name,
          users.find((user) => user.id === ticket.reporterId)?.name,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalized),
      )
      .slice(0, 5);
  }, [categories, query, tickets, users]);

  return (
    <div className="relative flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <Input
        className="pl-9"
        placeholder="Global search: kode, judul, kategori, pelapor..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {results.length > 0 && (
        <div className="absolute left-0 right-0 top-12 z-40 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
          {results.map((ticket) => (
            <button
              key={ticket.id}
              className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50"
              onClick={() => {
                onTicketSelect(ticket.id);
                setQuery("");
              }}
            >
              <span className="font-medium">{ticket.code}</span> {ticket.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
