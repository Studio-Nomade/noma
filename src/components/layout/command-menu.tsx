"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Building2,
  FilePlus2,
  FileText,
  FolderKanban,
  Landmark,
  Mail,
  Network,
  type LucideIcon,
} from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  searchEntities,
  type SearchEntityResult,
} from "@/features/search/actions";

type QuickAction = {
  label: string;
  href: string;
  icon: LucideIcon;
  shortcut?: string;
  finance?: boolean;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "Nueva oportunidad",
    href: "/pipeline",
    icon: FilePlus2,
    shortcut: "Pipeline",
  },
  { label: "Ir a Pipeline", href: "/pipeline", icon: Network },
  { label: "Ir a Clientes", href: "/clients", icon: Building2 },
  {
    label: "Importar cartola",
    href: "/finanzas/importar",
    icon: Landmark,
    finance: true,
  },
  {
    label: "Enviar cobranza",
    href: "/finanzas/cobranza",
    icon: Mail,
    finance: true,
  },
  {
    label: "Ver reportes",
    href: "/finanzas/reportes",
    icon: BarChart3,
    finance: true,
  },
  {
    label: "Ir al Plan de cuentas",
    href: "/finanzas/plan-cuentas",
    icon: BookOpen,
    finance: true,
  },
];

const RESULT_GROUPS: Array<{
  type: SearchEntityResult["type"];
  label: string;
  icon: LucideIcon;
}> = [
  { type: "client", label: "Clientes", icon: Building2 },
  { type: "project", label: "Proyectos", icon: FolderKanban },
  { type: "invoice", label: "Facturas", icon: FileText },
  {
    type: "finance-contact",
    label: "Contactos financieros",
    icon: Landmark,
  },
];

export function CommandMenu({ isFinance }: { isFinance: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchEntityResult[]>([]);
  const [searching, setSearching] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const normalized = query.trim();
    const currentRequest = ++requestId.current;

    if (normalized.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timeout = window.setTimeout(async () => {
      try {
        const nextResults = await searchEntities(normalized);
        if (requestId.current === currentRequest) setResults(nextResults);
      } catch {
        if (requestId.current === currentRequest) setResults([]);
      } finally {
        if (requestId.current === currentRequest) setSearching(false);
      }
    }, 200);

    return () => window.clearTimeout(timeout);
  }, [query]);

  const actions = useMemo(
    () => QUICK_ACTIONS.filter((action) => isFinance || !action.finance),
    [isFinance],
  );

  const navigate = (href: string) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(href);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Buscar en Noma"
      description="Busca clientes, proyectos y acciones rápidas."
      className="sm:max-w-xl"
    >
      <Command shouldFilter={false}>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Buscar clientes, proyectos o acciones…"
        />
        <CommandList>
          <CommandGroup heading="Acciones">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <CommandItem
                  key={`${action.label}-${action.href}`}
                  value={`${action.label} ${action.href}`}
                  onSelect={() => navigate(action.href)}
                >
                  <Icon />
                  <span>{action.label}</span>
                  {action.shortcut && (
                    <CommandShortcut>{action.shortcut}</CommandShortcut>
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>

          <CommandSeparator />

          {RESULT_GROUPS.map((group) => {
            const groupedResults = results.filter(
              (result) => result.type === group.type,
            );
            if (groupedResults.length === 0) return null;
            const Icon = group.icon;
            return (
              <CommandGroup key={group.type} heading={group.label}>
                {groupedResults.map((result) => (
                  <CommandItem
                    key={`${result.type}-${result.href}-${result.label}`}
                    value={`${result.label} ${result.sub ?? ""}`}
                    onSelect={() => navigate(result.href)}
                  >
                    <Icon />
                    <div className="min-w-0">
                      <p className="truncate">{result.label}</p>
                      {result.sub && (
                        <p className="text-muted-foreground truncate text-xs">
                          {result.sub}
                        </p>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}

          {searching && (
            <p className="text-muted-foreground px-3 py-6 text-center text-sm">
              Buscando…
            </p>
          )}
          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <p className="text-muted-foreground px-3 py-6 text-center text-sm">
              Sin resultados para “{query.trim()}”.
            </p>
          )}
          {query.trim().length < 2 && (
            <p className="text-muted-foreground px-3 py-3 text-xs">
              Escribe al menos 2 caracteres para buscar registros.
            </p>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
