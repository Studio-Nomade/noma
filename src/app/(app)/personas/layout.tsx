import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { roleFor } from "@/lib/roles";

export default async function PeopleFinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  if (!roleFor(user.email).canPeople) notFound();
  return <>{children}</>;
}
