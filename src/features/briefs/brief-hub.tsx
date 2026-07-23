"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarPlus,
  Video,
  Sparkles,
  Trash2,
  CheckCircle2,
  Lock,
  FileSearch,
  Download,
  FileSignature,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";
import {
  AREAS,
  AREA_LABELS,
  BRIEF_GENERAL_FIELDS,
  NOTE_SOURCE_LABELS,
  type Area,
  type NoteSource,
} from "@/types/enums";
import { BRIEF_FIELDS_BY_AREA } from "./fields";
import { ScheduleMeetingDialog } from "./schedule-meeting-dialog";
import {
  CreateFromBriefDialog,
  type ServiceOption,
} from "@/features/proposals/create-from-brief-dialog";
import {
  importNotes,
  processNotes,
  saveBriefContent,
  approveBrief,
  deleteNote,
} from "./hub-actions";
import {
  searchGeminiNotes,
  associateDriveNote,
  readNoteFromDrive,
} from "./drive-actions";

type NoteCandidate = {
  fileId: string;
  name: string;
  webViewLink: string | null;
  modifiedTime: string;
  score: number;
  reasons: string[];
};

// ── Tipos serializados que entrega el server ─────────────────
export type BriefHubData = {
  projectId: string;
  projectName: string;
  clientName: string;
  mainArea: Area;
  status: string;
  general: Record<string, string>;
  areaBlocks: Record<string, Record<string, string>>;
  involvedAreas: Area[];
  commercialRecs: string;
  risks: string;
  nextSteps: string;
  aiExtraction: {
    executiveSummary?: string;
    closeProbability?: number;
    suggestedServices?: string[];
    engine?: string;
  } | null;
  approved: { at: string | null; by: string | null };
  meetings: {
    id: string;
    title: string;
    startsAt: string | null;
    durationMin: number;
    meetLink: string | null;
  }[];
  notes: {
    id: string;
    source: NoteSource;
    fileName: string | null;
    driveUrl: string | null;
    rawText: string | null;
    importedByEmail: string | null;
    createdAt: string;
  }[];
  versions: {
    id: string;
    version: number;
    approvedByEmail: string | null;
    approvedAt: string | null;
  }[];
  teamMembers: { id: string; name: string }[];
  contacts: { name: string | null; email: string }[];
  catalogServices: ServiceOption[];
  suggestedServices: string[];
};

const STEPS = [
  "Reunión",
  "Notas",
  "Brief general",
  "Brief por área",
  "Revisión",
  "Crear propuesta",
] as const;

