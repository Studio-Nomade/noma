import { requireFinance } from "@/lib/auth";
import { FinanceNav } from "@/features/finance/finance-nav";

export const metadata = { title: "Finanzas" };

export default async function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Guard: solo el área de Finanzas. Si no, redirige a "/".
  await requireFinance(true);
  return (
    <div>
      <FinanceNav />
      {children}
    </div>
  );
}
