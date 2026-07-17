"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { AREAS } from "@/types/enums";
import type { ProjectListItem } from "./queries";

export function ProjectsTable({ projects }: { projects: ProjectListItem[] }) {
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<string>("all");
  const router = useRouter();

  const filtered = projects.filter((p) => {
    if (area !== "all" && p.area !== area) return false;
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return [p.name, p.clientName, p.nextAction]
      .filter(Boolean)
      .some((v) => v!.toLowerCase().includes(q));
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            placeholder="Buscar proyecto o cliente…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={area} onValueChange={(v) => setArea(v ?? "all")}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las áreas</SelectItem>
            {AREAS.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border-border bg-card overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {[
                "Proyecto",
                "Cliente",
                "Área",
                "Estado",
                "Etapa",
                "Prioridad",
              ].map((h) => (
                <TableHead key={h} className="text-xs tracking-wide uppercase">
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow
                key={p.id}
                onClick={() => router.push(`/projects/${p.id}`)}
                className="hover:bg-accent/50 cursor-pointer"
              >
                <TableCell>
                  <div className="font-medium">{p.name}</div>
                  {p.nextAction && (
                    <div className="text-muted-foreground text-xs">
                      → {p.nextAction}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {p.clientName}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {p.area}
                </TableCell>
                <TableCell>
                  <StatusBadge value={p.status} size="xs" />
                </TableCell>
                <TableCell>
                  <StatusBadge value={p.commercialStage} size="xs" />
                </TableCell>
                <TableCell>
                  <StatusBadge value={p.priority} size="xs" />
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={6}
                  className="text-muted-foreground py-8 text-center text-sm"
                >
                  Sin proyectos que coincidan.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
