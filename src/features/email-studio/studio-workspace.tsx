"use client";

import Link from "next/link";
import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Braces,
  Check,
  CircleAlert,
  Code2,
  Download,
  FileImage,
  FileText,
  ImagePlus,
  History,
  Layers3,
  Link2,
  Loader2,
  Mail,
  Monitor,
  Plus,
  RefreshCcw,
  Save,
  Settings2,
  Smartphone,
  Sparkles,
  Trash2,
  Type,
  UploadCloud,
  Variable,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  removeEmailStudioAsset,
  replaceEmailStudioAsset,
  uploadEmailStudioAssets,
  uploadEmailStudioReference,
} from "./asset-actions";
import {
  createEmailStudioTemplate,
  deleteEmailStudioElement,
  deleteEmailStudioVariable,
  insertEmailStudioTemplate,
  moveEmailStudioElement,
  saveEmailStudioElement,
  saveEmailStudioSettings,
  saveEmailStudioVariable,
  setEmailStudioTemplateStatus,
  updateEmailStudioImageElement,
} from "./editor-actions";
import {
  generateEmailStudioDocument,
  restoreEmailStudioRevision,
} from "./generation-actions";
import type { EmailAuditItem } from "./compiler.server";
import { isEmailStudioDocumentCurrent } from "./freshness";
import type { EmailStudioWorkspaceData } from "./project-queries";

type WorkspaceTab = "design" | "structure" | "preview" | "html";
type ViewportMode = "desktop" | "mobile";
type WorkspaceElement = EmailStudioWorkspaceData["elements"][number];
type WorkspaceAsset = EmailStudioWorkspaceData["assets"][number];

type CompiledWorkspace = {
  html: string;
  mjml: string;
  warnings: string[];
  audit: EmailAuditItem[];
} | null;

function ActionFeedback({
  state,
  success,
  onSuccess,
}: {
  state: { ok: boolean; error?: string } | null;
  success: string;
  onSuccess?: () => void;
}) {
  const handledState = useRef<typeof state>(null);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  useEffect(() => {
    if (!state || handledState.current === state) return;
    handledState.current = state;
    if (state.ok) {
      toast.success(success);
      onSuccessRef.current?.();
    } else {
      toast.error(state.error ?? "No se pudo completar la acción.");
    }
  }, [state, success]);
  return null;
}

function UploadForm({
  projectId,
  kind,
}: {
  projectId: string;
  kind: "reference" | "assets";
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const action =
    kind === "reference" ? uploadEmailStudioReference : uploadEmailStudioAssets;
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <ActionFeedback
        state={state}
        success={
          kind === "reference"
            ? "Referencia guardada"
            : "Assets optimizados y publicados"
        }
        onSuccess={() => {
          formRef.current?.reset();
          router.refresh();
        }}
      />
      <input type="hidden" name="projectId" value={projectId} />
      <label className="border-border hover:bg-accent/30 flex cursor-pointer flex-col items-center rounded-xl border border-dashed px-5 py-7 text-center transition-colors">
        {pending ? (
          <Loader2 className="text-primary mb-3 size-6 animate-spin" />
        ) : (
          <UploadCloud className="text-muted-foreground mb-3 size-6" />
        )}
        <span className="text-sm font-medium">
          {kind === "reference"
            ? "Arrastra o selecciona el diseño aprobado"
            : "Adjunta los assets independientes"}
        </span>
        <span className="text-muted-foreground mt-1 text-xs">
          {kind === "reference"
            ? "PNG, JPG, WEBP o PDF · máximo 25 MB"
            : "PNG, JPG o WEBP · hasta 12 archivos, 10 MB c/u y 25 MB total"}
        </span>
        <input
          name={kind === "reference" ? "file" : "files"}
          type="file"
          accept={
            kind === "reference"
              ? ".png,.jpg,.jpeg,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf"
              : ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
          }
          multiple={kind === "assets"}
          className="sr-only"
          required
          disabled={pending}
        />
      </label>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <UploadCloud />}
        {pending
          ? "Procesando…"
          : kind === "reference"
            ? "Guardar referencia"
            : "Optimizar y publicar"}
      </Button>
    </form>
  );
}

