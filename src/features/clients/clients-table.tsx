"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, Search, Trash2 } from "lucide-react";
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
import { InlineStatusSelect } from "@/components/shared/inline-status-select";
import { DataPagination } from "@/components/shared/data-pagination";
import { usePagination } from "@/hooks/use-pagination";
import {
  SortButton,
  type SortDirection,
} from "@/components/shared/sort-button";
import type { Client } from "@/db/schema";
import { CLIENT_STATUSES, type ClientStatus } from "@/types/enums";
import { closeClient, setClientStatus } from "./actions";
import { DeleteClientDialog } from "./delete-client-dialog";

type ClientSortKey = "companyName" | "contactName" | "industry" | "status";

function compareValues(a: unknown, b: unknown) {
  return String(a ?? "").localeCompare(String(b ?? ""), "es", {
    numeric: true,
    sensitivity: "base",
  });
}

export function ClientsTable({ clients }: { clients: Client[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sortKey, setSortKey] = useState<ClientSortKey>("companyName");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function close(client: Client) {
    startTransition(async () => {
      const result = await closeClient(client.id);
      if (result.ok) {
        toast.success(`“${client.companyName}” marcado como Cerrado`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const filtered = useMemo(() => {
    const normalizedQuery = query.toLowerCase().trim();
    return clients
      .filter((client) => {
        if (status !== "all" && client.status !== status) return false;
        if (!normalizedQuery) return true;
        return [
          client.companyName,
          client.contactName,
          client.industry,
          client.email,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedQuery));
      })
      .sort((a, b) => {
        const comparison = compareValues(a[sortKey], b[sortKey]);
        return sortDirection === "asc" ? comparison : -comparison;
      });
  }, [clients, query, sortDirection, sortKey, status]);
  const pagination = usePagination(filtered, "noma:clients:page-size");

  function sortBy(key: ClientSortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }

  const headers: Array<{ key: ClientSortKey; label: string }> = [
    { key: "companyName", label: "Empresa" },
    { key: "contactName", label: "Contacto" },
    { key: "industry", label: "Rubro" },
    { key: "status", label: "Estado" },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-64 flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            placeholder="Buscar cliente…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={status}
          onValueChange={(next) => setStatus(next ?? "all")}
        >
          <SelectTrigger
            size="sm"
            aria-label="Filtrar clientes por estado"
            className="min-w-44"
          >
            <SelectValue>
              {status === "all" ? "Todos los estados" : status}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {CLIENT_STATUSES.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border-border bg-card overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {headers.map((header) => (
                <TableHead key={header.key}>
                  <SortButton
                    label={header.label}
                    active={sortKey === header.key}
                    direction={sortDirection}
                    onClick={() => sortBy(header.key)}
                  />
                </TableHead>
              ))}
              <TableHead className="text-right text-xs tracking-wide uppercase">
                Acciones
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagination.pageItems.map((client) => (
              <TableRow
                key={client.id}
                onClick={(event) => {
                  if (
                    (event.target as HTMLElement).closest(
                      "button, a, input, [role='combobox'], [data-slot='select-trigger']",
                    )
                  ) {
                    return;
                  }
                  router.push(`/clients/${client.id}`);
                }}
                className="hover:bg-accent/50 cursor-pointer"
              >
                <TableCell className="font-medium">
                  {client.companyName}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {client.contactName ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {client.industry ?? "—"}
                </TableCell>
                <TableCell>
                  <InlineStatusSelect<ClientStatus>
                    entityId={client.id}
                    value={client.status as ClientStatus}
                    options={CLIENT_STATUSES}
                    label={`Estado de ${client.companyName}`}
                    successMessage={(value) =>
                      `Estado del cliente actualizado a “${value}”`
                    }
                    action={setClientStatus}
                  />
                </TableCell>
                <TableCell>
                  <div
                    className="flex items-center justify-end gap-1"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {client.status !== "Cerrado" && (
                      <button
                        type="button"
                        onClick={() => close(client)}
                        disabled={pending}
                        title="Cerrar cliente (cambia el estado, no borra)"
                        aria-label={`Cerrar ${client.companyName}`}
                        className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-md p-1.5 transition-colors disabled:opacity-50"
                      >
                        <Archive className="size-3.5" />
                      </button>
                    )}
                    <DeleteClientDialog
                      id={client.id}
                      name={client.companyName}
                      trigger={
                        <button
                          type="button"
                          title="Borrar cliente (irreversible)"
                          aria-label={`Borrar ${client.companyName}`}
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
                  Sin clientes que coincidan.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataPagination
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={pagination.total}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
      />
    </div>
  );
}
