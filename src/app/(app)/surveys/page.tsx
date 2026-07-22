import { ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth";
import { roleFor } from "@/lib/roles";
import { getCurrentTeamMember } from "@/features/team/profile";
import {
  getSurveyQuestions,
  getSurveyResults,
  listSurveys,
} from "@/features/surveys/queries";
import { SurveysHub } from "@/features/surveys/surveys-hub";

export const metadata = { title: "Encuestas" };
export default async function SurveysPage() {
  const user = await requireUser();
  const member = await getCurrentTeamMember(user);
  const role = roleFor(user.email);
  const canManage = role.isAdmin || role.isSuperAdmin;
  const surveys = await listSurveys(member?.id ?? null);
  const [questions, results] = await Promise.all([
    getSurveyQuestions(surveys.map((survey) => survey.id)),
    canManage ? getSurveyResults() : Promise.resolve({}),
  ]);
  return (
    <>
      <PageHeader
        title="Encuestas"
        description="Clima y desempeño del equipo con privacidad configurable."
      />
      {surveys.length === 0 && !canManage ? (
        <EmptyState
          icon={ClipboardList}
          title="No hay encuestas disponibles"
          description="Las nuevas encuestas aparecerán aquí cuando sean activadas."
        />
      ) : (
        <SurveysHub
          surveys={surveys}
          questions={questions}
          results={results}
          canManage={canManage}
        />
      )}
    </>
  );
}
