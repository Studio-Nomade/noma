"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { AvatarCircle } from "@/components/shared/avatar-circle";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Brand } from "./brand";
import { PageTransition } from "./page-transition";
import { SidebarNav } from "./sidebar-nav";
import { SignOutButton } from "./sign-out-button";
import { ThemeToggle } from "./theme-toggle";

function SidebarContent({
  email,
  name,
  photoUrl,
  isFinance,
  onNavigate,
  collapsed = false,
  onToggleCollapsed,
}: {
  email?: string;
  name?: string | null;
  photoUrl?: string | null;
  isFinance?: boolean;
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className={collapsed ? "px-3 py-6" : "px-5 py-6"}>
        <Brand collapsed={collapsed} />
      </div>
      <div className="flex-1 overflow-y-auto px-3">
        <SidebarNav
          onNavigate={onNavigate}
          isFinance={isFinance}
          collapsed={collapsed}
        />
      </div>
      <div className="border-border/60 border-t px-3 py-4">
        <div
          className={
            collapsed
              ? "mb-3 flex flex-col items-center gap-1"
              : "mb-3 flex items-center gap-1"
          }
        >
          <ThemeToggle collapsed={collapsed} />
          {onToggleCollapsed && (
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
              className="text-muted-foreground hover:text-foreground hover:glass-hairline flex items-center justify-center rounded-lg p-2 transition-all hover:bg-[var(--glass-bg)]"
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
            </button>
          )}
        </div>
        <div
          className={
            collapsed
              ? "flex flex-col items-center gap-2"
              : "glass-hairline flex items-center gap-2 rounded-xl bg-[var(--glass-bg)] p-2"
          }
        >
          <Link
            href="/profile"
            onClick={onNavigate}
            aria-label="Ver mi perfil"
            className={
              collapsed
                ? "rounded-lg transition-colors hover:opacity-80"
                : "flex min-w-0 flex-1 items-center gap-2.5 rounded-lg transition-colors"
            }
          >
            <AvatarCircle
              name={name || email || "?"}
              photoUrl={photoUrl}
              className="size-8 shrink-0 text-xs"
            />
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-xs font-medium">
                  {name || "Mi perfil"}
                </p>
                {email && (
                  <p className="text-muted-foreground truncate text-[11px]">
                    {email}
                  </p>
                )}
              </div>
            )}
          </Link>
          <SignOutButton iconOnly />
        </div>
      </div>
    </div>
  );
}

export function AppShell({
  email,
  name,
  photoUrl,
  isFinance,
  children,
}: {
  email?: string;
  name?: string | null;
  photoUrl?: string | null;
  isFinance?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(
      window.localStorage.getItem("noma:sidebar:collapsed") === "true",
    );
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      window.localStorage.setItem("noma:sidebar:collapsed", String(!current));
      return !current;
    });
  }

  return (
    <TooltipProvider>
      <div className="flex min-h-screen">
        {/* Sidebar desktop */}
        <aside
          className={
            collapsed
              ? "glass-shell fixed inset-y-0 left-0 z-30 hidden w-20 rounded-none border-y-0 border-l-0 transition-[width] duration-[var(--dur-slow)] ease-[var(--ease-out-expo)] lg:block"
              : "glass-shell fixed inset-y-0 left-0 z-30 hidden w-64 rounded-none border-y-0 border-l-0 transition-[width] duration-[var(--dur-slow)] ease-[var(--ease-out-expo)] lg:block"
          }
        >
          <SidebarContent
            email={email}
            name={name}
            photoUrl={photoUrl}
            isFinance={isFinance}
            collapsed={collapsed}
            onToggleCollapsed={toggleCollapsed}
          />
        </aside>

        {/* Topbar móvil */}
        <header className="glass-shell fixed inset-x-0 top-0 z-20 flex h-14 items-center justify-between rounded-none border-x-0 border-t-0 px-4 lg:hidden">
          <Brand />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              aria-label="Abrir menú"
              className="hover:glass-hairline flex size-10 items-center justify-center rounded-lg transition-all hover:bg-[var(--glass-bg)]"
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="left" className="glass-strong w-64 p-0">
              <SheetTitle className="sr-only">Navegación</SheetTitle>
              <SidebarContent
                email={email}
                name={name}
                photoUrl={photoUrl}
                isFinance={isFinance}
                onNavigate={() => setOpen(false)}
              />
            </SheetContent>
          </Sheet>
        </header>

        {/* Contenido */}
        <main
          className={
            collapsed
              ? "min-w-0 flex-1 transition-[padding] duration-[var(--dur-slow)] ease-[var(--ease-out-expo)] lg:pl-20"
              : "min-w-0 flex-1 transition-[padding] duration-[var(--dur-slow)] ease-[var(--ease-out-expo)] lg:pl-64"
          }
        >
          {/* La transición se acota al contenido: el shell no parpadea. */}
          <PageTransition className="mx-auto max-w-6xl min-w-0 px-4 pt-20 pb-12 sm:px-6 lg:px-8 lg:pt-8">
            {children}
          </PageTransition>
        </main>
      </div>
    </TooltipProvider>
  );
}
