import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { devPackages } from "@/db/schema";
import {
  checkDevTrackingToken,
  loadProgram,
  notFound,
  unauthorized,
} from "@/features/dev-tracking/api-auth";

export const runtime = "nodejs";

/** Lista los paquetes del programa. `?estado=armado` para los pendientes de recoger. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ programId: string }> },
) {
  if (!checkDevTrackingToken(request)) return unauthorized();
  const { programId } = await params;
  const program = await loadProgram(programId);
  if (!program) return notFound();
  const estado = new URL(request.url).searchParams.get("estado");
  const rows = await db
    .select({
      code: devPackages.code,
      title: devPackages.title,
      origin: devPackages.origin,
      status: devPackages.status,
      items: devPackages.itemIds,
      createdAt: devPackages.createdAt,
      deliveredAt: devPackages.deliveredAt,
    })
    .from(devPackages)
    .where(
      estado
        ? and(
            eq(devPackages.programId, program.id),
            eq(devPackages.status, estado),
          )
        : eq(devPackages.programId, program.id),
    )
    .orderBy(desc(devPackages.createdAt))
    .limit(50);
  return Response.json({
    ok: true,
    paquetes: rows.map((r) => ({ ...r, items: r.items.length })),
  });
}
