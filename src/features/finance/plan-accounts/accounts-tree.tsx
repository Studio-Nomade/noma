import { ChevronRight, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type PlanAccountRow = {
  id: string;
  code: string;
  name: string;
  type: string;
  kind: string;
  description: string | null;
  parentId: string | null;
  serviceId: string | null;
  serviceName: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  INGRESO: "Ingreso",
  COSTO: "Costo",
  GASTO: "Gasto",
  ACTIVO: "Activo",
  PASIVO: "Pasivo",
  PATRIMONIO: "Patrimonio",
};

function AccountNode({
  account,
  childrenByParent,
  depth,
}: {
  account: PlanAccountRow;
  childrenByParent: Map<string | null, PlanAccountRow[]>;
  depth: number;
}) {
  const children = childrenByParent.get(account.id) ?? [];
  const content = (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm">
          <span className="text-muted-foreground mr-2 font-mono text-xs">
            {account.code}
          </span>
          <span className={depth === 0 ? "font-semibold" : "font-medium"}>
            {account.name}
          </span>
        </p>
        {account.description && (
          <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
            {account.description}
          </p>
        )}
        {account.serviceName && (
          <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
            <Link2 className="size-3" />
            Servicio: {account.serviceName}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {account.kind !== "CUENTA" && (
          <Badge variant="secondary">{account.kind.toLocaleLowerCase()}</Badge>
        )}
        <span className="text-muted-foreground text-xs">
          {TYPE_LABELS[account.type] ?? account.type}
        </span>
      </div>
    </div>
  );

  if (children.length === 0) {
    return (
      <li className="border-border border-b last:border-b-0">
        <div className="flex" style={{ paddingLeft: `${depth * 18 + 24}px` }}>
          {content}
        </div>
      </li>
    );
  }

  return (
    <li className="border-border border-b last:border-b-0">
      <details className="group" open={depth === 0}>
        <summary
          className="hover:bg-accent/40 flex cursor-pointer list-none items-center rounded-md pr-2"
          style={{ paddingLeft: `${depth * 18}px` }}
        >
          <ChevronRight className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-90" />
          {content}
        </summary>
        <ul>
          {children.map((child) => (
            <AccountNode
              key={child.id}
              account={child}
              childrenByParent={childrenByParent}
              depth={depth + 1}
            />
          ))}
        </ul>
      </details>
    </li>
  );
}

export function AccountsTree({ accounts }: { accounts: PlanAccountRow[] }) {
  const childrenByParent = new Map<string | null, PlanAccountRow[]>();
  for (const account of accounts) {
    const siblings = childrenByParent.get(account.parentId) ?? [];
    siblings.push(account);
    childrenByParent.set(account.parentId, siblings);
  }
  for (const siblings of childrenByParent.values()) {
    siblings.sort((a, b) =>
      a.code.localeCompare(b.code, "es", { numeric: true }),
    );
  }
  const roots = childrenByParent.get(null) ?? [];

  return roots.length > 0 ? (
    <ul>
      {roots.map((account) => (
        <AccountNode
          key={account.id}
          account={account}
          childrenByParent={childrenByParent}
          depth={0}
        />
      ))}
    </ul>
  ) : (
    <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
      Aún no hay cuentas. Ejecuta el importador o el seed financiero.
    </p>
  );
}
