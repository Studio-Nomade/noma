"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Package, Pencil, Send, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Surface } from "@/components/shared/surface";
import { cn } from "@/lib/utils";
import {
  buildRoadmapPackages,
  sendBacklogToAsana,
  setBacklogStatus,
  updateBacklogItem,
} from "./backlog-actions";
import type { BacklogData } from "./backlog-queries";
import { ungroupItems } from "./grouping-actions";
import { GroupingPanel } from "./grouping-panel";
import {
  BACKLOG_AREAS,
  BACKLOG_DESTINATIONS,
  BACKLOG_ENVIRONMENTS,
  BACKLOG_PRIORITIES,
  BACKLOG_TYPES,
} from "./minutes-schema";

type Item = BacklogData["items"][number];

const STATUS_LABEL: Record<string, string> = {
  propuesta: "Propuesta",
  aprobada: "Aprobada",
  descartada: "Descartada",
  en_asana: "En Asana",
  verificada: "Verificada",
};
const STATUS_TONE: Record<string, string> = {
  propuesta: "amber",
  aprobada: "blue",
  descartada: "slate",
  en_asana: "violet",
  verificada: "emerald",
};
const PRIORITY_TONE: Record<string, string> = {
  Crítica: "red",
  Alta: "amber",
  Media: "blue",
  Normal: "slate",
};
const DESTINATION_LABEL: Record<string, string> = {
  roadmap_en_curso: "Roadmap en curso",
  backlog_general: "Backlog general",
  nuevo: "Nuevo",
  sin_roadmap: "Sin roadmap",
};
const VERDICT_LABEL: Record<string, string> = {
  ya_existe: "Ya existe",
  bug: "Es un bug",
  requiere_desarrollo: "Requiere desarrollo",
  bloqueada: "Bloqueada",
};

const FILTERS = [
  "propuesta",
  "aprobada",
  "en_asana",
  "verificada",
  "descartada",
] as const;

