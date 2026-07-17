import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth";
import { roleFor } from "@/lib/roles";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const isFinance = roleFor(user.email).isFinance;
  return (
    <AppShell email={user.email} isFinance={isFinance}>
      {children}
    </AppShell>
  );
}
