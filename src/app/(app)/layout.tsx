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
  const isFinance = roleFor(user.email).isFinance;
  const member = await getCurrentTeamMember(user);
  return (
    <>
      <AppShell
        email={user.email}
        isFinance={isFinance}
        name={member?.name ?? null}
        photoUrl={member?.photoUrl ?? null}
      >
        {children}
      </AppShell>
      <CommandMenu isFinance={isFinance} />
    </>
  );
}
