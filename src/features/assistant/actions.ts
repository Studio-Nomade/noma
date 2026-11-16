"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { briefingUserFrom, generateBriefing } from "./briefing";
import { isAssistantPilot } from "./config";

export async function refreshBriefing(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const user = await requireUser();
  if (!isAssistantPilot(user.email)) {
    return { ok: false, error: "El resumen diario todavía está en piloto." };
  }
  try {
    await generateBriefing(briefingUserFrom(user));
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    console.error("[assistant:refresh]", error);
    return { ok: false, error: "No se pudo actualizar el resumen." };
  }
}
