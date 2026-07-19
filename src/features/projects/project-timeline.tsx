import Link from "next/link";
import {
  Activity,
  Banknote,
  CalendarCheck,
  CircleDollarSign,
  FileCheck2,
  FileText,
  Handshake,
  Mail,
  type LucideIcon,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate } from "@/features/finance/helpers";
import type { ProjectTimelineItem } from "./timeline";

const ICON_BY_KIND: Record<ProjectTimelineItem["kind"], LucideIcon> = {
  lead: Activity,
  brief: CalendarCheck,
  proposal: FileCheck2,
  handoff: Handshake,
  invoice: FileText,
  collection: Mail,
  payment: CircleDollarSign,
  activity: Banknote,
};

function TimelineContent({ item }: { item: ProjectTimelineItem }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium">{item.title}</p>
        {item.badge && <StatusBadge value={item.badge} size="xs" />}
      </div>
      {item.meta && (
        <p className="text-muted-foreground mt-1 text-sm">{item.meta}</p>
      )}
      <time className="text-muted-foreground mt-1.5 block text-xs">
        {formatDate(item.date)}
      </time>
    </>
  );
}

export function ProjectTimeline({ items }: { items: ProjectTimelineItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Aún no hay actividad registrada para este proyecto.
      </p>
    );
  }

  return (
    <ol className="relative space-y-0">
      {items.map((item, index) => {
        const Icon = ICON_BY_KIND[item.kind];
        const contentClass =
          "hover:bg-accent/40 block rounded-lg px-3 py-2.5 transition-colors";
        return (
          <li key={item.id} className="relative flex gap-4 pb-5 last:pb-0">
            {index < items.length - 1 && (
              <span className="bg-border absolute top-8 bottom-0 left-[15px] w-px" />
            )}
            <span className="border-border bg-background relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border">
              <Icon className="text-muted-foreground size-4" />
            </span>
            <div className="min-w-0 flex-1">
              {item.href ? (
                <Link href={item.href} className={contentClass}>
                  <TimelineContent item={item} />
                </Link>
              ) : (
                <div className="px-3 py-2.5">
                  <TimelineContent item={item} />
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
