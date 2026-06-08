import { Badge } from "@/components/ui/badge";

export type TimelineEvent = {
  id: string;
  title: string;
  description: string;
  at: string;
  tone?: "default" | "success" | "warning";
};

export function TicketTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="space-y-4">
      {events.map((event, index) => (
        <div key={event.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="mt-1 h-3 w-3 rounded-full bg-sky-700" />
            {index < events.length - 1 && <div className="mt-2 h-full min-h-8 w-px bg-slate-200" />}
          </div>
          <div className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-950">{event.title}</p>
              <Badge variant={event.tone === "success" ? "emerald" : event.tone === "warning" ? "amber" : "sky"}>
                {event.at}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-slate-600">{event.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
