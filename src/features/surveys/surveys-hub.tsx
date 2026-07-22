"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Plus,
  Send,
  X,
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
import { Textarea } from "@/components/ui/textarea";
import { usePagination } from "@/hooks/use-pagination";
import {
  SURVEY_QUESTION_TYPES,
  SURVEY_TYPES,
  type SurveyQuestionType,
  type SurveyType,
} from "@/types/enums";
import {
  activateSurvey,
  closeSurvey,
  createSurvey,
  submitSurvey,
  type SurveyInput,
} from "./actions";

type SurveyRow = Awaited<
  ReturnType<typeof import("./queries").listSurveys>
>[number];
type Question = Awaited<
  ReturnType<typeof import("./queries").getSurveyQuestions>
>[number];
type Results = Record<
  string,
  {
    visible: boolean;
    responseCount: number;
    minimum: number;
    questions: {
      id: string;
      label: string;
      type: string;
      average: number | null;
      nps: number | null;
      distribution: Record<string, number>;
      texts: (string | null)[];
    }[];
    individuals: { name: string }[];
  }
>;

export function SurveysHub({
  surveys,
  questions,
  results,
  canManage,
}: {
  surveys: SurveyRow[];
  questions: Question[];
  results: Results;
  canManage: boolean;
}) {
  const router = useRouter();
  const pagination = usePagination(surveys, "noma:surveys:page-size");
  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        {canManage && <SurveyBuilder onSaved={() => router.refresh()} />}
      </div>
      <div className="space-y-3">
        {pagination.pageItems.map((survey) => {
          const assigned = survey.assignment;
          const surveyQuestions = questions.filter(
            (question) => question.surveyId === survey.id,
          );
          return (
            <article
              key={survey.id}
              className="border-border bg-card rounded-xl border p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-heading font-medium">{survey.title}</h2>
                    <StatusBadge value={survey.status} size="xs" />
                    <StatusBadge value={survey.type} size="xs" />
                    {survey.isAnonymous && (
                      <span className="bg-accent rounded-full px-2 py-0.5 text-xs">
                        Anónima
                      </span>
                    )}
                  </div>
                  {survey.description && (
                    <p className="text-muted-foreground mt-1 text-sm">
                      {survey.description}
                    </p>
                  )}
                  <p className="text-muted-foreground mt-2 text-xs">
                    {survey.responseCount} respuestas · {surveyQuestions.length}{" "}
                    preguntas
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {survey.status === "activa" &&
                    assigned?.status === "pendiente" && (
                      <ResponseDialog
                        survey={survey}
                        questions={surveyQuestions}
                        onSaved={() => router.refresh()}
                      />
                    )}
                  {assigned?.status === "respondida" && (
                    <span className="text-muted-foreground inline-flex items-center gap-1 text-sm">
                      <CheckCircle2 className="size-4" /> Respondida
                    </span>
                  )}
                  {canManage && survey.status === "borrador" && (
                    <ActionButton
                      label="Activar"
                      action={() => activateSurvey(survey.id)}
                      onDone={() => router.refresh()}
                    />
                  )}
                  {canManage && survey.status === "activa" && (
                    <ActionButton
                      label="Cerrar"
                      action={() => closeSurvey(survey.id)}
                      onDone={() => router.refresh()}
                    />
                  )}
                </div>
              </div>
              {canManage && survey.status !== "borrador" && (
                <ResultsPanel
                  result={results[survey.id]}
                  anonymous={survey.isAnonymous}
                />
              )}
            </article>
          );
        })}
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

function SurveyBuilder({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<SurveyType>("clima");
  const [anonymous, setAnonymous] = useState(true);
  const [minimum, setMinimum] = useState(3);
  const [questions, setQuestions] = useState<
    {
      type: SurveyQuestionType;
      label: string;
      options: string;
      required: boolean;
    }[]
  >([{ type: "escala_1_5", label: "", options: "", required: true }]);
  async function save() {
    setSaving(true);
    const input: SurveyInput = {
      title,
      description,
      type,
      isAnonymous: anonymous,
      minResponsesToReveal: minimum,
      questions: questions.map((question) => ({
        type: question.type,
        label: question.label,
        options:
          question.type === "opcion_multiple"
            ? question.options
                .split(",")
                .map((value) => value.trim())
                .filter(Boolean)
            : [],
        required: question.required,
      })),
    };
    const result = await createSurvey(input);
    setSaving(false);
    if (result.ok) {
      toast.success("Encuesta creada como borrador");
      setOpen(false);
      onSaved();
    } else toast.error(result.error);
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Plus /> Nueva encuesta
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Constructor de encuesta</DialogTitle>
          <DialogDescription>
            El anonimato no podrá cambiarse después de crearla.
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
            <Label>Descripción</Label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Tipo</Label>
              <Select
                value={type}
                onValueChange={(value) => value && setType(value as SurveyType)}
              >
                <SelectTrigger className="mt-1.5 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SURVEY_TYPES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Mínimo para revelar</Label>
              <Input
                className="mt-1.5"
                type="number"
                min={2}
                value={minimum}
                onChange={(event) => setMinimum(Number(event.target.value))}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={anonymous}
              onCheckedChange={(value) => setAnonymous(Boolean(value))}
            />{" "}
            Respuestas anónimas
          </label>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Preguntas</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setQuestions((items) => [
                    ...items,
                    {
                      type: "escala_1_5",
                      label: "",
                      options: "",
                      required: true,
                    },
                  ])
                }
              >
                <Plus /> Añadir
              </Button>
            </div>
            {questions.map((question, index) => (
              <div
                key={index}
                className="border-border grid gap-2 rounded-lg border p-3 sm:grid-cols-[150px_1fr_auto]"
              >
                <Select
                  value={question.type}
                  onValueChange={(value) =>
                    setQuestions((items) =>
                      items.map((item, i) =>
                        i === index
                          ? { ...item, type: value as SurveyQuestionType }
                          : item,
                      ),
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SURVEY_QUESTION_TYPES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value.replaceAll("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div>
                  <Input
                    placeholder="Pregunta"
                    value={question.label}
                    onChange={(event) =>
                      setQuestions((items) =>
                        items.map((item, i) =>
                          i === index
                            ? { ...item, label: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                  {question.type === "opcion_multiple" && (
                    <Input
                      className="mt-2"
                      placeholder="Opciones separadas por coma"
                      value={question.options}
                      onChange={(event) =>
                        setQuestions((items) =>
                          items.map((item, i) =>
                            i === index
                              ? { ...item, options: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Eliminar pregunta"
                  disabled={questions.length === 1}
                  onClick={() =>
                    setQuestions((items) => items.filter((_, i) => i !== index))
                  }
                >
                  <X />
                </Button>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Guardando…" : "Guardar borrador"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResponseDialog({
  survey,
  questions,
  onSaved,
}: {
  survey: SurveyRow;
  questions: Question[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  async function save() {
    setSaving(true);
    const payload = questions.map((question) => {
      const value = answers[question.id] ?? "";
      return {
        questionId: question.id,
        valueNumber: ["escala_1_5", "nps"].includes(question.type)
          ? Number(value)
          : null,
        valueText: question.type === "texto_libre" ? value : null,
        valueOption: ["opcion_multiple", "si_no"].includes(question.type)
          ? value
          : null,
      };
    });
    const result = await submitSurvey(survey.id, payload);
    setSaving(false);
    if (result.ok) {
      toast.success("Respuesta enviada");
      setOpen(false);
      onSaved();
    } else toast.error(result.error);
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <ClipboardList /> Responder
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{survey.title}</DialogTitle>
          <DialogDescription>
            {survey.isAnonymous
              ? "Tu respuesta es anónima: no guardaremos tu identidad junto a ella."
              : "Esta encuesta registra tu identidad."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          {questions.map((question) => (
            <div key={question.id} className="grid gap-2">
              <Label>
                {question.label}
                {question.required && " *"}
              </Label>
              {question.type === "texto_libre" ? (
                <Textarea
                  value={answers[question.id] ?? ""}
                  onChange={(event) =>
                    setAnswers((current) => ({
                      ...current,
                      [question.id]: event.target.value,
                    }))
                  }
                />
              ) : (
                <Select
                  value={answers[question.id] ?? ""}
                  onValueChange={(value) =>
                    value &&
                    setAnswers((current) => ({
                      ...current,
                      [question.id]: value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {optionsFor(question).map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={() => void save()} disabled={saving}>
            <Send /> {saving ? "Enviando…" : "Enviar respuesta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResultsPanel({
  result,
  anonymous,
}: {
  result?: Results[string];
  anonymous: boolean;
}) {
  if (!result) return null;
  return (
    <div className="border-border mt-4 border-t pt-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
        <BarChart3 className="size-4" /> Resultados
      </h3>
      {!result.visible ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
          Resultados protegidos: {result.responseCount} de {result.minimum}{" "}
          respuestas mínimas.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {result.questions.map((question) => (
            <div key={question.id} className="bg-accent/40 rounded-lg p-3">
              <p className="text-sm font-medium">{question.label}</p>
              {question.nps !== null ? (
                <p className="mt-2 text-2xl font-semibold">
                  NPS {question.nps}
                </p>
              ) : question.average !== null ? (
                <p className="mt-2 text-2xl font-semibold">
                  {question.average.toFixed(1)}
                </p>
              ) : Object.keys(question.distribution).length ? (
                <div className="mt-2 space-y-1">
                  {Object.entries(question.distribution).map(
                    ([label, value]) => (
                      <p
                        key={label}
                        className="text-muted-foreground flex justify-between text-xs"
                      >
                        <span>{label}</span>
                        <strong className="text-foreground">{value}</strong>
                      </p>
                    ),
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground mt-2 text-xs">
                  {question.texts.length} comentarios
                </p>
              )}
            </div>
          ))}
          {!anonymous && result.individuals.length > 0 && (
            <p className="text-muted-foreground text-xs sm:col-span-2">
              Respuestas identificadas:{" "}
              {result.individuals.map((item) => item.name).join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
function ActionButton({
  label,
  action,
  onDone,
}: {
  label: string;
  action: () => Promise<{ ok: boolean; error?: string }>;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await action();
          if (result.ok) {
            toast.success(`${label} completado`);
            onDone();
          } else toast.error(result.error);
        })
      }
    >
      {label}
    </Button>
  );
}
function optionsFor(question: Question) {
  if (question.type === "escala_1_5") return ["1", "2", "3", "4", "5"];
  if (question.type === "nps")
    return Array.from({ length: 11 }, (_, index) => String(index));
  if (question.type === "si_no") return ["Sí", "No"];
  return question.options;
}
