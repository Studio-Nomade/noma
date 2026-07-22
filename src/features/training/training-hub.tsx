"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  ExternalLink,
  GraduationCap,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { DataPagination } from "@/components/shared/data-pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { usePagination } from "@/hooks/use-pagination";
import {
  AREAS,
  AREA_LABELS,
  COURSE_ENROLLMENT_STATUSES,
  COURSE_LEVELS,
  COURSE_PROVIDERS,
  type Area,
  type CourseEnrollmentStatus,
  type CourseLevel,
  type CourseProvider,
} from "@/types/enums";
import {
  assignCourse,
  createCourse,
  deleteCourse,
  updateCourse,
  updateMyProgress,
  type CourseInput,
  type ProgressInput,
} from "./actions";

type Course = Awaited<
  ReturnType<typeof import("./queries").listCourses>
>[number];
type EnrollmentData = Awaited<
  ReturnType<typeof import("./queries").listEnrollments>
>;
type Member = { id: string; name: string };

export function TrainingHub({
  courses,
  enrollments,
  members,
  canManage,
}: {
  courses: Course[];
  enrollments: EnrollmentData;
  members: Member[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("all");
  const [level, setLevel] = useState("all");
  const [duration, setDuration] = useState("all");
  const filtered = useMemo(
    () =>
      courses.filter((course) => {
        if (area !== "all" && course.area !== area) return false;
        if (level !== "all" && course.level !== level) return false;
        const minutes = course.durationMin ?? 0;
        if (duration === "short" && minutes >= 120) return false;
        if (duration === "medium" && (minutes < 120 || minutes > 360))
          return false;
        if (duration === "long" && minutes <= 360) return false;
        const needle = query.trim().toLowerCase();
        return (
          !needle ||
          [course.title, course.description, ...course.tags]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(needle))
        );
      }),
    [area, courses, duration, level, query],
  );
  const pagination = usePagination(
    filtered,
    "noma:training:page-size",
    `${query}:${area}:${level}:${duration}`,
  );
  return (
    <Tabs defaultValue="catalog">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="catalog">
            <BookOpen /> Catálogo
          </TabsTrigger>
          <TabsTrigger value="mine">
            <GraduationCap /> Mi aprendizaje
          </TabsTrigger>
          {canManage && (
            <TabsTrigger value="team">
              <Users /> Estado del equipo
            </TabsTrigger>
          )}
        </TabsList>
        {canManage && (
          <CourseDialog
            trigger={
              <Button>
                <Plus /> Nuevo curso
              </Button>
            }
            onSaved={() => router.refresh()}
          />
        )}
      </div>
      <TabsContent value="catalog">
        <div className="mb-5 flex flex-wrap gap-2">
          <Input
            className="min-w-60 flex-1"
            placeholder="Buscar curso…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Filter
            value={area}
            setValue={setArea}
            label="Todas las áreas"
            options={AREAS.map((value) => ({
              value,
              label: AREA_LABELS[value],
            }))}
          />
          <Filter
            value={level}
            setValue={setLevel}
            label="Todos los niveles"
            options={COURSE_LEVELS.map((value) => ({ value, label: value }))}
          />
          <Filter
            value={duration}
            setValue={setDuration}
            label="Toda duración"
            options={[
              { value: "short", label: "Menos de 2 h" },
              { value: "medium", label: "2 a 6 h" },
              { value: "long", label: "Más de 6 h" },
            ]}
          />
        </div>
        <p className="text-muted-foreground mb-4 text-xs">
          El catálogo es curado manualmente. Domestika se abre en otra pestaña
          usando la cuenta oficial del estudio.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pagination.pageItems.map((course) => (
            <article
              key={course.id}
              className="border-border bg-card flex flex-col rounded-xl border p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge value={course.level} size="xs" />
                {course.area && (
                  <span className="text-muted-foreground text-xs">
                    {course.area}
                  </span>
                )}
                {!course.active && <StatusBadge value="Inactivo" size="xs" />}
              </div>
              <h2 className="mt-3 font-medium">{course.title}</h2>
              {course.description && (
                <p className="text-muted-foreground mt-1 line-clamp-3 text-sm">
                  {course.description}
                </p>
              )}
              <p className="text-muted-foreground mt-2 text-xs">
                {course.durationMin
                  ? `${Math.round(course.durationMin / 6) / 10} h`
                  : "Duración no informada"}{" "}
                · {course.provider}
              </p>
              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                <a
                  href={course.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-foreground text-background inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm"
                >
                  Abrir curso <ExternalLink className="size-3.5" />
                </a>
                {canManage && (
                  <AssignDialog
                    course={course}
                    members={members}
                    onSaved={() => router.refresh()}
                  />
                )}
                {canManage && (
                  <CourseDialog
                    item={course}
                    trigger={
                      <Button variant="outline" size="sm">
                        <Pencil /> Editar
                      </Button>
                    }
                    onSaved={() => router.refresh()}
                  />
                )}
                {canManage && (
                  <DeleteCourseButton
                    id={course.id}
                    onDone={() => router.refresh()}
                  />
                )}
              </div>
            </article>
          ))}
        </div>
        <DataPagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={pagination.total}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
        />
      </TabsContent>
      <TabsContent value="mine">
        <DeclarationNotice />
        <EnrollmentList
          rows={enrollments.mine}
          editable
          onSaved={() => router.refresh()}
        />
      </TabsContent>
      {canManage && (
        <TabsContent value="team">
          <DeclarationNotice />
          <TeamSummary rows={enrollments.team} />
        </TabsContent>
      )}
    </Tabs>
  );
}

function CourseDialog({
  trigger,
  item,
  onSaved,
}: {
  trigger: React.ReactElement;
  item?: Course;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(item?.title ?? "");
  const [provider, setProvider] = useState<CourseProvider>(
    item?.provider ?? "domestika",
  );
  const [url, setUrl] = useState(item?.url ?? "");
  const [area, setArea] = useState<string>(item?.area ?? "none");
  const [level, setLevel] = useState<CourseLevel>(item?.level ?? "inicial");
  const [duration, setDuration] = useState(
    item?.durationMin ? String(item.durationMin) : "",
  );
  const [description, setDescription] = useState(item?.description ?? "");
  const [tags, setTags] = useState(item?.tags.join(", ") ?? "");
  async function save() {
    setSaving(true);
    const input: CourseInput = {
      title,
      provider,
      url,
      area: area === "none" ? null : (area as Area),
      level,
      durationMin: duration ? Number(duration) : null,
      description,
      thumbnailUrl: item?.thumbnailUrl ?? "",
      tags: tags
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      active: item?.active ?? true,
    };
    const result = item
      ? await updateCourse(item.id, input)
      : await createCourse(input);
    setSaving(false);
    if (result.ok) {
      toast.success(item ? "Curso actualizado" : "Curso creado");
      setOpen(false);
      onSaved();
    } else toast.error(result.error);
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? "Editar curso" : "Nuevo curso"}</DialogTitle>
          <DialogDescription>
            El catálogo se mantiene manualmente; no se sincroniza con Domestika.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Título">
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </Field>
          <Field label="URL">
            <Input
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://www.domestika.org/…"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Proveedor"
              value={provider}
              onChange={(value) => setProvider(value as CourseProvider)}
              options={COURSE_PROVIDERS}
            />
            <SelectField
              label="Nivel"
              value={level}
              onChange={(value) => setLevel(value as CourseLevel)}
              options={COURSE_LEVELS}
            />
            <SelectField
              label="Área"
              value={area}
              onChange={setArea}
              options={["none", ...AREAS]}
            />
            <Field label="Duración (minutos)">
              <Input
                type="number"
                min={1}
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
              />
            </Field>
          </div>
          <Field label="Descripción">
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
          <Field label="Etiquetas separadas por coma">
            <Input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignDialog({
  course,
  members,
  onSaved,
}: {
  course: Course;
  members: Member[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    const result = await assignCourse(course.id, selected);
    setSaving(false);
    if (result.ok) {
      toast.success("Curso asignado");
      setOpen(false);
      onSaved();
    } else toast.error(result.error);
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Users /> Asignar
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Asignar {course.title}</DialogTitle>
          <DialogDescription>
            Selecciona uno o varios colaboradores.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {members.map((member) => (
            <label key={member.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={selected.includes(member.id)}
                onCheckedChange={() =>
                  setSelected((items) =>
                    items.includes(member.id)
                      ? items.filter((id) => id !== member.id)
                      : [...items, member.id],
                  )
                }
              />{" "}
              {member.name}
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button
            onClick={() => void save()}
            disabled={saving || selected.length === 0}
          >
            Asignar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EnrollmentList({
  rows,
  editable,
  onSaved,
}: {
  rows: EnrollmentData["mine"];
  editable: boolean;
  onSaved: () => void;
}) {
  if (!rows.length)
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
        No tienes cursos asignados.
      </p>
    );
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div
          key={row.id}
          className="border-border bg-card flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
        >
          <div>
            <a
              href={row.courseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium hover:underline"
            >
              {row.courseTitle} <ExternalLink className="inline size-3" />
            </a>
            <p className="text-muted-foreground mt-1 text-xs">
              {row.progressPct}% · {row.courseProvider}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge value={row.status} size="xs" />
            {editable && <ProgressDialog row={row} onSaved={onSaved} />}
          </div>
        </div>
      ))}
    </div>
  );
}
function ProgressDialog({
  row,
  onSaved,
}: {
  row: EnrollmentData["mine"][number];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<CourseEnrollmentStatus>(row.status);
  const [progress, setProgress] = useState(row.progressPct);
  const [certificate, setCertificate] = useState(row.certificateUrl ?? "");
  const [notes, setNotes] = useState(row.notes ?? "");
  async function save() {
    setSaving(true);
    const input: ProgressInput = {
      status,
      progressPct: progress,
      certificateUrl: certificate,
      notes,
    };
    const result = await updateMyProgress(row.id, input);
    setSaving(false);
    if (result.ok) {
      toast.success("Avance actualizado");
      setOpen(false);
      onSaved();
    } else toast.error(result.error);
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            Actualizar avance
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{row.courseTitle}</DialogTitle>
          <DialogDescription>
            Este avance es declarado por ti y no se sincroniza con Domestika.
          </DialogDescription>
        </DialogHeader>
        <SelectField
          label="Estado"
          value={status}
          onChange={(value) => setStatus(value as CourseEnrollmentStatus)}
          options={COURSE_ENROLLMENT_STATUSES}
        />
        <Field label="Avance (%)">
          <Input
            type="number"
            min={0}
            max={100}
            value={progress}
            onChange={(event) => setProgress(Number(event.target.value))}
          />
        </Field>
        <Field label="Certificado (URL opcional)">
          <Input
            value={certificate}
            onChange={(event) => setCertificate(event.target.value)}
          />
        </Field>
        <Field label="Notas">
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </Field>
        <DialogFooter>
          <Button onClick={() => void save()} disabled={saving}>
            Guardar avance
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function TeamSummary({ rows }: { rows: EnrollmentData["team"] }) {
  if (!rows.length)
    return (
      <p className="text-muted-foreground text-sm">
        Todavía no hay cursos asignados.
      </p>
    );
  const names = [...new Set(rows.map((row) => row.memberName))];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {names.map((name) => {
        const memberRows = rows.filter((row) => row.memberName === name);
        const average = Math.round(
          memberRows.reduce((sum, row) => sum + row.progressPct, 0) /
            memberRows.length,
        );
        return (
          <div
            key={name}
            className="border-border bg-card rounded-xl border p-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-medium">{name}</h3>
              <span className="text-sm font-semibold">{average}%</span>
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              {memberRows.filter((row) => row.status === "completado").length}{" "}
              completados de {memberRows.length}
            </p>
            <div className="bg-accent mt-3 h-1.5 rounded-full">
              <div
                className="bg-foreground h-full rounded-full"
                style={{ width: `${average}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
function DeclarationNotice() {
  return (
    <p className="bg-accent text-muted-foreground mb-4 rounded-lg px-4 py-3 text-sm">
      <strong className="text-foreground">Avance declarado:</strong> Noma no se
      sincroniza con Domestika. Cada colaborador mantiene manualmente su estado
      y porcentaje.
    </p>
  );
}
function DeleteCourseButton({
  id,
  onDone,
}: {
  id: string;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Eliminar curso"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("¿Eliminar este curso y sus asignaciones?")) return;
        startTransition(async () => {
          const result = await deleteCourse(id);
          if (result.ok) {
            toast.success("Curso eliminado");
            onDone();
          } else toast.error(result.error);
        });
      }}
    >
      <Trash2 />
    </Button>
  );
}
function Filter({
  value,
  setValue,
  label,
  options,
}: {
  value: string;
  setValue: (value: string) => void;
  label: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={(next) => next && setValue(next)}>
      <SelectTrigger className="w-44">
        <SelectValue>{value === "all" ? label : undefined}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{label}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
}) {
  return (
    <Field label={label}>
      <Select value={value} onValueChange={(next) => next && onChange(next)}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option === "none" ? "Sin área" : option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
