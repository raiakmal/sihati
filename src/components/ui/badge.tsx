import * as React from "react";
import { cn } from "@/lib/utils";

const variants = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  sky: "bg-sky-100 text-sky-800 ring-sky-200",
  amber: "bg-amber-100 text-amber-800 ring-amber-200",
  emerald: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  red: "bg-red-100 text-red-800 ring-red-200",
  violet: "bg-violet-100 text-violet-800 ring-violet-200",
};

export function Badge({
  className,
  variant = "slate",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: keyof typeof variants }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