function ReplaceAssetForm({ asset }: { asset: WorkspaceAsset }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(
    replaceEmailStudioAsset,
    null,
  );
  return (
    <form ref={formRef} action={action} className="flex items-center gap-2">
      <ActionFeedback
        state={state}
        success="Asset actualizado en todos sus usos"
        onSuccess={() => {
          formRef.current?.reset();
          router.refresh();
        }}
      />
      <input type="hidden" name="assetId" value={asset.id} />
      <label className="border-border hover:bg-muted flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs">
        <RefreshCcw className="size-3.5" />
        Reemplazar
        <input
          type="file"
          name="file"
          accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
          className="sr-only"
          required
          disabled={pending}
          onChange={(event) => {
            if (event.currentTarget.files?.length) {
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
      </label>
      {pending && <Loader2 className="size-3.5 animate-spin" />}
    </form>
  );
}

function AssetCard({
  asset,
  linkedToTemplate,
}: {
  asset: WorkspaceAsset;
  linkedToTemplate: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function remove() {
    startTransition(async () => {
      const result = await removeEmailStudioAsset(asset.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Asset retirado");
      router.refresh();
    });
  }

  return (
    <article className="border-border/70 bg-card/60 overflow-hidden rounded-xl border">
      <div className="bg-muted flex aspect-[4/3] items-center justify-center overflow-hidden">
        {asset.publicUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.publicUrl}
            alt={asset.label}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <FileImage className="text-muted-foreground size-8" />
        )}
      </div>
      <div className="space-y-3 p-3">
        <div>
          <p className="truncate text-sm font-medium">{asset.label}</p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {asset.width && asset.height
              ? `${asset.width} × ${asset.height}px`
              : asset.mimeType}
            {" · "}
            {Math.ceil(asset.sizeBytes / 1024)} KB
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            <Check className="size-3" />
            Optimizado
          </Badge>
          {linkedToTemplate && <Badge variant="outline">En plantilla</Badge>}
        </div>
        <div className="flex items-center justify-between gap-2">
          <ReplaceAssetForm asset={asset} />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={remove}
            disabled={pending}
            aria-label={`Retirar ${asset.label}`}
          >
            {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
          </Button>
        </div>
      </div>
    </article>
  );
}

function SettingsForm({
  project,
}: {
  project: EmailStudioWorkspaceData["project"];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [subject, setSubject] = useState(project.subject);
  const [previewText, setPreviewText] = useState(project.previewText);
  const [emailWidth, setEmailWidth] = useState(project.emailWidth);
  const [canvasColor, setCanvasColor] = useState(project.canvasColor);
  const [bodyColor, setBodyColor] = useState(project.bodyColor);
  const [textColor, setTextColor] = useState(project.textColor);

  function submit(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveEmailStudioSettings({
        projectId: project.id,
        subject,
        previewText,
        emailWidth,
        canvasColor,
        bodyColor,
        textColor,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Configuración guardada");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="glass rounded-xl p-5">
      <div className="flex items-center gap-2">
        <Settings2 className="text-primary size-4" />
        <h2 className="font-medium">Configuración del correo</h2>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="studio-subject">Asunto</Label>
          <Input
            id="studio-subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            maxLength={180}
          />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="studio-preview">Preheader</Label>
          <Input
            id="studio-preview"
            value={previewText}
            onChange={(event) => setPreviewText(event.target.value)}
            placeholder="Texto breve que aparece junto al asunto."
            maxLength={240}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="studio-width">Ancho</Label>
          <Input
            id="studio-width"
            type="number"
            min={560}
            max={720}
            value={emailWidth}
            onChange={(event) => setEmailWidth(Number(event.target.value))}
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            ["Lienzo", canvasColor, setCanvasColor],
            ["Cuerpo", bodyColor, setBodyColor],
            ["Texto", textColor, setTextColor],
          ].map(([label, value, setter]) => (
            <label key={String(label)} className="grid gap-1.5 text-xs">
              <span className="text-muted-foreground">{String(label)}</span>
              <input
                type="color"
                value={String(value)}
                onChange={(event) =>
                  (setter as (value: string) => void)(event.target.value)
                }
                className="border-border h-9 w-full cursor-pointer rounded-md border bg-transparent p-1"
              />
            </label>
          ))}
        </div>
      </div>
      <Button type="submit" className="mt-5" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Save />}
        Guardar configuración
      </Button>
    </form>
  );
}

function ImageElementEditor({
  projectId,
  element,
  position,
  total,
}: {
  projectId: string;
  element: WorkspaceElement;
  position: number;
  total: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState(element.label);
  const [alt, setAlt] = useState(element.alt);
  const [href, setHref] = useState(element.href ?? "");

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <article className="border-border/70 rounded-xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
            {element.type === "template" ? (
              <Layers3 className="size-4" />
            ) : (
              <FileImage className="size-4" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{element.label}</p>
            <p className="text-muted-foreground text-xs">
              {element.type === "template" ? "Plantilla ligada" : "Imagen"}
            </p>
          </div>
        </div>
        <ElementControls
          pending={pending}
          canMoveUp={position > 0}
          canMoveDown={position < total - 1}
          move={(direction) =>
            run(() => moveEmailStudioElement(projectId, element.id, direction))
          }
          remove={() =>
            run(() => deleteEmailStudioElement(projectId, element.id))
          }
        />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`label-${element.id}`}>Nombre interno</Label>
          <Input
            id={`label-${element.id}`}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`alt-${element.id}`}>Texto alternativo</Label>
          <Input
            id={`alt-${element.id}`}
            value={alt}
            onChange={(event) => setAlt(event.target.value)}
          />
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor={`href-${element.id}`}>Enlace clickeable</Label>
          <Input
            id={`href-${element.id}`}
            value={href}
            onChange={(event) => setHref(event.target.value)}
            placeholder="https:// · mailto: · tel: · {{variable_url}}"
          />
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3"
        disabled={pending}
        onClick={() =>
          run(() =>
            updateEmailStudioImageElement({
              projectId,
              id: element.id,
              label,
              alt,
              href,
            }),
          )
        }
      >
        <Save />
        Guardar elemento
      </Button>
    </article>
  );
}

function ElementControls({
  pending,
  canMoveUp,
  canMoveDown,
  move,
  remove,
}: {
  pending: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  move: (direction: "up" | "down") => void;
  remove: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => move("up")}
        disabled={pending || !canMoveUp}
        aria-label="Subir elemento"
      >
        <ArrowUp />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => move("down")}
        disabled={pending || !canMoveDown}
        aria-label="Bajar elemento"
      >
        <ArrowDown />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={remove}
        disabled={pending}
        aria-label="Eliminar elemento"
      >
        {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
      </Button>
    </div>
  );
}

function ContentElementEditor({
  projectId,
  element,
  position,
  total,
  onCreated,
}: {
  projectId: string;
  element?: WorkspaceElement;
  position?: number;
  total: number;
  onCreated?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<"text" | "button" | "spacer">(
    element?.type === "button" || element?.type === "spacer"
      ? element.type
      : "text",
  );
  const [label, setLabel] = useState(element?.label ?? "Nuevo texto");
  const [content, setContent] = useState(
    element?.content ?? (type === "spacer" ? "24" : ""),
  );
  const [href, setHref] = useState(element?.href ?? "");
  const [align, setAlign] = useState<"left" | "center" | "right">(
    element?.align === "right" || element?.align === "center"
      ? element.align
      : "left",
  );
  const [fontSize, setFontSize] = useState(element?.fontSize ?? 16);
  const [color, setColor] = useState(
    element?.color ?? (element?.type === "button" ? "#ffffff" : "#333333"),
  );
  const [backgroundColor, setBackgroundColor] = useState(
    element?.backgroundColor ?? "#111111",
  );

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveEmailStudioElement({
        projectId,
        id: element?.id ?? "",
        type,
        label,
        content,
        href,
        align,
        fontSize,
        color,
        backgroundColor,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(element ? "Elemento actualizado" : "Elemento agregado");
      onCreated?.();
      router.refresh();
    });
  }

  const Icon = type === "button" ? Link2 : type === "spacer" ? Layers3 : Type;

  return (
    <form
      onSubmit={submit}
      className={cn(
        "border-border/70 rounded-xl border p-4",
        !element && "bg-primary/[0.03] border-primary/20",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
            <Icon className="size-4" />
          </div>
          <div>
            <p className="text-sm font-medium">
              {element ? element.label : "Agregar elemento"}
            </p>
            <p className="text-muted-foreground text-xs">
              Texto dinámico, botón real o espacio
            </p>
          </div>
        </div>
        {element && position !== undefined && (
          <ElementControls
            pending={pending}
            canMoveUp={position > 0}
            canMoveDown={position < total - 1}
            move={(direction) =>
              run(() =>
                moveEmailStudioElement(projectId, element.id, direction),
              )
            }
            remove={() =>
              run(() => deleteEmailStudioElement(projectId, element.id))
            }
          />
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {!element && (
          <div className="grid gap-1.5">
            <Label>Tipo</Label>
            <Select
              value={type}
              onValueChange={(value) => {
                const nextType =
                  value === "button" || value === "spacer" ? value : "text";
                setType(nextType);
                setLabel(
                  nextType === "button"
                    ? "Nuevo botón"
                    : nextType === "spacer"
                      ? "Nuevo espacio"
                      : "Nuevo texto",
                );
                setContent(nextType === "spacer" ? "24" : "");
                setHref("");
                setColor(nextType === "button" ? "#ffffff" : "#333333");
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Texto</SelectItem>
                <SelectItem value="button">Botón</SelectItem>
                <SelectItem value="spacer">Espacio</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor={`content-label-${element?.id ?? "new"}`}>
            Nombre interno
          </Label>
          <Input
            id={`content-label-${element?.id ?? "new"}`}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
        </div>
        <div
          className={cn(
            "grid gap-1.5",
            (element || type !== "spacer") && "sm:col-span-2",
          )}
        >
          <Label htmlFor={`content-${element?.id ?? "new"}`}>
            {type === "spacer" ? "Alto en píxeles" : "Contenido"}
          </Label>
          {type === "text" ? (
            <Textarea
              id={`content-${element?.id ?? "new"}`}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={3}
              placeholder="Usa {{nombre}} para textos dinámicos."
            />
          ) : (
            <Input
              id={`content-${element?.id ?? "new"}`}
              type={type === "spacer" ? "number" : "text"}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              min={type === "spacer" ? 1 : undefined}
              max={type === "spacer" ? 200 : undefined}
            />
          )}
        </div>
        {(type === "button" || type === "text") && (
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor={`content-href-${element?.id ?? "new"}`}>
              {type === "button"
                ? "Enlace del botón"
                : "Enlace opcional del texto"}
            </Label>
            <Input
              id={`content-href-${element?.id ?? "new"}`}
              value={href}
              onChange={(event) => setHref(event.target.value)}
              placeholder="https:// · mailto: · tel: · {{variable_url}}"
            />
          </div>
        )}
        {type !== "spacer" && (
          <>
            <div className="grid gap-1.5">
              <Label>Alineación</Label>
              <Select
                value={align}
                onValueChange={(value) =>
                  setAlign(
                    value === "right" || value === "center" ? value : "left",
                  )
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Izquierda</SelectItem>
                  <SelectItem value="center">Centro</SelectItem>
                  <SelectItem value="right">Derecha</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`font-${element?.id ?? "new"}`}>Tamaño</Label>
              <Input
                id={`font-${element?.id ?? "new"}`}
                type="number"
                min={10}
                max={48}
                value={fontSize}
                onChange={(event) => setFontSize(Number(event.target.value))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Color</Label>
              <input
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className="border-border h-9 w-full cursor-pointer rounded-md border bg-transparent p-1"
              />
            </div>
            {type === "button" && (
              <div className="grid gap-1.5">
                <Label>Fondo del botón</Label>
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={(event) => setBackgroundColor(event.target.value)}
                  className="border-border h-9 w-full cursor-pointer rounded-md border bg-transparent p-1"
                />
              </div>
            )}
          </>
        )}
      </div>
      <Button type="submit" size="sm" className="mt-4" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Save />}
        {element ? "Guardar" : "Agregar"}
      </Button>
    </form>
  );
}

function VariablesPanel({
  projectId,
  variables,
}: {
  projectId: string;
  variables: EmailStudioWorkspaceData["variables"];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [sample, setSample] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveEmailStudioVariable({
        projectId,
        key,
        label,
        sample,
        required: true,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Variable guardada");
      setKey("");
      setLabel("");
      setSample("");
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteEmailStudioVariable(projectId, id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="glass rounded-xl p-5">
      <div className="flex items-center gap-2">
        <Variable className="text-primary size-4" />
        <h2 className="font-medium">Variables dinámicas</h2>
      </div>
      <div className="mt-4 space-y-2">
        {variables.map((variable) => (
          <div
            key={variable.id}
            className="border-border/70 flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
          >
            <div className="min-w-0">
              <code className="text-xs">{`{{${variable.key}}}`}</code>
              <p className="text-muted-foreground truncate text-xs">
                {variable.label} · ejemplo: {variable.sample || "—"}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => remove(variable.id)}
              disabled={pending}
              aria-label={`Eliminar variable ${variable.key}`}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        {variables.length === 0 && (
          <p className="text-muted-foreground text-sm">
            Aún no hay variables. Los tokens quedan visibles en el HTML final.
          </p>
        )}
      </div>
      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="variable-key">Clave</Label>
          <Input
            id="variable-key"
            value={key}
            onChange={(event) => setKey(event.target.value)}
            placeholder="nombre"
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="variable-label">Etiqueta</Label>
          <Input
            id="variable-label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Nombre del contacto"
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="variable-sample">Ejemplo</Label>
          <Input
            id="variable-sample"
            value={sample}
            onChange={(event) => setSample(event.target.value)}
            placeholder="María"
          />
        </div>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Plus />}
          Guardar variable
        </Button>
      </form>
    </section>
  );
}

function TemplatesPanel({
  workspace,
}: {
  workspace: EmailStudioWorkspaceData;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const contentAssets = workspace.assets.filter(
    (asset) => asset.role === "asset",
  );
  const [assetId, setAssetId] = useState(contentAssets[0]?.id ?? "");
  const [name, setName] = useState("");
  const [alt, setAlt] = useState("");
  const [href, setHref] = useState("");

  function create(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createEmailStudioTemplate({
        projectId: workspace.project.id,
        assetId,
        name,
        description: "",
        alt,
        href,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Plantilla ligada al asset");
      setName("");
      setAlt("");
      setHref("");
      router.refresh();
    });
  }

  function insert(templateId: string) {
    startTransition(async () => {
      const result = await insertEmailStudioTemplate(
        workspace.project.id,
        templateId,
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Plantilla insertada");
      router.refresh();
    });
  }

  function archive(templateId: string) {
    startTransition(async () => {
      const result = await setEmailStudioTemplateStatus(
        workspace.project.id,
        templateId,
        "archived",
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="glass rounded-xl p-5">
      <div className="flex items-center gap-2">
        <Layers3 className="text-primary size-4" />
        <h2 className="font-medium">Plantillas del cliente</h2>
      </div>
      <p className="text-muted-foreground mt-1 text-sm">
        Guarda footers u otras piezas como assets ligados. Al reemplazar el
        original, sus usos editables reciben una URL versionada nueva; las
        entregas anteriores permanecen intactas.
      </p>

      <div className="mt-4 grid gap-2">
        {workspace.templates
          .filter((template) => template.status === "active")
          .map((template) => (
            <div
              key={template.id}
              className="border-border/70 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium">{template.name}</p>
                <p className="text-muted-foreground text-xs">
                  {template.assetLabel}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => insert(template.id)}
                  disabled={pending}
                >
                  <Plus />
                  Insertar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => archive(template.id)}
                  disabled={pending}
                  aria-label={`Archivar plantilla ${template.name}`}
                >
                  <Archive />
                </Button>
              </div>
            </div>
          ))}
      </div>

      {contentAssets.length > 0 && (
        <form
          onSubmit={create}
          className="border-border/70 mt-5 grid gap-3 border-t pt-4 sm:grid-cols-2"
        >
          <div className="grid gap-1.5 sm:col-span-2">
            <Label>Asset base</Label>
            <Select
              value={assetId}
              onValueChange={(value) => setAssetId(value ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona un asset" />
              </SelectTrigger>
              <SelectContent>
                {contentAssets.map((asset) => (
                  <SelectItem key={asset.id} value={asset.id}>
                    {asset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="template-name">Nombre</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Footer corporativo"
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="template-alt">Texto alternativo</Label>
            <Input
              id="template-alt"
              value={alt}
              onChange={(event) => setAlt(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="template-href">Enlace opcional</Label>
            <Input
              id="template-href"
              value={href}
              onChange={(event) => setHref(event.target.value)}
              placeholder="https:// · {{web_url}}"
            />
          </div>
          <Button
            type="submit"
            variant="outline"
            disabled={pending || !assetId}
          >
            {pending ? <Loader2 className="animate-spin" /> : <Save />}
            Guardar plantilla
          </Button>
        </form>
      )}
    </section>
  );
}

function GenerationButton({
  projectId,
  hasReference,
}: {
  projectId: string;
  hasReference: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function generate(useAi: boolean) {
    startTransition(async () => {
      const result = await generateEmailStudioDocument(projectId, useAi);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.data.mode === "ai"
          ? `Blueprint v${result.data.version} generado con asistencia`
          : `Blueprint v${result.data.version} compilado`,
      );
      if (result.data.warning) toast.warning(result.data.warning);
      router.refresh();
    });
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" onClick={() => generate(true)} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
        {hasReference ? "Generar con asistencia" : "Generar blueprint"}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => generate(false)}
        disabled={pending}
      >
        <Braces />
        Compilar estructura
      </Button>
    </div>
  );
}

function RevisionsPanel({
  projectId,
  revisions,
}: {
  projectId: string;
  revisions: EmailStudioWorkspaceData["revisions"];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function restore(revisionId: string) {
    startTransition(async () => {
      const result = await restoreEmailStudioRevision(projectId, revisionId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Revisión recuperada como versión ${result.data.version}`);
      router.refresh();
    });
  }

  return (
    <section className="glass rounded-xl p-5">
      <div className="flex items-center gap-2">
        <History className="text-primary size-4" />
        <h2 className="font-medium">Historial recuperable</h2>
      </div>
      <p className="text-muted-foreground mt-1 text-sm">
        Cada generación guarda el editor completo. Recuperar una revisión crea
        una versión nueva y conserva el estado actual como respaldo.
      </p>
      <div className="mt-4 space-y-2">
        {revisions.map((revision) => (
          <div
            key={revision.id}
            className="border-border/70 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2"
          >
            <div>
              <p className="text-sm font-medium">{revision.label}</p>
              <p className="text-muted-foreground text-xs">
                Versión {revision.documentVersion} ·{" "}
                {new Intl.DateTimeFormat("es-CL", {
                  dateStyle: "short",
                  timeStyle: "short",
                  timeZone: "America/Santiago",
                }).format(new Date(revision.createdAt))}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => restore(revision.id)}
              disabled={pending}
            >
              {pending ? <Loader2 className="animate-spin" /> : <History />}
              Recuperar
            </Button>
          </div>
        ))}
        {revisions.length === 0 && (
          <p className="text-muted-foreground text-sm">
            El historial aparecerá después de la primera generación.
          </p>
        )}
      </div>
    </section>
  );
}

function ArchivedProjectNotice() {
  return (
    <div className="border-border bg-muted/40 m-5 rounded-xl border p-8 text-center">
      <Archive className="text-muted-foreground mx-auto size-8" />
      <h2 className="mt-3 font-medium">Proyecto en modo lectura</h2>
      <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
        Restaura el proyecto desde el encabezado para modificar su diseño,
        estructura, assets o historial.
      </p>
    </div>
  );
}

function AuditPanel({ items }: { items: EmailAuditItem[] }) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="border-border/70 flex items-start gap-3 rounded-lg border px-3 py-2.5"
        >
          {item.level === "pass" ? (
            <Check className="mt-0.5 size-4 text-emerald-600" />
          ) : (
            <CircleAlert
              className={cn(
                "mt-0.5 size-4",
                item.level === "error" ? "text-destructive" : "text-amber-600",
              )}
            />
          )}
          <div>
            <p className="text-sm font-medium">{item.label}</p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              {item.detail}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmailStudioWorkspace({
  workspace,
  compiled,
}: {
  workspace: EmailStudioWorkspaceData;
  compiled: CompiledWorkspace;
}) {
  const [tab, setTab] = useState<WorkspaceTab>(
    workspace.reference ? "design" : "design",
  );
  const [viewport, setViewport] = useState<ViewportMode>("desktop");
  const [showNewElement, setShowNewElement] = useState(false);
  const project = workspace.project;
  const contentAssets = workspace.assets.filter(
    (asset) => asset.role === "asset",
  );
  const templateAssetIds = new Set(
    workspace.templates
      .filter((template) => template.status === "active")
      .map((template) => template.assetId),
  );
  const isCurrent = isEmailStudioDocumentCurrent(project);
  const isDirty = Boolean(compiled) && !isCurrent;
  const isArchived = project.status === "archived";
  const progress = [
    Boolean(workspace.reference),
    contentAssets.length > 0,
    workspace.elements.length > 0,
    Boolean(compiled),
  ].filter(Boolean).length;

  const blueprint = useMemo(
    () =>
      project.currentDocument
        ? JSON.stringify(project.currentDocument, null, 2)
        : "",
    [project.currentDocument],
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
      <section className="glass min-h-[720px] overflow-hidden rounded-xl">
        <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b p-3">
          <div className="bg-muted flex flex-wrap rounded-lg p-1">
            {(
              [
                ["design", "Diseño"],
                ["structure", "Estructura"],
                ["preview", "Preview"],
                ["html", "HTML"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={tab === value}
                onClick={() => setTab(value)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  tab === value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {(tab === "preview" || tab === "design") && (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant={viewport === "desktop" ? "secondary" : "ghost"}
                size="sm"
                aria-pressed={viewport === "desktop"}
                onClick={() => setViewport("desktop")}
              >
                <Monitor />
                Desktop
              </Button>
              <Button
                type="button"
                variant={viewport === "mobile" ? "secondary" : "ghost"}
                size="sm"
                aria-pressed={viewport === "mobile"}
                onClick={() => setViewport("mobile")}
              >
                <Smartphone />
                Móvil
              </Button>
            </div>
          )}
        </div>

        {tab === "design" &&
          (isArchived ? (
            <ArchivedProjectNotice />
          ) : (
            <div className="space-y-6 p-5">
              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <FileText className="text-primary size-4" />
                    <h2 className="font-medium">Referencia aprobada</h2>
                  </div>
                  {workspace.reference && workspace.referenceUrl ? (
                    <div className="space-y-3">
                      <div
                        className={cn(
                          "bg-muted mx-auto overflow-hidden rounded-xl border",
                          viewport === "mobile" ? "max-w-sm" : "max-w-full",
                        )}
                      >
                        {workspace.reference.mimeType === "application/pdf" ? (
                          <iframe
                            title="Referencia PDF"
                            src={workspace.referenceUrl}
                            className="h-[520px] w-full"
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={workspace.referenceUrl}
                            alt="Diseño de referencia aprobado"
                            className="mx-auto max-h-[620px] w-auto max-w-full object-contain"
                          />
                        )}
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {workspace.reference.originalName} ·{" "}
                        {Math.ceil(workspace.reference.sizeBytes / 1024)} KB
                      </p>
                    </div>
                  ) : (
                    <UploadForm projectId={project.id} kind="reference" />
                  )}
                  {workspace.reference && (
                    <div className="mt-4">
                      <UploadForm projectId={project.id} kind="reference" />
                    </div>
                  )}
                </div>

                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <ImagePlus className="text-primary size-4" />
                    <h2 className="font-medium">Assets del correo</h2>
                  </div>
                  <UploadForm projectId={project.id} kind="assets" />
                  <div className="bg-muted/50 mt-4 rounded-lg px-3 py-2 text-xs leading-relaxed">
                    Cada versión se publica con una URL HTTPS inmutable y se
                    convierte en un elemento editable. Reemplazar un asset exige
                    regenerar; los HTML ya entregados conservan su versión.
                  </div>
                </div>
              </div>

              {contentAssets.length > 0 && (
                <div>
                  <Separator className="mb-5" />
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {contentAssets.map((asset) => (
                      <AssetCard
                        key={asset.id}
                        asset={asset}
                        linkedToTemplate={templateAssetIds.has(asset.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

        {tab === "structure" &&
          (isArchived ? (
            <ArchivedProjectNotice />
          ) : (
            <div className="space-y-5 p-5">
              <SettingsForm project={project} />
              <VariablesPanel
                projectId={project.id}
                variables={workspace.variables}
              />

              <section className="glass rounded-xl p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Layers3 className="text-primary size-4" />
                      <h2 className="font-medium">Elementos del correo</h2>
                    </div>
                    <p className="text-muted-foreground mt-1 text-sm">
                      Ordena las piezas y configura enlaces, textos y botones.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowNewElement((current) => !current)}
                  >
                    <Plus />
                    Agregar elemento
                  </Button>
                </div>
                <div className="mt-5 space-y-3">
                  {showNewElement && (
                    <ContentElementEditor
                      projectId={project.id}
                      total={workspace.elements.length}
                      onCreated={() => setShowNewElement(false)}
                    />
                  )}
                  {workspace.elements.map((element, index) =>
                    element.type === "image" || element.type === "template" ? (
                      <ImageElementEditor
                        key={element.id}
                        projectId={project.id}
                        element={element}
                        position={index}
                        total={workspace.elements.length}
                      />
                    ) : (
                      <ContentElementEditor
                        key={element.id}
                        projectId={project.id}
                        element={element}
                        position={index}
                        total={workspace.elements.length}
                      />
                    ),
                  )}
                  {workspace.elements.length === 0 && !showNewElement && (
                    <div className="border-border/70 rounded-lg border border-dashed px-5 py-8 text-center">
                      <p className="text-sm font-medium">
                        Sin elementos todavía
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        Sube assets o agrega un texto para comenzar.
                      </p>
                    </div>
                  )}
                </div>
                <div className="border-border/70 mt-5 flex flex-wrap items-center justify-between gap-4 border-t pt-5">
                  <div>
                    <p className="text-sm font-medium">Generar documento</p>
                    <p className="text-muted-foreground text-xs">
                      La asistencia visual envía temporalmente a OpenAI la
                      referencia privada y hasta 12 assets. La respuesta no se
                      almacena; la compilación manual respeta esta estructura.
                    </p>
                  </div>
                  <GenerationButton
                    projectId={project.id}
                    hasReference={Boolean(workspace.reference)}
                  />
                </div>
              </section>

              <TemplatesPanel workspace={workspace} />
              <RevisionsPanel
                projectId={project.id}
                revisions={workspace.revisions}
              />
            </div>
          ))}

        {tab === "preview" && (
          <div className="p-5">
            {compiled ? (
              <div className="space-y-5">
                {isDirty && (
                  <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
                    <CircleAlert className="mt-0.5 size-4 text-amber-600" />
                    Hay cambios posteriores a la última generación. Vuelve a
                    compilar para actualizar el preview.
                  </div>
                )}
                <div
                  className={cn(
                    "bg-muted mx-auto overflow-hidden rounded-xl border p-3 transition-[max-width]",
                    viewport === "mobile" ? "max-w-[420px]" : "max-w-[760px]",
                  )}
                >
                  <iframe
                    title={`Preview de ${project.name}`}
                    srcDoc={compiled.html}
                    sandbox="allow-popups allow-popups-to-escape-sandbox"
                    className="h-[760px] w-full bg-white"
                    suppressHydrationWarning
                  />
                </div>
              </div>
            ) : (
              <div className="flex min-h-[560px] flex-col items-center justify-center text-center">
                <Braces className="text-muted-foreground size-10" />
                <h2 className="font-display mt-4 text-2xl">
                  Genera el primer blueprint
                </h2>
                <p className="text-muted-foreground mt-2 max-w-md text-sm">
                  Configura la estructura y compílala para revisar el HTML en
                  desktop y móvil.
                </p>
              </div>
            )}
          </div>
        )}

        {tab === "html" && (
          <div className="space-y-5 p-5">
            {compiled ? (
              <>
                {isDirty && (
                  <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
                    <CircleAlert className="mt-0.5 size-4 text-amber-600" />
                    Hay cambios pendientes. Regenera el documento para habilitar
                    las descargas y evitar entregar una versión obsoleta.
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Entrega final</p>
                    <p className="text-muted-foreground text-xs">
                      HTML autocontenido con assets públicos y blueprint
                      versionado.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isCurrent ? (
                      <>
                        <Button
                          render={
                            <a
                              href={`/email-studio/${project.id}/export/blueprint`}
                            />
                          }
                          nativeButton={false}
                          variant="outline"
                        >
                          <Braces />
                          Blueprint
                        </Button>
                        <Button
                          render={
                            <a
                              href={`/email-studio/${project.id}/export/html`}
                            />
                          }
                          nativeButton={false}
                        >
                          <Download />
                          Descargar HTML
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button type="button" variant="outline" disabled>
                          <Braces />
                          Blueprint
                        </Button>
                        <Button type="button" disabled>
                          <Download />
                          Descargar HTML
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                      <Code2 className="size-4" />
                      HTML
                    </div>
                    <pre className="bg-foreground text-background max-h-[600px] overflow-auto rounded-xl p-4 text-[11px] leading-relaxed">
                      <code>{compiled.html}</code>
                    </pre>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                      <Braces className="size-4" />
                      Blueprint
                    </div>
                    <pre className="bg-muted max-h-[600px] overflow-auto rounded-xl p-4 text-[11px] leading-relaxed">
                      <code>{blueprint}</code>
                    </pre>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex min-h-[560px] flex-col items-center justify-center text-center">
                <Code2 className="text-muted-foreground size-10" />
                <h2 className="font-display mt-4 text-2xl">
                  El HTML aparecerá aquí
                </h2>
                <p className="text-muted-foreground mt-2 text-sm">
                  Primero genera el blueprint desde la pestaña Estructura.
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      <aside className="space-y-4">
        <section className="glass rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-xs tracking-wide uppercase">
                Preparación
              </p>
              <p className="mt-1 font-medium">{progress} de 4 etapas</p>
            </div>
            <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
              <Mail className="size-5" />
            </div>
          </div>
          <div className="bg-muted mt-4 h-2 overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full transition-[width]"
              style={{ width: `${progress * 25}%` }}
            />
          </div>
          <div className="mt-4 space-y-2 text-sm">
            {[
              ["Referencia", Boolean(workspace.reference)],
              ["Assets públicos", contentAssets.length > 0],
              ["Estructura", workspace.elements.length > 0],
              ["HTML generado", Boolean(compiled)],
            ].map(([label, complete]) => (
              <div
                key={String(label)}
                className="flex items-center justify-between"
              >
                <span className="text-muted-foreground">{String(label)}</span>
                {complete ? (
                  <Check className="size-4 text-emerald-600" />
                ) : (
                  <span className="text-muted-foreground text-xs">
                    Pendiente
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="glass rounded-xl p-5">
          <p className="text-muted-foreground text-xs tracking-wide uppercase">
            Documento
          </p>
          <dl className="mt-3 space-y-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Versión</dt>
              <dd className="font-medium">
                {project.currentDocumentVersion || "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Generación</dt>
              <dd className="font-medium">
                {project.generationMode === "ai"
                  ? "Asistida"
                  : project.generationMode === "manual"
                    ? "Manual"
                    : "Pendiente"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Assets</dt>
              <dd className="font-medium">{contentAssets.length}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Variables</dt>
              <dd className="font-medium">{workspace.variables.length}</dd>
            </div>
          </dl>
        </section>

        {compiled && (
          <section className="glass rounded-xl p-5">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="text-primary size-4" />
              <h2 className="font-medium">QA de compatibilidad</h2>
            </div>
            <AuditPanel items={compiled.audit} />
          </section>
        )}

        <section className="border-border/70 rounded-xl border p-5">
          <p className="text-sm font-medium">Laboratorio técnico</p>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            El spike del contrato original permanece disponible para comparar la
            salida del compilador.
          </p>
          <Button
            render={<Link href="/email-studio/lab" />}
            nativeButton={false}
            variant="ghost"
            className="mt-3"
          >
            Abrir laboratorio
          </Button>
        </section>
      </aside>
    </div>
  );
}
