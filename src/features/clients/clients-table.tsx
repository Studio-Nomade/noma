"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, Trash2, Archive } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import type { Client } from "@/db/schema";
import { closeClient } from "./actions";
import { DeleteClientDialog } from "./delete-client-dialog";

export function ClientsTable({ clients }: { clients: Client[] }) {
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function close(c: Client) {
    startTransition(async () => {
      const res = await closeClient(c.id);
      if (res.ok) {
        toast.success(`"${c.companyName}" marcado como Cerrado`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  const filtered = clients.filter((c) => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return [c.companyName, c.contactName, c.industry, c.email]
      .filter(Boolean)
      .some((v) => v!.toLowerCase().includes(q));
  });

  return (
    <div>
      <div className="relative mb-4 max-w-sm">
        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          placeholder="Buscar cliente…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="border-border bg-card overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs tracking-wide uppercase">
                Empresa
              </TableHead>
              <TableHead className="text-xs tracking-wide uppercase">
                Contacto
              </TableHead>
              <TableHead className="text-xs tracking-wide uppercase">
                Rubro
              </TableHead>
              <TableHead className="text-xs tracking-wide uppercase">
                Estado
              </TableHead>
              <TableHead className="text-right text-xs tracking-wide uppercase">
                Acciones
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => (
              <TableRow
                key={c.id}
                onClick={() => router.push(`/clients/${c.id}`)}
                className="hover:bg-accent/50 cursor-pointer"
              >
                <TableCell className="font-medium">{c.companyName}</TableCell>
                <TableCell className="text-muted-foreground">
                  {c.contactName ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {c.industry ?? "—"}
                </TableCell>
                <TableCell>
                  <StatusBadge value={c.status} size="xs" />
                </TableCell>
                <TableCell>
                  {/* La fila navega al hacer clic: aquí se corta la propagación
                      para que los botones no abran la ficha. */}
                  <div
                    className="flex items-center justify-end gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {c.status !== "Cerrado" && (
                      <button
                        type="button"
                        onClick={() => close(c)}
                        disabled={pending}
                        title="Cerrar cliente (cambia el estado, no borra)"
                        aria-label={`Cerrar ${c.companyName}`}
                        className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-md p-1.5 transition-colors disabled:opacity-50"
                      >
                        <Archive className="size-3.5" />
                      </button>
                    )}
                    <DeleteClientDialog
                      id={c.id}
                      name={c.companyName}
                      trigger={
                        <button
                          type="button"
                          title="Borrar cliente (irreversible)"
                          aria-label={`Borrar ${c.companyName}`}
                          className="text-muted-foreground rounded-md p-1.5 transition-colors hover:bg-[var(--status-red-bg)] hover:text-[var(--status-red)]"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      }
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={5}
                  className="text-muted-foreground py-8 text-center text-sm"
                >
                  Sin resultados para “{query}”.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
