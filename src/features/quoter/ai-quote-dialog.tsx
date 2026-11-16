"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { generateProposalWithAi } from "./draft-action";

const STEPS = [
  "Leyendo el brief y la ficha del cliente…",
  "Revisando el catálogo y los valores ya cotizados…",
  "Buscando propuestas parecidas…",
  "Aplicando la memoria del cotizador…",
  "Armando servicios, valores y alcance…",
  "Redactando las secciones de la propuesta…",
];

/** Brief aprobado → borrador de propuesta con Claude. */
export function AiQuoteDialog({
  projectId,
  enabled,
  trigger,
}: {
  projectId: string;
  enabled: boolean;
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [instructions, setInstructions] = useState("");

  useEffect(() => {
    if (!busy) return;
    setStep(0);
    const timer = setInterval(
      () => setStep((current) => Math.min(current + 1, STEPS.length - 1)),
      12_000,
    );
    return () => clearInterval(timer);
  }, [busy]);

  async function run() {
    setBusy(true);
    const res = await generateProposalWithAi(projectId, {
      instructions: instructions.trim() || null,
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const { id, warnings, customServices } = res.data;
    toast.success("Borrador listo. Revísalo antes de enviar.", {
      description: [
        customServices
          ? `${customServices} servicio(s) nuevo(s) quedaron en el catálogo «En revisión».`
          : null,
        warnings.length ? `${warnings.length} ajuste(s) para revisar.` : null,
      ]
        .filter(Boolean)
        .join(" "),
    });
    setOpen(false);
    router.push(`/proposals/${id}`);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cotizar con IA</DialogTitle>
          <DialogDescription>
            Noma arma la propuesta en Borrador con el brief, el catálogo, las
            propuestas anteriores y la memoria del cotizador. Todo queda
            editable.
          </DialogDescription>
        </DialogHeader>

        {!enabled ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
            La IA del cotizador no está configurada en este entorno (falta
            ANTHROPIC_API_KEY). Puedes crear la propuesta manualmente.
          </p>
        ) : busy ? (
          <div className="space-y-3 py-2">
            <div className="bg-muted h-1.5 overflow-hidden rounded-full">
              <div
                className="bg-foreground h-full transition-all duration-[12000ms] ease-linear"
                style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
              />
            </div>
            <p className="text-sm">{STEPS[step]}</p>
            <p className="text-muted-foreground text-xs">
              Puede tardar de 1 a 3 minutos. No cierres esta ventana.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="ai-quote-instructions">
              Indicaciones para esta propuesta (opcional)
            </Label>
            <Textarea
              id="ai-quote-instructions"
              rows={4}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Ej.: presupuesto tope 40 UF; ofrecer pack con descuento; incluir plan mensual como opcional."
            />
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button onClick={run} disabled={!enabled || busy}>
            <Sparkles className="size-4" />
            {busy ? "Cotizando…" : "Cotizar con IA"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