export function BriefHub({ data }: { data: BriefHubData }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState(data.status);
  const [busy, setBusy] = useState(false);

  // Estado editable del brief.
  const [general, setGeneral] = useState<Record<string, string>>(data.general);
  const [areaBlocks, setAreaBlocks] = useState(data.areaBlocks);
  const [involved, setInvolved] = useState<Area[]>(data.involvedAreas);
  const [commercialRecs, setCommercialRecs] = useState(data.commercialRecs);
  const [risks, setRisks] = useState(data.risks);
  const [nextSteps, setNextSteps] = useState(data.nextSteps);

  // Import de notas.
  const [noteSource, setNoteSource] = useState<NoteSource>("paste");
  const [noteText, setNoteText] = useState("");
  const [noteLink, setNoteLink] = useState("");
  const [noteFileName, setNoteFileName] = useState("");

  // Matching de notas Gemini (Drive).
  const [candidates, setCandidates] = useState<NoteCandidate[]>([]);
  const [searchMsg, setSearchMsg] = useState<string | null>(null);

  const approved = status === "Brief aprobado";
  const hasNotesText = data.notes.some((n) => n.rawText);

  function areaBlockValue(area: Area, key: string) {
    return areaBlocks[area]?.[key] ?? "";
  }
  function setAreaBlockValue(area: Area, key: string, val: string) {
    setAreaBlocks((prev) => ({
      ...prev,
      [area]: { ...(prev[area] ?? {}), [key]: val },
    }));
  }

  async function save() {
    setBusy(true);
    const res = await saveBriefContent(data.projectId, {
      general,
      areaBlocks,
      involvedAreas: involved,
      commercialRecs,
      risks,
      nextSteps,
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Brief guardado");
      if (status === "Brief sugerido") setStatus("Brief en revisión");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function onImport() {
    setBusy(true);
    const res = await importNotes(data.projectId, {
      source: noteSource,
      rawText:
        noteSource === "paste" || noteSource === "file" ? noteText : undefined,
      driveUrl: noteSource === "link" ? noteLink : undefined,
      fileName: noteSource === "file" ? noteFileName : undefined,
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Notas importadas");
      setNoteText("");
      setNoteLink("");
      setNoteFileName("");
      setStatus("Notas importadas");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function onProcess() {
    setBusy(true);
    setStatus("Procesando notas");
    const res = await processNotes(data.projectId);
    setBusy(false);
    if (res.ok) {
      toast.success("Brief sugerido generado");
      setStatus("Brief sugerido");
      router.refresh();
    } else {
      setStatus(data.status);
      toast.error(res.error);
    }
  }

  async function onApprove() {
    setBusy(true);
    const res = await approveBrief(data.projectId);
    setBusy(false);
    if (res.ok) {
      toast.success("Brief aprobado");
      setStatus("Brief aprobado");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function onDeleteNote(id: string) {
    const res = await deleteNote(id, data.projectId);
    if (res.ok) router.refresh();
    else toast.error(res.error);
  }

  async function onSearchGemini() {
    setBusy(true);
    setSearchMsg(null);
    setCandidates([]);
    const res = await searchGeminiNotes(data.projectId);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const d = res.data;
    if (!d.connected) {
      setSearchMsg(
        (d.reason ?? "Google Drive no está conectado.") +
          " Cierra sesión y vuelve a entrar para activar la búsqueda.",
      );
      return;
    }
    if (d.status === "not_found") {
      setSearchMsg("No se encontraron documentos de notas para esta reunión.");
      return;
    }
    if (d.status === "auto" && d.candidates[0]) {
      // Alta confianza: asocia automáticamente el documento top.
      await onAssociate(d.candidates[0], true);
      return;
    }
    setCandidates(d.candidates);
    setSearchMsg("Posibles notas encontradas. Confirma cuál asociar.");
  }

  async function onAssociate(c: NoteCandidate, auto = false) {
    setBusy(true);
    const res = await associateDriveNote(data.projectId, {
      fileId: c.fileId,
      url: c.webViewLink ?? undefined,
      auto,
    });
    setBusy(false);
    if (res.ok) {
      toast.success(auto ? "Notas encontradas y asociadas" : "Nota asociada");
      setCandidates([]);
      setSearchMsg(null);
      setStatus("Notas importadas");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function onReadFromDrive(noteId: string) {
    setBusy(true);
    const res = await readNoteFromDrive(noteId, data.projectId);
    setBusy(false);
    if (res.ok) {
      toast.success("Contenido leído desde Drive");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  function readFile(file: File) {
    setNoteFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setNoteText(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  return (
    <div>
      {/* Stepper */}
      <div className="mb-6 flex flex-wrap items-center gap-1.5">
        {STEPS.map((label, i) => (
          <button
            key={label}
            onClick={() => setStep(i)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              step === i
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-accent",
            )}
          >
            <span
              className={cn(
                "flex size-4 items-center justify-center rounded-full text-[10px]",
                step === i ? "bg-background/20" : "bg-muted",
              )}
            >
              {i + 1}
            </span>
            {label}
          </button>
        ))}
        <div className="ml-auto">
          <StatusBadge value={status} />
        </div>
      </div>

      <div className="glass rounded-xl p-6">
        {/* ── Paso 1: Reunión ── */}
        {step === 0 && (
          <div className="space-y-4">
            <StepHeader
              title="Reunión de brief"
              desc="Agenda el levantamiento inicial. Con Google Calendar conectado se crea el evento con link de Meet."
            />
            {data.meetings.length > 0 ? (
              <ul className="space-y-2.5">
                {data.meetings.map((m) => (
                  <li
                    key={m.id}
                    className="border-border flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{m.title}</p>
                      <p className="text-muted-foreground text-xs">
                        {m.startsAt
                          ? new Date(m.startsAt).toLocaleString("es-CL", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : "Sin fecha"}{" "}
                        · {m.durationMin} min
                      </p>
                    </div>
                    {m.meetLink && (
                      <a
                        href={m.meetLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--status-emerald)]"
                      >
                        <Video className="size-3.5" /> Abrir Meet
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">
                Aún no hay reuniones agendadas.
              </p>
            )}
            <ScheduleMeetingDialog
              projectId={data.projectId}
              projectName={data.projectName}
              defaultArea={data.mainArea}
              teamMembers={data.teamMembers}
              contacts={data.contacts}
              trigger={
                <Button variant="outline">
                  <CalendarPlus className="size-4" /> Agendar reunión de brief
                </Button>
              }
            />
          </div>
        )}

        {/* ── Paso 2: Notas ── */}
        {step === 1 && (
          <div className="space-y-5">
            <StepHeader
              title="Notas de la reunión"
              desc="Pega las notas de Gemini, un enlace de Drive o carga un archivo de texto. Luego procésalas con IA."
            />
            <div className="flex gap-2">
              {(["paste", "link", "file"] as NoteSource[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setNoteSource(s)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-medium",
                    noteSource === s
                      ? "border-foreground bg-accent"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {NOTE_SOURCE_LABELS[s]}
                </button>
              ))}
            </div>

            {noteSource === "paste" && (
              <Textarea
                rows={6}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Pega aquí el texto de las notas de la reunión…"
              />
            )}
            {noteSource === "link" && (
              <div className="space-y-2">
                <Input
                  value={noteLink}
                  onChange={(e) => setNoteLink(e.target.value)}
                  placeholder="https://docs.google.com/document/d/…"
                />
                <p className="text-muted-foreground text-xs">
                  Al importar un enlace, usa “Leer desde Drive” en la lista para
                  traer el contenido y poder procesarlo con IA.
                </p>
              </div>
            )}
            {noteSource === "file" && (
              <div className="space-y-2">
                <Input
                  type="file"
                  accept=".txt,.md,.csv,.vtt"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) readFile(f);
                  }}
                />
                {noteFileName && (
                  <p className="text-muted-foreground text-xs">
                    {noteFileName} · {noteText.length} caracteres leídos
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={onImport} disabled={busy} variant="outline">
                Importar notas
              </Button>
              <Button
                onClick={onSearchGemini}
                disabled={busy}
                variant="outline"
              >
                <FileSearch className="size-4" />
                Buscar notas Gemini
              </Button>
              <Button onClick={onProcess} disabled={busy || !hasNotesText}>
                <Sparkles className="size-4" />
                {data.aiExtraction ? "Reprocesar notas" : "Procesar notas"}
              </Button>
            </div>

            {searchMsg && (
              <p className="text-muted-foreground border-border rounded-lg border border-dashed p-3 text-xs">
                {searchMsg}
              </p>
            )}

            {candidates.length > 0 && (
              <ul className="space-y-2">
                {candidates.map((c) => (
                  <li
                    key={c.fileId}
                    className="border-border flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="text-muted-foreground text-xs">
                        Coincidencia {c.score}% · {c.reasons.join(", ")}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => onAssociate(c)}
                      disabled={busy}
                    >
                      Asociar
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {data.notes.length > 0 && (
              <ul className="space-y-2 pt-2">
                {data.notes.map((nt) => (
                  <li
                    key={nt.id}
                    className="border-border rounded-lg border p-3 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">
                        {NOTE_SOURCE_LABELS[nt.source]}
                        {nt.fileName ? ` · ${nt.fileName}` : ""}
                      </span>
                      <button
                        onClick={() => onDeleteNote(nt.id)}
                        className="text-muted-foreground hover:text-[var(--status-red)]"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    {nt.driveUrl && (
                      <a
                        href={nt.driveUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-[var(--status-blue)] underline"
                      >
                        {nt.driveUrl}
                      </a>
                    )}
                    {nt.rawText ? (
                      <p className="text-muted-foreground mt-1 line-clamp-3 text-xs">
                        {nt.rawText}
                      </p>
                    ) : (
                      nt.driveUrl && (
                        <button
                          onClick={() => onReadFromDrive(nt.id)}
                          disabled={busy}
                          className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--status-blue)]"
                        >
                          <Download className="size-3.5" />
                          Leer desde Drive
                        </button>
                      )
                    )}
                    <p className="text-muted-foreground/70 mt-1 text-[10px]">
                      {nt.importedByEmail} ·{" "}
                      {new Date(nt.createdAt).toLocaleDateString("es-CL")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ── Paso 3: Brief general ── */}
        {step === 2 && (
          <div className="space-y-4">
            <StepHeader
              title="Brief general"
              desc="Bloque común a toda oportunidad. La IA lo pre-rellena; edítalo libremente."
            />
            <div className="grid gap-4">
              {BRIEF_GENERAL_FIELDS.map((f) => (
                <div key={f.key} className="grid gap-1.5">
                  <Label>{f.label}</Label>
                  <Textarea
                    rows={2}
                    value={general[f.key] ?? ""}
                    onChange={(e) =>
                      setGeneral((p) => ({ ...p, [f.key]: e.target.value }))
                    }
                    disabled={approved}
                  />
                </div>
              ))}
            </div>
            {!approved && <SaveBar onSave={save} busy={busy} />}
          </div>
        )}

        {/* ── Paso 4: Brief por área ── */}
        {step === 3 && (
          <div className="space-y-6">
            <StepHeader
              title="Brief por área"
              desc="Preguntas específicas del área principal y de las áreas involucradas."
            />

            <div className="grid gap-1.5">
              <Label>Áreas involucradas (además de {data.mainArea})</Label>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {AREAS.filter((a) => a !== data.mainArea).map((a) => (
                  <label
                    key={a}
                    className="flex cursor-pointer items-center gap-1.5 text-sm"
                  >
                    <Checkbox
                      checked={involved.includes(a)}
                      disabled={approved}
                      onCheckedChange={() =>
                        setInvolved((p) =>
                          p.includes(a) ? p.filter((x) => x !== a) : [...p, a],
                        )
                      }
                    />
                    {a}
                  </label>
                ))}
              </div>
            </div>

            {[data.mainArea, ...involved].map((area) => (
              <div key={area} className="space-y-3">
                <h3 className="font-heading border-border border-b pb-1.5 text-sm font-medium">
                  {AREA_LABELS[area]}
                  {area === data.mainArea && (
                    <span className="text-muted-foreground ml-2 text-xs font-normal">
                      (principal)
                    </span>
                  )}
                </h3>
                <div className="grid gap-3">
                  {BRIEF_FIELDS_BY_AREA[area].map((f) => (
                    <div key={f.key} className="grid gap-1.5">
                      <Label className="text-xs">{f.label}</Label>
                      <Textarea
                        rows={f.multiline ? 2 : 1}
                        value={areaBlockValue(area, f.key)}
                        onChange={(e) =>
                          setAreaBlockValue(area, f.key, e.target.value)
                        }
                        disabled={approved}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {!approved && <SaveBar onSave={save} busy={busy} />}
          </div>
        )}

        {/* ── Paso 5: Revisión y aprobación ── */}
        {step === 4 && (
          <div className="space-y-5">
            <StepHeader
              title="Revisión y aprobación"
              desc="Revisa el brief sugerido, ajústalo y apruébalo para habilitar la propuesta."
            />

            {data.aiExtraction && (
              <div className="border-border bg-muted/30 rounded-lg border p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold tracking-wide uppercase">
                    Resumen IA
                  </span>
                  <span className="text-muted-foreground text-xs">
                    Motor: {data.aiExtraction.engine ?? "mock"} · Prob. cierre{" "}
                    {data.aiExtraction.closeProbability ?? "—"}%
                  </span>
                </div>
                <p className="text-sm">{data.aiExtraction.executiveSummary}</p>
                {!!data.aiExtraction.suggestedServices?.length && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {data.aiExtraction.suggestedServices.map((sv) => (
                      <span
                        key={sv}
                        className="bg-background rounded-full border px-2 py-0.5 text-xs"
                      >
                        {sv}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-4">
              <FieldBlock
                label="Recomendaciones comerciales"
                value={commercialRecs}
                onChange={setCommercialRecs}
                disabled={approved}
              />
              <FieldBlock
                label="Pendientes"
                value={general.pendingInfo ?? ""}
                onChange={(v) => setGeneral((p) => ({ ...p, pendingInfo: v }))}
                disabled={approved}
              />
              <FieldBlock
                label="Riesgos"
                value={risks}
                onChange={setRisks}
                disabled={approved}
              />
              <FieldBlock
                label="Próximos pasos"
                value={nextSteps}
                onChange={setNextSteps}
                disabled={approved}
              />
            </div>

            {!approved ? (
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={save} disabled={busy}>
                  Guardar cambios
                </Button>
                <Button onClick={onApprove} disabled={busy}>
                  <CheckCircle2 className="size-4" /> Aprobar brief
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg bg-[var(--status-emerald-bg)] px-4 py-2.5 text-sm text-[var(--status-emerald)]">
                <CheckCircle2 className="size-4" />
                Brief aprobado
                {data.approved.by ? ` por ${data.approved.by}` : ""}
                {data.approved.at
                  ? ` · ${new Date(data.approved.at).toLocaleDateString("es-CL")}`
                  : ""}
              </div>
            )}

            {data.versions.length > 0 && (
              <div className="pt-2">
                <p className="text-muted-foreground mb-1.5 text-xs font-medium uppercase">
                  Historial de versiones
                </p>
                <ul className="space-y-1 text-xs">
                  {data.versions.map((v) => (
                    <li key={v.id} className="text-muted-foreground">
                      v{v.version} · {v.approvedByEmail ?? "—"} ·{" "}
                      {v.approvedAt
                        ? new Date(v.approvedAt).toLocaleDateString("es-CL")
                        : "—"}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ── Paso 6: Crear propuesta ── */}
        {step === 5 && (
          <div className="space-y-4">
            <StepHeader
              title="Crear propuesta"
              desc="Genera la propuesta a partir del brief aprobado."
            />
            {approved ? (
              <>
                <p className="text-muted-foreground text-sm">
                  El brief está aprobado. La propuesta heredará contexto,
                  objetivo, alcance, observaciones y los servicios sugeridos.
                </p>
                <CreateFromBriefDialog
                  projectId={data.projectId}
                  projectName={data.projectName}
                  suggestedNames={data.suggestedServices}
                  services={data.catalogServices}
                  trigger={
                    <Button>
                      <FileSignature className="size-4" />
                      Crear propuesta desde brief
                    </Button>
                  }
                />
              </>
            ) : (
              <div className="text-muted-foreground flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm">
                <Lock className="size-4" />
                Aprueba el brief (paso 5) para habilitar la creación de
                propuesta.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StepHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div>
      <h2 className="font-heading text-base font-semibold">{title}</h2>
      <p className="text-muted-foreground mt-0.5 text-sm">{desc}</p>
    </div>
  );
}

function SaveBar({ onSave, busy }: { onSave: () => void; busy: boolean }) {
  return (
    <div className="border-border flex justify-end border-t pt-4">
      <Button onClick={onSave} disabled={busy}>
        {busy ? "Guardando…" : "Guardar brief"}
      </Button>
    </div>
  );
}

function FieldBlock({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Textarea
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}
