import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { roleFor } from "@/lib/roles";
import { FinanceNav } from "@/features/finance/finance-nav";

export const metadata = { title: "Finanzas" };

export default async function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  if (!roleFor(user.email).isFinance) notFound();

  return (
    <div>
      <FinanceNav />
      {children}
    </div>
  );
}
