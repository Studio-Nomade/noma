import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { roleFor } from "@/lib/roles";

export default async function PeopleFinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const role = roleFor(user.email);
  if (!role.canPeople && !role.canFinance) notFound();
  return <>{children}</>;
}
