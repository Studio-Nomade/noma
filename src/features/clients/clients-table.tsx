"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
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

export function ClientsTable({ clients }: { clients: Client[] }) {
  const [query, setQuery] = useState("");
  const router = useRouter();

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
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={4}
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
