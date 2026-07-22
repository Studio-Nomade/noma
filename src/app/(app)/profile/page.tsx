import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth";
import {
  getCurrentTeamMember,
  syncTeamMemberFromGoogle,
} from "@/features/team/profile";
import { ProfileForm } from "@/features/team/profile-form";
import type { Area } from "@/types/enums";

export const metadata = { title: "Mi perfil" };

export default async function ProfilePage() {
  const user = await requireUser();

  // Crea el perfil si aún no existe (primer ingreso o dato del seed sin enlazar).
  let member = await getCurrentTeamMember(user);
  if (!member) {
    await syncTeamMemberFromGoogle(user);
    member = await getCurrentTeamMember(user);
  }

  return (
    <>
      <PageHeader
        title="Mi perfil"
        description="Datos de tu cuenta. Nombre y foto llegan de Google; el resto lo completas tú."
      />

      <div className="glass max-w-3xl rounded-xl p-6">
        {member ? (
          <ProfileForm
            email={user.email ?? ""}
            member={{
              name: member.name,
              roleTitle: member.roleTitle,
              area: member.area as Area | null,
              phone: member.phone,
              birthDate: member.birthDate,
              photoUrl: member.photoUrl,
              teamRole: member.teamRole,
            }}
          />
        ) : (
          <p className="text-muted-foreground text-sm">
            No se pudo cargar tu perfil. Cierra sesión y vuelve a entrar.
          </p>
        )}
      </div>
    </>
  );
}
