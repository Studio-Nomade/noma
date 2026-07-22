import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth";
import { roleFor } from "@/lib/roles";
import { getCurrentTeamMember } from "@/features/team/profile";
import {
  listCourses,
  listEnrollments,
  listTrainingMembers,
} from "@/features/training/queries";
import { TrainingHub } from "@/features/training/training-hub";

export const metadata = { title: "Capacitaciones" };
export default async function TrainingPage() {
  const user = await requireUser();
  const member = await getCurrentTeamMember(user);
  const role = roleFor(user.email);
  const canManage = role.isAdmin || role.isSuperAdmin;
  const [courses, enrollments, members] = await Promise.all([
    listCourses(canManage),
    listEnrollments(member?.id ?? null, canManage),
    canManage ? listTrainingMembers() : Promise.resolve([]),
  ]);
  return (
    <>
      <PageHeader
        title="Capacitaciones"
        description="Catálogo curado y seguimiento del aprendizaje del equipo."
      />
      <TrainingHub
        courses={courses}
        enrollments={enrollments}
        members={members}
        canManage={canManage}
      />
    </>
  );
}
