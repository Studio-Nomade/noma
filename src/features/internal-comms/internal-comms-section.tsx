"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Cake,
  ChevronDown,
  Edit3,
  Megaphone,
  Paperclip,
  Pin,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AvatarCircle } from "@/components/shared/avatar-circle";
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
import { Textarea } from "@/components/ui/textarea";
import { usePagination } from "@/hooks/use-pagination";
import { cn } from "@/lib/utils";
import {
  ANNOUNCEMENT_CATEGORIES,
  type AnnouncementCategory,
} from "@/types/enums";
import {
  createAnnouncement,
  deleteAnnouncement,
  markAnnouncementRead,
  updateAnnouncement,
  type AnnouncementInput,
} from "./actions";
import type { AnnouncementFeedItem } from "./queries";

type Birthday = {
  id: string;
  name: string;
  photoUrl: string | null;
  roleTitle: string | null;
  nextBirthday: string;
  daysUntil: number;
};

export function InternalCommsSection({
  initialAnnouncements,
  birthdays,
  canManage,
}: {
  initialAnnouncements: AnnouncementFeedItem[];
  birthdays: Birthday[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [readIds, setReadIds] = useState(
    () =>
      new Set(
        initialAnnouncements
          .filter((item) => item.isRead)
          .map((item) => item.id),
      ),
  );
  const [expanded, setExpanded] = useState<string | null>(null);
  const pagination = usePagination(
    initialAnnouncements,
    "noma:announcements:page-size",
  );
  const unread = initialAnnouncements.filter(
    (item) => !readIds.has(item.id),
  ).length;

  async function open(item: AnnouncementFeedItem) {
    setExpanded((current) => (current === item.id ? null : item.id));
    if (!readIds.has(item.id)) {
      setReadIds((current) => new Set(current).add(item.id));
      const result = await markAnnouncementRead(item.id);
      if (!result.ok) {
        setReadIds((current) => {
          const next = new Set(current);
          next.delete(item.id);
          return next;
        });
        toast.error(result.error);
      }
    }
  }

  return (
    <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]">
      <div className="glass rounded-xl p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-heading flex items-center gap-2 text-base font-medium">
              <Megaphone className="size-4" /> Comunicación interna
            </h2>
            <p className="text-muted-foreground mt-1 text-xs">
              Novedades y acuerdos para todo el estudio.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unread > 0 && (
              <span className="bg-accent inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs">
                <Bell className="size-3" /> {unread} sin leer
              </span>
            )}
            {canManage && (
              <AnnouncementDialog
                trigger={
                  <Button size="sm">
                    <Plus /> Publicar
                  </Button>
                }
                onSaved={() => router.refresh()}
              />
            )}
          </div>
        </div>
        {initialAnnouncements.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
            Todavía no hay publicaciones internas.
          </p>
        ) : (
          <div className="space-y-2">
            {pagination.pageItems.map((item) => {
              const isOpen = expanded === item.id;
              const isRead = readIds.has(item.id);
              return (
                <article
                  key={item.id}
                  className={cn(
                    "border-border rounded-xl border p-4 transition-colors",
                    !isRead && "bg-accent/50",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => void open(item)}
                    className="flex w-full items-start gap-3 text-left"
                  >
                    <AvatarCircle
                      name={item.author.name}
                      photoUrl={item.author.photoUrl}
                      className="size-9 shrink-0 text-xs"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium">{item.title}</h3>
                        {item.pinned && <Pin className="size-3.5" />}
                        {!isRead && (
                          <span className="bg-foreground size-1.5 rounded-full" />
                        )}
                        <StatusBadge value={item.category} size="xs" />
                      </div>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {item.author.name} ·{" "}
                        {new Intl.DateTimeFormat("es-CL", {
                          dateStyle: "medium",
                        }).format(new Date(item.publishedAt))}
                      </p>
                    </div>
                    <ChevronDown
                      className={cn(
                        "text-muted-foreground size-4 transition-transform",
                        isOpen && "rotate-180",
                      )}
                    />
                  </button>
                  {isOpen && (
                    <div className="mt-4 pl-12">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {item.body}
                      </p>
                      {item.attachments.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.attachments.map((attachment) => (
                            <a
                              key={attachment.url}
                              href={attachment.url}
                              target="_blank"
                              rel="noreferrer"
                              className="border-border hover:bg-accent inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs"
                            >
                              <Paperclip className="size-3" />
                              {attachment.label}
                            </a>
                          ))}
                        </div>
                      )}
                      {canManage && (
                        <div className="mt-4 flex gap-2">
                          <AnnouncementDialog
                            item={item}
                            trigger={
                              <Button variant="outline" size="sm">
                                <Edit3 /> Editar
                              </Button>
                            }
                            onSaved={() => router.refresh()}
                          />
                          <DeleteButton
                            id={item.id}
                            title={item.title}
                            onDeleted={() => router.refresh()}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
        <DataPagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={pagination.total}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
        />
      </div>
      <div className="glass rounded-xl p-6">
        <h2 className="font-heading mb-4 flex items-center gap-2 text-base font-medium">
          <Cake className="size-4" /> Cumpleaños
        </h2>
        {birthdays.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No hay cumpleaños próximos o aún faltan fechas en los perfiles.
          </p>
        ) : (
          <ul className="space-y-3">
            {birthdays.map((member) => (
              <li key={member.id} className="flex items-center gap-3">
                <AvatarCircle
                  name={member.name}
                  photoUrl={member.photoUrl}
                  className="size-9 text-xs"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{member.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {birthdayLabel(member)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function AnnouncementDialog({
  trigger,
  item,
  onSaved,
}: {
  trigger: React.ReactElement;
  item?: AnnouncementFeedItem;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(item?.title ?? "");
  const [body, setBody] = useState(item?.body ?? "");
  const [category, setCategory] = useState<AnnouncementCategory>(
    item?.category ?? "novedad",
  );
  const [pinned, setPinned] = useState(item?.pinned ?? false);
  const [expiresAt, setExpiresAt] = useState(
    item?.expiresAt ? new Date(item.expiresAt).toISOString().slice(0, 16) : "",
  );
  async function save() {
    setSaving(true);
    const input: AnnouncementInput = {
      title,
      body,
      category,
      pinned,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      attachments: item?.attachments ?? [],
    };
    const result = item
      ? await updateAnnouncement(item.id, input)
      : await createAnnouncement(input);
    setSaving(false);
    if (result.ok) {
      toast.success(item ? "Publicación actualizada" : "Publicación creada");
      setOpen(false);
      onSaved();
    } else toast.error(result.error);
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {item ? "Editar publicación" : "Nueva publicación"}
          </DialogTitle>
          <DialogDescription>
            Visible para todo el equipo en el dashboard.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Título</Label>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Contenido</Label>
            <Textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={8}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Categoría</Label>
            <Select
              value={category}
              onValueChange={(value) =>
                value && setCategory(value as AnnouncementCategory)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANNOUNCEMENT_CATEGORIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Vence (opcional)</Label>
            <Input
              type="datetime-local"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={pinned}
              onCheckedChange={(checked) => setPinned(Boolean(checked))}
            />{" "}
            Anclar publicación
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteButton({
  id,
  title,
  onDeleted,
}: {
  id: string;
  title: string;
  onDeleted: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" disabled={pending}>
            <Trash2 /> Eliminar
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar publicación</DialogTitle>
          <DialogDescription>
            Se eliminará «{title}» y el registro de quiénes la leyeron. Esta
            acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await deleteAnnouncement(id);
                if (result.ok) {
                  toast.success("Publicación eliminada");
                  setOpen(false);
                  onDeleted();
                } else toast.error(result.error);
              })
            }
          >
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function birthdayLabel(member: Birthday) {
  if (member.daysUntil === 0) return "¡Hoy!";
  if (member.daysUntil === 1) return "Mañana";
  return `${new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "long" }).format(new Date(member.nextBirthday))} · en ${member.daysUntil} días`;
}
