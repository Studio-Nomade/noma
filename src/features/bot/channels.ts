"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import {
  botAuthorizedSenders,
  botChannels,
  clientContacts,
  projects,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { handleActionError, type ActionResult } from "@/lib/actions";
import {
  authorizedSenderSchema,
  entityIdSchema,
  type AuthorizedSenderInput,
} from "./schema";

const active = "active";

export async function ensureBotChannel(
  projectId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const validProjectId = entityIdSchema.parse(projectId);
    const [project] = await db
      .select({
        id: projects.id,
        clientId: projects.clientId,
        asanaProjectGid: projects.asanaProjectGid,
      })
      .from(projects)
      .where(eq(projects.id, validProjectId))
      .limit(1);
    if (!project) return { ok: false, error: "Proyecto no encontrado." };

    const [existing] = await db
      .select({ id: botChannels.id })
      .from(botChannels)
      .where(eq(botChannels.projectId, validProjectId))
      .limit(1);
    if (existing) return { ok: true, data: existing };

    const [created] = await db
      .insert(botChannels)
      .values({
        projectId: validProjectId,
        clientId: project.clientId,
        asanaProjectGid: project.asanaProjectGid,
        createdBy: user.id,
      })
      .onConflictDoNothing({ target: botChannels.projectId })
      .returning({ id: botChannels.id });
    const channel =
      created ??
      (
        await db
          .select({ id: botChannels.id })
          .from(botChannels)
          .where(eq(botChannels.projectId, validProjectId))
          .limit(1)
      )[0];
    if (!channel) {
      return { ok: false, error: "No se pudo generar el agente." };
    }

    if (created) {
      await logActivity({
        entityType: "project",
        entityId: validProjectId,
        action: "bot_channel_created",
        actorId: user.id,
      });
    }
    revalidatePath(`/projects/${validProjectId}`);
    return { ok: true, data: channel };
  } catch (error) {
    return handleActionError(error, "ensureBotChannel");
  }
}

export async function addAuthorizedSender(
  botChannelId: string,
  input: AuthorizedSenderInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const validChannelId = entityIdSchema.parse(botChannelId);
    const parsed = authorizedSenderSchema.parse(input);
    const [channel] = await db
      .select({
        id: botChannels.id,
        projectId: botChannels.projectId,
        clientId: botChannels.clientId,
      })
      .from(botChannels)
      .where(eq(botChannels.id, validChannelId))
      .limit(1);
    if (!channel) return { ok: false, error: "Agente no encontrado." };

    const [collision] = await db
      .select({ id: botAuthorizedSenders.id })
      .from(botAuthorizedSenders)
      .where(
        and(
          eq(botAuthorizedSenders.phone, parsed.phone),
          eq(botAuthorizedSenders.status, active),
        ),
      )
      .limit(1);
    if (collision) {
      return {
        ok: false,
        error: "Este número ya está acreditado en otro agente activo.",
      };
    }

    const contactId = parsed.clientContactId || null;
    if (contactId) {
      const [contact] = await db
        .select({ id: clientContacts.id })
        .from(clientContacts)
        .where(
          and(
            eq(clientContacts.id, contactId),
            eq(clientContacts.clientId, channel.clientId),
          ),
        )
        .limit(1);
      if (!contact) {
        return {
          ok: false,
          error: "El contacto no pertenece al cliente del proyecto.",
        };
      }
    }

    const [sender] = await db.transaction(async (tx) => {
      const rows = await tx
        .insert(botAuthorizedSenders)
        .values({
          botChannelId: validChannelId,
          clientContactId: contactId,
          displayName: parsed.displayName,
          phone: parsed.phone,
          profile: parsed.profile,
          createdBy: user.id,
        })
        .returning({ id: botAuthorizedSenders.id });
      if (contactId) {
        await tx
          .update(clientContacts)
          .set({ phone: parsed.phone, updatedAt: new Date() })
          .where(
            and(
              eq(clientContacts.id, contactId),
              or(isNull(clientContacts.phone), eq(clientContacts.phone, "")),
            ),
          );
      }
      return rows;
    });

    await logActivity({
      entityType: "project",
      entityId: channel.projectId,
      action: "bot_sender_added",
      actorId: user.id,
    });
    revalidatePath(`/projects/${channel.projectId}`);
    return { ok: true, data: sender };
  } catch (error) {
    if (isActivePhoneConflict(error)) {
      return {
        ok: false,
        error: "Este número ya está acreditado en otro agente activo.",
      };
    }
    return handleActionError(error, "addAuthorizedSender");
  }
}

export async function revokeAuthorizedSender(
  senderId: string,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const validSenderId = entityIdSchema.parse(senderId);
    const [sender] = await db
      .select({
        id: botAuthorizedSenders.id,
        projectId: botChannels.projectId,
      })
      .from(botAuthorizedSenders)
      .innerJoin(
        botChannels,
        eq(botAuthorizedSenders.botChannelId, botChannels.id),
      )
      .where(eq(botAuthorizedSenders.id, validSenderId))
      .limit(1);
    if (!sender) return { ok: false, error: "Remitente no encontrado." };

    await db
      .update(botAuthorizedSenders)
      .set({ status: "revoked", updatedAt: new Date() })
      .where(eq(botAuthorizedSenders.id, validSenderId));
    await logActivity({
      entityType: "project",
      entityId: sender.projectId,
      action: "bot_sender_revoked",
      actorId: user.id,
    });
    revalidatePath(`/projects/${sender.projectId}`);
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "revokeAuthorizedSender");
  }
}

function isActivePhoneConflict(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    code?: string;
    constraint?: string;
    cause?: { code?: string; constraint?: string };
  };
  const code = candidate.code ?? candidate.cause?.code;
  const constraint = candidate.constraint ?? candidate.cause?.constraint;
  return (
    code === "23505" &&
    constraint === "bot_authorized_senders_active_phone_unique"
  );
}
