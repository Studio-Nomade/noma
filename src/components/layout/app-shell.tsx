"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Brand } from "./brand";
import { SidebarNav } from "./sidebar-nav";
import { SignOutButton } from "./sign-out-button";

function SidebarContent({
  email,
  onNavigate,
}: {
  email?: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 py-6">
        <Brand />
      </div>
      <div className="flex-1 overflow-y-auto px-3">
        <SidebarNav onNavigate={onNavigate} />
      </div>
      <div className="border-border space-y-1 border-t px-5 py-4">
        {email && (
          <p className="text-muted-foreground truncate text-[11px]">{email}</p>
        )}
        <SignOutButton />
      </div>
    </div>
  );
}

export function AppShell({
  email,
  children,
}: {
  email?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar desktop */}
      <aside className="bg-card border-border fixed inset-y-0 left-0 hidden w-56 border-r lg:block">
        <SidebarContent email={email} />
      </aside>

      {/* Topbar móvil */}
      <header className="bg-card border-border fixed inset-x-0 top-0 z-20 flex h-14 items-center justify-between border-b px-4 lg:hidden">
        <Brand />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            aria-label="Abrir menú"
            className="hover:bg-accent rounded-md p-2"
          >
            <Menu className="size-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetTitle className="sr-only">Navegación</SheetTitle>
            <SidebarContent email={email} onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </header>

      {/* Contenido */}
      <main className="flex-1 lg:pl-56">
        <div className="mx-auto max-w-6xl px-6 pt-20 pb-12 lg:px-8 lg:pt-8">
          {children}
        </div>
      </main>
    </div>
  );
}
