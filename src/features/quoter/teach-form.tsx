"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  AREAS,
  QUOTER_LEARNING_KINDS,
  QUOTER_LEARNING_KIND_LABELS,
  QUOTER_LEARNING_SCOPE_LABELS,
  type Area,
  type QuoterLearningKind,
  type QuoterLearningScope,
} from "@/types/enums";
import { addLearning } from "./memory-actions";

/**
 * "Enseñar a Noma": una regla escrita por el equipo entra activa a la memoria
 * del cotizador y se aplica desde la siguiente propuesta.
 */
export function TeachForm({
  proposalId,
  defaultArea,
}: {
  proposalId?: string;
  defaultArea?: Area;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [statement, setStatement] = useState("");
  const [kind, setKind] = useState<QuoterLearningKind>("precio");
  const scopes: QuoterLearningScope[] = proposalId
    ? ["global", "area", "cliente", "rubro"]
    : ["global", "area", "rubro"];
  const [scope, setScope] = useState<QuoterLearningScope>("global");
  const [area, setArea] = useState<Area>(defaultArea ?? "B&D");
  const [industry, setIndustry] = useState("");

  function submit() {
    startTransition(async () => {
      const res = await addLearning({
        statement,
        kind,
        scope,
        area: scope === "area" ? area : null,
        industry: scope === "rubro" ? industry : null,
        proposalId: proposalId ?? null,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Noma lo aplicará desde la próxima propuesta.");
      setStatement("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Textarea
        rows={3}
        value={statement}
        onChange={(e) => setStatement(e.target.value)}
        placeholder="Ej.: El brochure en Canva con material del cliente va en 7 UF, no en 8."
      />
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={kind}
          onValueChange={(v) => v && setKind(v as QuoterLearningKind)}
        >
          <SelectTrigger className="w-36">
            <SelectValue>{QUOTER_LEARNING_KIND_LABELS[kind]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {QUOTER_LEARNING_KINDS.map((k) => (
              <SelectItem key={k} value={k}>
                {QUOTER_LEARNING_KIND_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={scope}
          onValueChange={(v) => v && setScope(v as QuoterLearningScope)}
        >
          <SelectTrigger className="w-52">
            <SelectValue>{QUOTER_LEARNING_SCOPE_LABELS[scope]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {scopes.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "cliente"
                  ? "Este cliente"
                  : QUOTER_LEARNING_SCOPE_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {scope === "area" && (
          <Select value={area} onValueChange={(v) => v && setArea(v as Area)}>
            <SelectTrigger className="w-28">
              <SelectValue>{area}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {AREAS.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {scope === "rubro" && (
          <Input
            className="w-48"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="Rubro (ej. inmobiliario)"
          />
        )}
        <Button
          size="sm"
          className="ml-auto"
          onClick={submit}
          disabled={pending || statement.trim().length < 8}
        >
          <GraduationCap className="size-4" />
          {pending ? "Guardando…" : "Enseñar a Noma"}
        </Button>
      </div>
    </div>
  );
}