export function BacklogBoard({
  data,
  programId,
  hasAsana,
  next,
}: {
  data: BacklogData;
  programId: string;
  hasAsana: boolean;
  next: { roadmap: number; module: number };
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<string>("propuesta");
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<Item | null>(null);
  const [pending, start] = useTransition();
  const meetingById = useMemo(
    () => new Map(data.meetings.map((m) => [m.id, m])),
    [data.meetings],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const it of data.items) c[it.status] = (c[it.status] ?? 0) + 1;
    return c;
  }, [data.items]);
  const rows = data.items
    .filter((it) => it.status === filter)
    .sort((a, b) =>
      filter === "aprobada" ? groupRank(a).localeCompare(groupRank(b)) : 0,
    );
  const ungrouped = data.items.filter(
    (it) => it.status === "aprobada" && !it.groupedAt,
  );
  // Empaquetada = en un paquete de su mismo roadmap («R76 · …»).
  const packedKeys = new Set(
    data.packages.flatMap((p) =>
      p.itemIds.map((id) => `${id}|${p.title.split(" · ")[0]}`),
    ),
  );
  const toPackage = data.items.filter(
    (it) =>
      ["aprobada", "en_asana"].includes(it.status) &&
      it.groupedAt &&
      it.roadmapCode &&
      !packedKeys.has(`${it.id}|${it.roadmapCode}`),
  );
  const toPackageCodes = [...new Set(toPackage.map((it) => it.roadmapCode!))];
  const selectedRows = rows.filter((r) => selected.includes(r.id));

  function run(
    label: string,
    fn: () => Promise<
      { ok: boolean; error?: string } & Record<string, unknown>
    >,
  ) {
    start(async () => {
      const r = await fn();
      if (!r.ok) {
        toast.error(r.error ?? "No se pudo completar.");
        return;
      }
      toast.success(label);
      setSelected([]);
      router.refresh();
    });
  }

  function approve(ids: string[]) {
    run(`${ids.length} aprobada(s)`, () => setBacklogStatus(ids, "aprobada"));
  }
  function discard(ids: string[]) {
    run(`${ids.length} descartada(s)`, () =>
      setBacklogStatus(ids, "descartada"),
    );
  }
  function reopen(ids: string[]) {
    run("De vuelta a propuesta", () => setBacklogStatus(ids, "propuesta"));
  }
  function toAsana(ids: string[]) {
    start(async () => {
      const r = await sendBacklogToAsana(ids);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(
        `${r.data.created} tarea(s) creadas en Asana${r.data.skipped.length ? ` · sin crear: ${r.data.skipped.join(", ")}` : ""}`,
      );
      setSelected([]);
      router.refresh();
    });
  }
  function ungroup(ids: string[]) {
    run("De vuelta a «por agrupar»", () => ungroupItems(ids));
  }
  function buildPackages() {
    start(async () => {
      const r = await buildRoadmapPackages(programId);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(`Paquetes armados: ${r.data.codes.join(", ")}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => {
              setFilter(f);
              setSelected([]);
            }}
            className={cn(
              "rounded-full px-2.5 py-1",
              filter === f ? "bg-accent font-medium" : "hover:bg-accent/60",
            )}
          >
            {STATUS_LABEL[f]} {counts[f] ? `(${counts[f]})` : ""}
          </button>
        ))}
        <span className="text-muted-foreground ml-auto">
          {selected.length
            ? `${selected.length} seleccionadas`
            : `${rows.length} solicitudes`}
        </span>
      </div>

      {selectedRows.length > 0 && (
        <Surface padding="sm" className="flex flex-wrap items-center gap-2">
          {filter === "propuesta" && (
            <>
              <Button
                size="sm"
                disabled={pending}
                onClick={() => approve(selected)}
              >
                <Check className="size-4" /> Aprobar
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => discard(selected)}
              >
                <X className="size-4" /> Descartar
              </Button>
            </>
          )}
          {filter === "aprobada" && (
            <>
              <Button
                size="sm"
                disabled={pending || !hasAsana}
                onClick={() => toAsana(selected)}
              >
                <Send className="size-4" /> Crear en Asana
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => reopen(selected)}
              >
                Volver a propuesta
              </Button>
            </>
          )}
          {filter === "descartada" && (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => reopen(selected)}
            >
              Volver a propuesta
            </Button>
          )}
        </Surface>
      )}

      {filter === "aprobada" && ungrouped.length > 0 && (
        <GroupingPanel
          programId={programId}
          next={next}
          items={ungrouped.map((it) => ({
            id: it.id,
            code: it.code,
            title: it.title,
            priority: it.priority,
          }))}
        />
      )}

      {["aprobada", "en_asana"].includes(filter) &&
        toPackageCodes.length > 0 && (
          <Surface
            padding="md"
            className="flex flex-wrap items-center gap-3 text-sm"
          >
            <Package className="text-muted-foreground size-4" />
            <span className="flex-1">
              <span className="font-medium">Paquetes para el arquitecto:</span>{" "}
              <span className="text-muted-foreground">
                uno por roadmap ({toPackageCodes.join(", ")}). Claude Code los
                recoge por la API y decide el orden técnico dentro de cada uno.
              </span>
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={buildPackages}
            >
              <Package className="size-4" />
              Armar {toPackageCodes.length} paquete
              {toPackageCodes.length === 1 ? "" : "s"}
            </Button>
          </Surface>
        )}

      <Surface variant="solid" padding="none">
        {rows.length === 0 ? (
          <p className="text-muted-foreground p-6 text-sm">
            No hay solicitudes en «{STATUS_LABEL[filter]}».
          </p>
        ) : (
          <ul className="divide-border divide-y">
            {rows.map((it, idx) => {
              const header =
                filter === "aprobada" &&
                (idx === 0 || groupLabel(rows[idx - 1]) !== groupLabel(it))
                  ? groupLabel(it)
                  : null;
              const meeting = it.meetingId
                ? meetingById.get(it.meetingId)
                : null;
              const selectable = [
                "propuesta",
                "aprobada",
                "descartada",
              ].includes(it.status);
              return (
                <Fragment key={it.id}>
                  {header && (
                    <li className="bg-muted/40 text-muted-foreground px-4 py-1.5 text-xs font-medium">
                      {header}
                    </li>
                  )}
                  <li className="flex items-start gap-3 p-4">
                    {selectable ? (
                      <Checkbox
                        className="mt-1"
                        checked={selected.includes(it.id)}
                        onCheckedChange={(v) =>
                          setSelected((prev) =>
                            v
                              ? [...prev, it.id]
                              : prev.filter((x) => x !== it.id),
                          )
                        }
                      />
                    ) : (
                      <span className="mt-1 size-4" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-sm font-medium">
                          <span className="text-muted-foreground mr-2 font-mono text-xs">
                            {it.code}
                          </span>
                          {it.roadmapCode && (
                            <span className="mr-2 font-mono text-xs">
                              {it.roadmapCode}
                            </span>
                          )}
                          {it.title}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          <Pill tone={PRIORITY_TONE[it.priority] ?? "slate"}>
                            {it.priority}
                          </Pill>
                          <Pill tone={STATUS_TONE[it.status] ?? "slate"}>
                            {STATUS_LABEL[it.status] ?? it.status}
                          </Pill>
                          {it.verdict && (
                            <Pill
                              tone={
                                it.verdict === "bloqueada" ? "red" : "emerald"
                              }
                            >
                              {VERDICT_LABEL[it.verdict] ?? it.verdict}
                            </Pill>
                          )}
                        </div>
                      </div>
                      {it.detail && (
                        <p className="text-muted-foreground mt-1 text-sm">
                          {it.detail}
                        </p>
                      )}
                      {it.verdictNote && (
                        <p className="mt-1 text-sm">
                          <span className="text-muted-foreground">
                            Arquitecto:{" "}
                          </span>
                          {it.verdictNote}
                        </p>
                      )}
                      <p className="text-muted-foreground mt-1.5 text-xs">
                        {[
                          it.area,
                          it.type,
                          it.environment,
                          it.destination
                            ? (DESTINATION_LABEL[it.destination] ??
                              it.destination)
                            : null,
                          it.raisedBy ? `planteó ${it.raisedBy}` : null,
                          meeting
                            ? `${meeting.title} · ${meeting.startsAt.toLocaleDateString("es-CL", { timeZone: "America/Santiago" })}`
                            : null,
                          it.asanaTaskGid ? "en Asana" : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {["propuesta", "aprobada"].includes(it.status) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditing(it)}
                          >
                            <Pencil className="size-3.5" /> Editar
                          </Button>
                        )}
                        {it.status === "propuesta" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={pending}
                              onClick={() => approve([it.id])}
                            >
                              <Check className="size-3.5" /> Aprobar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={pending}
                              onClick={() => discard([it.id])}
                            >
                              <X className="size-3.5" /> Descartar
                            </Button>
                          </>
                        )}
                        {it.status === "aprobada" &&
                          it.groupedAt &&
                          !it.asanaTaskGid && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={pending}
                              onClick={() => ungroup([it.id])}
                            >
                              <Undo2 className="size-3.5" /> Desagrupar
                            </Button>
                          )}
                        {it.status === "aprobada" &&
                          it.groupedAt &&
                          hasAsana && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={pending}
                              onClick={() => toAsana([it.id])}
                            >
                              <Send className="size-3.5" /> Crear en Asana
                            </Button>
                          )}
                        {it.asanaTaskGid && (
                          <a
                            href={`https://app.asana.com/0/0/${it.asanaTaskGid}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-muted-foreground hover:text-foreground self-center text-xs"
                          >
                            Abrir en Asana
                          </a>
                        )}
                      </div>
                    </div>
                  </li>
                </Fragment>
              );
            })}
          </ul>
        )}
      </Surface>

      {data.packages.length > 0 && (
        <Surface padding="lg">
          <h3 className="font-heading mb-3 text-sm font-medium">Paquetes</h3>
          <ul className="divide-border divide-y text-sm">
            {data.packages.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <span>
                  <span className="mr-2 font-mono text-xs">{p.code}</span>
                  {p.title}
                  <span className="text-muted-foreground">
                    {" "}
                    · {p.itemIds.length} solicitudes
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <Pill
                    tone={
                      p.status === "con_resultado"
                        ? "emerald"
                        : p.status === "entregado"
                          ? "blue"
                          : "amber"
                    }
                  >
                    {p.status === "con_resultado"
                      ? "Con resultado"
                      : p.status === "entregado"
                        ? "Entregado"
                        : "Armado"}
                  </Pill>
                  <a
                    href={`/api/dev-tracking/${programId}/paquetes/${p.code}`}
                    className="text-muted-foreground hover:text-foreground text-xs"
                    target="_blank"
                    rel="noreferrer"
                  >
                    YAML
                  </a>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground mt-2 text-xs">
            El enlace YAML exige el token de servicio; desde Claude Code: GET
            con «Authorization: Bearer …».
          </p>
        </Surface>
      )}

      <EditDialog item={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function EditDialog({
  item,
  onClose,
}: {
  item: Item | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!item) return null;
  function onSubmit(fd: FormData) {
    start(async () => {
      const r = await updateBacklogItem({
        id: item!.id,
        title: String(fd.get("title") ?? ""),
        detail: String(fd.get("detail") ?? ""),
        area: String(fd.get("area") ?? "") as
          (typeof BACKLOG_AREAS)[number] | "",
        type: String(fd.get("type") ?? "") as
          (typeof BACKLOG_TYPES)[number] | "",
        environment: String(fd.get("environment") ?? "") as
          (typeof BACKLOG_ENVIRONMENTS)[number] | "",
        priority: String(
          fd.get("priority") ?? "Normal",
        ) as (typeof BACKLOG_PRIORITIES)[number],
        destination: String(fd.get("destination") ?? "") as
          (typeof BACKLOG_DESTINATIONS)[number] | "",
        roadmapCode: String(fd.get("roadmapCode") ?? ""),
        evidence: String(fd.get("evidence") ?? ""),
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Solicitud actualizada");
      onClose();
      router.refresh();
    });
  }
  const sel =
    "border-input bg-background h-9 w-full rounded-md border px-2 text-sm";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{item.code} · Editar solicitud</DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="bl-title">Título</Label>
            <Input
              id="bl-title"
              name="title"
              required
              defaultValue={item.title}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bl-detail">Detalle</Label>
            <Textarea
              id="bl-detail"
              name="detail"
              rows={4}
              defaultValue={item.detail ?? ""}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Área</Label>
              <select
                name="area"
                defaultValue={item.area ?? ""}
                className={sel}
              >
                <option value="">—</option>
                {BACKLOG_AREAS.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <select
                name="type"
                defaultValue={item.type ?? ""}
                className={sel}
              >
                <option value="">—</option>
                {BACKLOG_TYPES.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Entorno</Label>
              <select
                name="environment"
                defaultValue={item.environment ?? ""}
                className={sel}
              >
                <option value="">—</option>
                {BACKLOG_ENVIRONMENTS.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridad</Label>
              <select
                name="priority"
                defaultValue={item.priority}
                className={sel}
              >
                {BACKLOG_PRIORITIES.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Destino</Label>
              <select
                name="destination"
                defaultValue={item.destination ?? ""}
                className={sel}
              >
                <option value="">—</option>
                {BACKLOG_DESTINATIONS.map((a) => (
                  <option key={a} value={a}>
                    {DESTINATION_LABEL[a]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bl-roadmap">Roadmap / módulo</Label>
              <Input
                id="bl-roadmap"
                name="roadmapCode"
                defaultValue={item.roadmapCode ?? ""}
                placeholder="R74 · NDes-006"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bl-evidence">Evidencia</Label>
            <Input
              id="bl-evidence"
              name="evidence"
              defaultValue={item.evidence ?? ""}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Pill({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
      style={{
        color: `var(--status-${tone})`,
        background: `var(--status-${tone}-bg)`,
      }}
    >
      {children}
    </span>
  );
}

function groupLabel(it: Item) {
  if (!it.groupedAt) return "Por agrupar";
  if (it.roadmapCode) return `${it.roadmapCode}`;
  return "Sin roadmap";
}

function groupRank(it: Item) {
  if (!it.groupedAt) return "0";
  if (it.roadmapCode) return `1${it.roadmapCode.padStart(12, "0")}`;
  return "2";
}
