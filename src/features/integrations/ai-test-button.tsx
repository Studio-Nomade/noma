"use client";

import { useTransition } from "react";
import { FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { testAIProvider } from "./actions";

export function AITestButton({
  provider,
  configured,
}: {
  provider: "openai" | "gemini";
  configured: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={!configured || pending}
      onClick={() =>
        startTransition(async () => {
          const result = await testAIProvider(provider);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success(result.data.message);
        })
      }
    >
      <FlaskConical />
      {pending ? "Probando…" : "Probar conexión"}
    </Button>
  );
}
