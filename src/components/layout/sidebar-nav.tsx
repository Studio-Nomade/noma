"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { NAV_FOOTER_ITEMS, NAV_GROUPS, type NavItem } from "@/lib/nav";

const GROUPS_KEY = "noma:sidebar:groups";

function isItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({
  onNavigate,
  isFinance = false,
  collapsed = false,
}: {
  onNavigate?: () => void;
  isFinance?: boolean;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const visibleGroups = NAV_GROUPS.filter(
    (group) => !group.requiresFinance || isFinance,
  );
  const activeGroup = visibleGroups.find(
    (group) =>
      group.children.some((item) => isItemActive(pathname, item.href)) ||
      (group.label === "Finanzas" && pathname === "/finanzas"),
  )?.label;
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const saved = JSON.parse(
        window.localStorage.getItem(GROUPS_KEY) ?? "{}",
      ) as Record<string, boolean>;
      setOpenGroups(activeGroup ? { ...saved, [activeGroup]: true } : saved);
    } catch {
      setOpenGroups(activeGroup ? { [activeGroup]: true } : {});
    }
  }, [activeGroup]);

  function toggleGroup(label: string) {
    setOpenGroups((current) => {
      const next = { ...current, [label]: !current[label] };
      window.localStorage.setItem(GROUPS_KEY, JSON.stringify(next));
      return next;
    });
  }

  if (collapsed) {
    return (
      <nav className="flex flex-1 flex-col items-center gap-1">
        {visibleGroups
          .flatMap((group) => group.children)
          .map((item) => (
            <CollapsedItem
              key={item.href}
              item={item}
              active={isItemActive(pathname, item.href)}
              onNavigate={onNavigate}
            />
          ))}
        <div className="border-border my-2 w-8 border-t" />
        {NAV_FOOTER_ITEMS.map((item) => (
          <CollapsedItem
            key={item.href}
            item={item}
            active={isItemActive(pathname, item.href)}
            onNavigate={onNavigate}
          />
        ))}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col gap-1">
      {visibleGroups.map((group) => {
        const open = openGroups[group.label] ?? group.label === activeGroup;
        const GroupIcon = group.icon;
        return (
          <div key={group.label}>
            <button
              type="button"
              onClick={() => toggleGroup(group.label)}
              aria-expanded={open}
              className="text-muted-foreground hover:bg-accent hover:text-foreground flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors"
            >
              <GroupIcon className="size-4 shrink-0" />
              <span className="flex-1 text-left font-medium">
                {group.label}
              </span>
              <ChevronDown
                className={cn(
                  "size-3.5 transition-transform duration-200",
                  open && "rotate-180",
                )}
              />
            </button>
            <div
              className={cn(
                "grid transition-[grid-template-rows,opacity] duration-200",
                open
                  ? "grid-rows-[1fr] opacity-100"
                  : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="overflow-hidden">
                <div className="ml-5 border-l py-1 pl-2">
                  {group.children.map((item) => (
                    <ExpandedItem
                      key={item.href}
                      item={item}
                      active={isItemActive(pathname, item.href)}
                      onNavigate={onNavigate}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <div className="border-border my-2 border-t" />
      {NAV_FOOTER_ITEMS.map((item) => (
        <ExpandedItem
          key={item.href}
          item={item}
          active={isItemActive(pathname, item.href)}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}

function ExpandedItem({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
        active
          ? "bg-foreground text-background font-medium"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span>{item.label}</span>
    </Link>
  );
}

function CollapsedItem({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            href={item.href}
            onClick={onNavigate}
            aria-label={item.label}
            className={cn(
              "flex size-9 items-center justify-center rounded-lg transition-colors",
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          />
        }
      >
        <Icon className="size-4" />
      </TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}
