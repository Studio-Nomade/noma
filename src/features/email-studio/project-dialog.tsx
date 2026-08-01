"use client";

import {
  useMemo,
  useState,
  useTransition,
  type FormEvent,
  type ReactElement,
} from "react";
import { useRouter } from "next/navigation";
import { FolderKanban, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { createEmailStudioProject } from "./project-actions";

type ClientOption = { id: string; companyName: string };
type ProjectOption = { id: string; name: string; clientId: string };

export function EmailStudioProjectDialog({
  clients,
  projects,
  trigger,
}: {
  clients: ClientOption[];
  projects: ProjectOption[];
  trigger?: ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [nomaProjectId, setNomaProjectId] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const linkedProjectOptions = useMemo(
    () => projects.filter((project) => project.clientId === clientId),
    [clientId, projects],
  );

  function reset() {
    setName("");
    setClientId("");
    setNomaProjectId("");
    setDescription("");
    setError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (pending) return;
    setOpen(nextOpen);
    if (!nextOpen) reset();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createEmailStudioProject({
        name,
        clientId,
        nomaProjectId,
        description,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }

      toast.success("Proyecto creado", {
        description: "El espacio de trabajo ya está listo.",
      });
      setOpen(false);
      reset();
      router.push(`/email-studio/${result.data.id}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button>
              <Plus />
              Nuevo proyecto
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nuevo proyecto de correo</DialogTitle>
            <DialogDescription>
              Organiza el desarrollo por cliente y, si corresponde, conéctalo a
              un proyecto existente en Noma.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-6">
            <div className="grid gap-2">
              <Label htmlFor="email-studio-project-name">
                Nombre del proyecto
              </Label>
              <Input
                id="email-studio-project-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ej. Newsletter lanzamiento"
                autoFocus
                required
                maxLength={100}
              />
            </div>

            <div className="grid gap-2">
              <Label>Cliente</Label>
              <Select
                value={clientId}
                onValueChange={(value) => {
                  setClientId(value ?? "");
                  setNomaProjectId("");
                }}
                required
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona un cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Proyecto Noma relacionado</Label>
              <Select
                value={nomaProjectId || "__none__"}
                onValueChange={(value) =>
                  setNomaProjectId(!value || value === "__none__" ? "" : value)
                }
                disabled={!clientId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      clientId
                        ? "Sin proyecto relacionado"
                        : "Selecciona primero un cliente"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    Sin proyecto relacionado
                  </SelectItem>
                  {linkedProjectOptions.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                Solo aparecen proyectos que pertenecen al cliente seleccionado.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email-studio-project-description">
                Descripción
              </Label>
              <Textarea
                id="email-studio-project-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Objetivo o contexto breve del correo."
                rows={3}
                maxLength={500}
              />
            </div>

            {error && (
              <div
                role="alert"
                className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-3 py-2 text-sm"
              >
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || !clientId}>
              {pending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <FolderKanban />
              )}
              Crear proyecto
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
