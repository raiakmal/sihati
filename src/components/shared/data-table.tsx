"use client";

import * as React from "react";
import { ArrowDownUp, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "./state-blocks";
import { cn } from "@/lib/utils";

export type DataTableColumn<T> = {
  id: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number;
  filterValue?: (row: T) => string;
  className?: string;
};

export function DataTable<T>({
  data,
  columns,
  getRowId,
  onRowClick,
  renderMobileCard,
  searchPlaceholder = "Filter data...",
  pageSize = 5,
  emptyTitle = "Tidak ada data",
  emptyDescription = "Coba ubah filter atau kata kunci pencarian.",
}: {
  data: T[];
  columns: DataTableColumn<T>[];
  getRowId: (row: T) => string;
  onRowClick?: (row: T) => void;
  renderMobileCard: (row: T) => React.ReactNode;
  searchPlaceholder?: string;
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const [filter, setFilter] = React.useState("");
  const [sortId, setSortId] = React.useState<string | null>(columns.find((column) => column.sortValue)?.id ?? null);
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc");
  const [page, setPage] = React.useState(1);

  const filtered = React.useMemo(() => {
    const normalized = filter.trim().toLowerCase();
    const rows = normalized
      ? data.filter((row) =>
          columns
            .map((column) => column.filterValue?.(row))
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(normalized),
        )
      : data;
    const sortColumn = columns.find((column) => column.id === sortId);
    if (!sortColumn?.sortValue) return rows;
    return [...rows].sort((a, b) => {
      const left = sortColumn.sortValue?.(a) ?? "";
      const right = sortColumn.sortValue?.(b) ?? "";
      const result = typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right));
      return sortDirection === "asc" ? result : -result;
    });
  }, [columns, data, filter, sortDirection, sortId]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  React.useEffect(() => {
    setPage(1);
  }, [filter, sortId, sortDirection]);

  function toggleSort(column: DataTableColumn<T>) {
    if (!column.sortValue) return;
    if (sortId === column.id) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
      return;
    }
    setSortId(column.id);
    setSortDirection("asc");
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          className="pl-9"
          placeholder={searchPlaceholder}
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
      </div>
      {!filtered.length ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((column) => (
                    <TableHead key={column.id} className={column.className}>
                      <button
                        className={cn("inline-flex items-center gap-2", column.sortValue && "hover:text-slate-900")}
                        onClick={() => toggleSort(column)}
                        disabled={!column.sortValue}
                      >
                        {column.header}
                        {column.sortValue && <ArrowDownUp className="h-3 w-3" />}
                      </button>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={getRowId(row)}
                    className={cn(onRowClick && "cursor-pointer")}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map((column) => (
                      <TableCell key={column.id} className={column.className}>
                        {column.cell(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="grid gap-3 md:hidden">
            {rows.map((row) => (
              <Card key={getRowId(row)} className={cn("p-0", onRowClick && "cursor-pointer")} onClick={() => onRowClick?.(row)}>
                {renderMobileCard(row)}
              </Card>
            ))}
          </div>
          <div className="flex flex-col justify-between gap-3 text-sm text-slate-500 sm:flex-row sm:items-center">
            <span>
              Menampilkan {rows.length} dari {filtered.length} data
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage === 1}>
                <ChevronLeft className="h-4 w-4" />
                Sebelumnya
              </Button>
              <span>
                {currentPage}/{totalPages}
              </span>
              <Button variant="outline" size="sm" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={currentPage === totalPages}>
                Berikutnya
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
