import Link from "next/link";
import { Mail, MessageSquare, Settings } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata = { title: "Configuración" };

const SECTIONS = [
  {
    href: "/settings/slack-links",
    icon: MessageSquare,
    title: "Avisos de Slack",
    description: "Proyecto de Asana ↔ canal de Slack y qué avisa el bot Noma.",
  },
  {
    href: "/settings/email-templates",
    icon: Mail,
    title: "Plantillas de correo",
    description: "Cuerpos de email para enviar propuestas.",
  },
];

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Configuración"
        description="Datos de Studio Nomade, equipo interno y plantilla de condiciones."
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="glass hover:bg-muted/40 flex items-start gap-3 rounded-xl p-4 transition-colors"
          >
            <section.icon className="text-muted-foreground mt-0.5 size-5" />
            <span>
              <span className="block font-medium">{section.title}</span>
              <span className="text-muted-foreground text-sm">
                {section.description}
              </span>
            </span>
          </Link>
        ))}
      </div>
      <EmptyState
        icon={Settings}
        title="Configuración en construcción"
        description="Datos del estudio, equipo y condiciones comerciales por defecto se habilitan junto al modelo de datos."
      />
    </>
  );
}
