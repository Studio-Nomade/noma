"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  surveyAnswers,
  surveyAssignments,
  surveyQuestions,
  surveyResponses,
  surveys,
  teamMembers,
} from "@/db/schema";
import { handleActionError, type ActionResult } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { roleFor } from "@/lib/roles";
import { logActivity } from "@/lib/activity";
import { getCurrentTeamMember } from "@/features/team/profile";
import { SURVEY_QUESTION_TYPES, SURVEY_TYPES } from "@/types/enums";

const idSchema = z.string().uuid();
const questionSchema = z.object({
  type: z.enum(SURVEY_QUESTION_TYPES),
  label: z.string().trim().min(1).max(500),
  options: z.array(z.string().trim().min(1)).max(20).default([]),
  required: z.boolean().default(true),
});
const surveySchema = z.object({
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(3000).optional(),
  type: z.enum(SURVEY_TYPES),
  isAnonymous: z.boolean(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  minResponsesToReveal: z.number().int().min(2).max(20).default(3),
  questions: z.array(questionSchema).min(1).max(60),
});
export type SurveyInput = z.input<typeof surveySchema>;
const answerSchema = z.object({
  questionId: z.string().uuid(),
  valueNumber: z.number().nullable().optional(),
  valueText: z.string().max(10000).nullable().optional(),
  valueOption: z.string().max(500).nullable().optional(),
});

async function requireAdmin() {
  const user = await requireUser();
  const role = roleFor(user.email);
  if (!role.isAdmin && !role.isSuperAdmin) throw new Error("Forbidden");
  return user;
}

export async function createSurvey(raw: SurveyInput): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const data = surveySchema.parse(raw);
    const surveyId = await db.transaction(async (tx) => {
      const [survey] = await tx
        .insert(surveys)
        .values({
          title: data.title,
          description: data.description || null,
          type: data.type,
          isAnonymous: data.isAnonymous,
          startsAt: data.startsAt ? new Date(data.startsAt) : null,
          endsAt: data.endsAt ? new Date(data.endsAt) : null,
          minResponsesToReveal: data.minResponsesToReveal,
          createdBy: user.id,
        })
        .returning({ id: surveys.id });
      await tx
        .insert(surveyQuestions)
        .values(
          data.questions.map((question, order) => ({
            ...question,
            surveyId: survey.id,
            order,
          })),
        );
      return survey.id;
    });
    await logActivity({
      entityType: "survey",
      entityId: surveyId,
      action: "survey_created",
      actorId: user.id,
    });
    revalidatePath("/surveys");
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "createSurvey");
  }
}

export async function activateSurvey(id: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const surveyId = idSchema.parse(id);
    await db.transaction(async (tx) => {
      const [survey] = await tx
        .select({ status: surveys.status })
        .from(surveys)
        .where(eq(surveys.id, surveyId))
        .limit(1);
      if (!survey || survey.status !== "borrador")
        throw new Error("Survey cannot be activated");
      const members = await tx
        .select({ id: teamMembers.id })
        .from(teamMembers)
        .where(eq(teamMembers.status, "Activo"));
      if (members.length)
        await tx
          .insert(surveyAssignments)
          .values(
            members.map((member) => ({ surveyId, teamMemberId: member.id })),
          )
          .onConflictDoNothing();
      await tx
        .update(surveys)
        .set({ status: "activa", startsAt: new Date(), updatedAt: new Date() })
        .where(eq(surveys.id, surveyId));
    });
    await logActivity({
      entityType: "survey",
      entityId: surveyId,
      action: "survey_activated",
      actorId: user.id,
    });
    revalidatePath("/surveys");
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "activateSurvey");
  }
}

export async function closeSurvey(id: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const surveyId = idSchema.parse(id);
    await db
      .update(surveys)
      .set({ status: "cerrada", updatedAt: new Date() })
      .where(eq(surveys.id, surveyId));
    await logActivity({
      entityType: "survey",
      entityId: surveyId,
      action: "survey_closed",
      actorId: user.id,
    });
    revalidatePath("/surveys");
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "closeSurvey");
  }
}

export async function submitSurvey(
  id: string,
  rawAnswers: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const member = await getCurrentTeamMember(user);
    if (!member) throw new Error("Missing team member");
    const surveyId = idSchema.parse(id);
    const answers = z.array(answerSchema).parse(rawAnswers);
    let wasAnonymous = false;
    await db.transaction(async (tx) => {
      const [survey] = await tx
        .select({
          isAnonymous: surveys.isAnonymous,
          status: surveys.status,
          endsAt: surveys.endsAt,
        })
        .from(surveys)
        .where(eq(surveys.id, surveyId))
        .limit(1);
      if (
        !survey ||
        survey.status !== "activa" ||
        (survey.endsAt && survey.endsAt < new Date())
      )
        throw new Error("Survey unavailable");
      wasAnonymous = survey.isAnonymous;
      const [claimed] = await tx
        .update(surveyAssignments)
        .set({
          status: "respondida",
          respondedAt: survey.isAnonymous ? null : new Date(),
        })
        .where(
          and(
            eq(surveyAssignments.surveyId, surveyId),
            eq(surveyAssignments.teamMemberId, member.id),
            ne(surveyAssignments.status, "respondida"),
          ),
        )
        .returning({ id: surveyAssignments.id });
      if (!claimed) throw new Error("Survey already answered");
      const questions = await tx
        .select()
        .from(surveyQuestions)
        .where(eq(surveyQuestions.surveyId, surveyId));
      const answerMap = new Map(
        answers.map((answer) => [answer.questionId, answer]),
      );
      if (
        questions.some(
          (question) => question.required && !answerMap.has(question.id),
        )
      )
        throw new Error("Missing required answers");
      const [response] = await tx
        .insert(surveyResponses)
        .values({
          surveyId,
          respondentId: survey.isAnonymous ? null : member.id,
        })
        .returning({ id: surveyResponses.id });
      if (answers.length)
        await tx
          .insert(surveyAnswers)
          .values(
            answers
              .filter((answer) =>
                questions.some((question) => question.id === answer.questionId),
              )
              .map((answer) => ({
                responseId: response.id,
                ...answer,
                valueNumber:
                  answer.valueNumber == null
                    ? null
                    : String(answer.valueNumber),
              })),
          );
    });
    // Anonimato: rompe la correlación por `xmin`.
    //
    // La asignación y la respuesta se escriben en la MISMA transacción, así que
    // Postgres les asigna el mismo `xmin`. Esa columna de sistema es legible por
    // cualquiera con SELECT, y un `JOIN ... ON a.xmin = r.xmin` revela quién
    // respondió qué, saltándose los triggers que anulan identidad y timestamp.
    //
    // Al tocar TODAS las asignaciones de la encuesta en una transacción aparte,
    // todas quedan con un `xmin` nuevo e idéntico entre sí y distinto del de
    // cualquier respuesta, de modo que ese join deja de correlacionar.
    if (wasAnonymous) {
      await db
        .update(surveyAssignments)
        .set({ surveyId })
        .where(eq(surveyAssignments.surveyId, surveyId));
    }
    revalidatePath("/surveys");
    return { ok: true, data: undefined };
  } catch (error) {
    return handleActionError(error, "submitSurvey");
  }
}
