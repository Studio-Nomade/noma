import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { GraduationCap } from "lucide-react";

export const metadata = { title: "Onboarding" };

export default function OnboardingPage() {
  return (
    <>
      <PageHeader
        title="Onboarding interno"
        description="Perfiles del equipo, procesos por área, mapa de herramientas y accesos."
      />
      <EmptyState
        icon={GraduationCap}
        title="Onboarding en construcción"
        description="Se construye en la Fase 6: perfiles, procesos y accesos por referencia segura (sin contraseñas en texto plano)."
      />
    </>
  );
}
