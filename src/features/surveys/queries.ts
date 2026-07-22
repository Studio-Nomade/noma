import "server-only";
import { asc, count, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  surveyAnswers,
  surveyAssignments,
  surveyQuestions,
  surveyResponses,
  surveys,
  teamMembers,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { roleFor } from "@/lib/roles";

export async function listSurveys(teamMemberId: string | null) {
  const [rows, responseCounts, assignments] = await Promise.all([
    db.select().from(surveys).orderBy(desc(surveys.createdAt)),
    db
      .select({ surveyId: surveyResponses.surveyId, value: count() })
      .from(surveyResponses)
      .groupBy(surveyResponses.surveyId),
    teamMemberId
      ? db
          .select()
          .from(surveyAssignments)
          .where(eq(surveyAssignments.teamMemberId, teamMemberId))
      : Promise.resolve([]),
  ]);
  const countMap = new Map(
    responseCounts.map((row) => [row.surveyId, row.value]),
  );
  const assignmentMap = new Map(assignments.map((row) => [row.surveyId, row]));
  return rows.map((row) => ({
    ...row,
    responseCount: countMap.get(row.id) ?? 0,
    assignment: assignmentMap.get(row.id) ?? null,
  }));
}

export async function getSurveyQuestions(surveyIds: string[]) {
  if (!surveyIds.length) return [];
  return db
    .select()
    .from(surveyQuestions)
    .where(inArray(surveyQuestions.surveyId, surveyIds))
    .orderBy(asc(surveyQuestions.order));
}

export async function getSurveyResults() {
  const user = await requireUser();
  const role = roleFor(user.email);
  if (!role.isAdmin && !role.isSuperAdmin) throw new Error("Forbidden");
  const surveyRows = await db
    .select()
    .from(surveys)
    .orderBy(desc(surveys.createdAt));
  if (!surveyRows.length) return {};
  const ids = surveyRows.map((survey) => survey.id);
  const [questions, responses, answers, members] = await Promise.all([
    db
      .select()
      .from(surveyQuestions)
      .where(inArray(surveyQuestions.surveyId, ids))
      .orderBy(asc(surveyQuestions.order)),
    db
      .select()
      .from(surveyResponses)
      .where(inArray(surveyResponses.surveyId, ids)),
    db.select().from(surveyAnswers),
    db.select({ id: teamMembers.id, name: teamMembers.name }).from(teamMembers),
  ]);
  const memberMap = new Map(members.map((member) => [member.id, member.name]));
  return Object.fromEntries(
    surveyRows.map((survey) => {
      const surveyResponsesRows = responses.filter(
        (response) => response.surveyId === survey.id,
      );
      const responseIds = new Set(
        surveyResponsesRows.map((response) => response.id),
      );
      const surveyAnswersRows = answers.filter((answer) =>
        responseIds.has(answer.responseId),
      );
      const visible =
        !survey.isAnonymous ||
        surveyResponsesRows.length >= survey.minResponsesToReveal;
      const questionResults = questions
        .filter((question) => question.surveyId === survey.id)
        .map((question) => {
          const values = surveyAnswersRows.filter(
            (answer) => answer.questionId === question.id,
          );
          const numbers = values
            .map((answer) => Number(answer.valueNumber))
            .filter(Number.isFinite);
          const distribution = Object.fromEntries(
            [
              ...new Set(
                values
                  .map((answer) => answer.valueOption ?? answer.valueText)
                  .filter(Boolean),
              ),
            ].map((value) => [
              value!,
              values.filter(
                (answer) => (answer.valueOption ?? answer.valueText) === value,
              ).length,
            ]),
          );
          const nps =
            question.type === "nps" && numbers.length
              ? Math.round(
                  ((numbers.filter((value) => value >= 9).length -
                    numbers.filter((value) => value <= 6).length) /
                    numbers.length) *
                    100,
                )
              : null;
          return {
            id: question.id,
            label: question.label,
            type: question.type,
            average: numbers.length
              ? numbers.reduce((a, b) => a + b, 0) / numbers.length
              : null,
            nps,
            distribution,
            texts:
              question.type === "texto_libre"
                ? values.map((answer) => answer.valueText).filter(Boolean)
                : [],
          };
        });
      const individuals = survey.isAnonymous
        ? []
        : surveyResponsesRows.map((response) => ({
            name: response.respondentId
              ? (memberMap.get(response.respondentId) ?? "Colaborador")
              : "Colaborador",
            answers: surveyAnswersRows.filter(
              (answer) => answer.responseId === response.id,
            ),
          }));
      return [
        survey.id,
        {
          visible,
          responseCount: surveyResponsesRows.length,
          minimum: survey.minResponsesToReveal,
          questions: visible ? questionResults : [],
          individuals: visible ? individuals : [],
        },
      ];
    }),
  );
}
