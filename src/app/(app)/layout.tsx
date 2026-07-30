import { AppShell } from "@/components/layout/app-shell";
import { CommandMenu } from "@/components/layout/command-menu";
import { requireUser } from "@/lib/auth";
import { roleFor } from "@/lib/roles";
import { getCurrentTeamMember } from "@/features/team/profile";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const role = roleFor(user.email);
  const isFinance = role.isFinance;
  const member = await getCurrentTeamMember(user);
  return (
    <>
      <AppShell
        email={user.email}
        isFinance={isFinance}
        isPeople={role.canPeople}
        isPeopleManager={role.canManagePeople}
        name={member?.name ?? null}
        photoUrl={member?.photoUrl ?? null}
      >
        {children}
      </AppShell>
      <CommandMenu isFinance={isFinance} />
    </>
  );
}
