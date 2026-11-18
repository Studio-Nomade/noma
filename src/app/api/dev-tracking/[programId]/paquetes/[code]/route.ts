import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { devPackages } from "@/db/schema";
import {
  checkDevTrackingToken,
  loadProgram,
  notFound,
  unauthorized,
} from "@/features/dev-tracking/api-auth";

export const runtime = "nodejs";

/**
 * Entrega el paquete en YAML (`Accept: application/json` para JSON con el
 * YAML dentro). Marca `entregado` la primera vez que se recoge.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ programId: string; code: string }> },
) {
  if (!checkDevTrackingToken(request)) return unauthorized();
  const { programId, code } = await params;
  const program = await loadProgram(programId);
  if (!program) return notFound();
  const [pkg] = await db
    .select()
    .from(devPackages)
    .where(
      and(eq(devPackages.programId, program.id), eq(devPackages.code, code)),
    )
    .limit(1);
  if (!pkg) return notFound("Paquete");
  if (pkg.status === "armado") {
    await db
      .update(devPackages)
      .set({
        status: "entregado",
        deliveredAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(devPackages.id, pkg.id));
  }
  if ((request.headers.get("accept") ?? "").includes("application/json")) {
    return Response.json({
      ok: true,
      code: pkg.code,
      status: pkg.status,
      yaml: pkg.yaml,
    });
  }
  return new Response(pkg.yaml, {
    headers: { "content-type": "application/yaml; charset=utf-8" },
  });
}
