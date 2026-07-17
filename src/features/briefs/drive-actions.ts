"use server";

import { revalidatePath } from "next/cache";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { briefs, briefNotes, briefMeetings, projects, clients } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { handleActionError, type ActionResult } from "@/lib/actions";
import { readDriveDoc, searchRecentDocs } from "@/features/google/drive";
import { matchNotes, type NoteCandidate } from "@/features/google/note-matching";
import { ensureBrief } from "./brief-helpers";

/** Contexto de la oportunidad + última reunión, para buscar/asociar notas. */
async function opportunityContext(projectId: string) {
  const [row] = await db
    .select({
      name: projects.name,
      clientName: clients.companyName,
    })
    .from(projects)
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(eq(projects.id, projectId))
    .limit(1);
  const [meeting] = await db
    .select()
    .from(briefMeetings)
    .where(eq(briefMeetings.projectId, projectId))
    .orderBy(desc(briefMeetings.startsAt))
    .limit(1);
  return { project: row ?? null, meeting: meeting ?? null };
}

// ── Buscar notas de Gemini en Drive (matching sugerido) ──────
export type SearchNotesResult =
  | {
      ok: true;
      data: {
        connected: boolean;
        reason?: string;
        status: "auto" | "candidates" | "not_found";
        candidates: NoteCandidate[];
      };
    }
  | { ok: false; error: string };

export async function searchGeminiNotes(
  projectId: string,
): Promise<SearchNotesResult> {
  try {
    const user = await requireUser();
    const { project, meeting } = await opportunityContext(projectId);
    if (!project) return { ok: false, error: "Oportunidad no encontrada." };

    // Ventana temporal: desde una semana antes de la reunión (o 30 días atrás).
    const since = meeting?.startsAt
      ? new Date(meeting.startsAt.getTime() - 7 * 864e5)
      : new Date(Date.now() - 30 * 864e5);

    const search = await searchRecentDocs(user.id, {
      sinceIso: since.toISOString(),
      nameContains: [project.clientName, project.name].filter(Boolean),
      limit: 25,
    });
    if (!search.connected) {
      return {
        ok: true,
        data: {
          connected: false,
          reason: search.reason,
          status: "not_found",
          candidates: [],
        },
      };
    }

    const match = matchNotes(search.files, {
      clientName: project.clientName,
      projectName: project.name,
      meetingTitle: meeting?.title,
      meetingDate: meeting?.startsAt ? meeting.startsAt.toISOString() : null,
      organizerEmail: meeting?.organizerEmail,
    });

    return {
      ok: true,
      data: {
        connected: true,
        status: match.status,
        candidates: match.candidates,
      },
    };
  } catch (err) {
    return handleActionError(err, "searchGeminiNotes");
  }
}

// ── Asociar un documento de Drive como nota ──────────────────
export async function associateDriveNote(
  projectId: string,
  input: { fileId?: string; url?: string; auto?: boolean },
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const ref = input.url || input.fileId;
    if (!ref) return { ok: false, error: "Falta el documento a asociar." };

    const read = await readDriveDoc(user.id, ref);
    if (!read.connected) {
      return {
        ok: false,
        error:
          read.reason +
          " Cierra sesión y vuelve a entrar para conceder Google Drive.",
      };
    }
    if ("error" in read) return { ok: false, error: read.error };

    const brief = await ensureBrief(projectId, user.id);
    const { meeting } = await opportunityContext(projectId);

    await db.insert(briefNotes).values({
      projectId,
      meetingId: meeting?.id ?? null,
      source: "drive",
      driveFileId: input.fileId ?? null,
      driveUrl: input.url ?? read.name,
      fileName: read.name,
      rawText: read.text,
      matchStatus: input.auto ? "auto" : "manual",
      importedBy: user.id,
      importedByEmail: user.email ?? null,
      createdBy: user.id,
    });

    await db
      .update(briefs)
      .set({ status: "Notas importadas", updatedAt: new Date() })
      .where(eq(briefs.id, brief.id));

    await logActivity({
      entityType: "brief",
      entityId: brief.id,
      action: input.auto ? "notes_matched_auto" : "notes_associated",
      actorId: user.id,
    });

    revalidatePath(`/briefs/${projectId}`);
    revalidatePath(`/projects/${projectId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "associateDriveNote");
  }
}

// ── Leer una nota existente que solo tiene enlace de Drive ───
export async function readNoteFromDrive(
  noteId: string,
  projectId: string,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const [note] = await db
      .select()
      .from(briefNotes)
      .where(eq(briefNotes.id, noteId))
      .limit(1);
    if (!note?.driveUrl)
      return { ok: false, error: "La nota no tiene enlace de Drive." };

    const read = await readDriveDoc(user.id, note.driveUrl);
    if (!read.connected) {
      return {
        ok: false,
        error: read.reason + " Vuelve a iniciar sesión para conceder Drive.",
      };
    }
    if ("error" in read) return { ok: false, error: read.error };

    await db
      .update(briefNotes)
      .set({ rawText: read.text, fileName: read.name, updatedAt: new Date() })
      .where(eq(briefNotes.id, noteId));

    revalidatePath(`/briefs/${projectId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return handleActionError(err, "readNoteFromDrive");
  }
}
