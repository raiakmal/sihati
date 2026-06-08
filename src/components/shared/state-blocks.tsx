import { AlertTriangle, Inbox, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center", className)}>
      <Inbox className="mx-auto mb-3 h-8 w-8 text-slate-400" />
      <p className="font-medium text-slate-900">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingState({
  title = "Memuat data",
  description = "Mohon tunggu sebentar.",
  className,
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-slate-200 bg-white p-8 text-center", className)}>
      <LoaderCircle className="mx-auto mb-3 h-8 w-8 animate-spin text-sky-700" />
      <p className="font-medium text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}

export function ErrorState({
  title = "Terjadi kesalahan",
  description = "Data mock tidak dapat ditampilkan.",
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-red-200 bg-red-50 p-8 text-center", className)}>
      <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-red-600" />
      <p className="font-medium text-red-950">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-red-700">{description}</p>
      {onRetry && (
        <Button className="mt-4" variant="outline" onClick={onRetry}>
          Coba Lagi
        </Button>
      )}
    </div>
  );
}
