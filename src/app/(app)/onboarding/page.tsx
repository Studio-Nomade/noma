import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Boxes,
  FileSignature,
  Mail,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";

export const metadata = { title: "Onboarding" };

const MODULES = [
  {
    icon: LayoutDashboard,
    title: "Dashboard",
    href: "/",
    desc: "Vista operativa: métricas, pipeline comercial, próximas acciones y entregas.",
  },
  {
    icon: Users,
    title: "Clientes",
    href: "/clients",
    desc: "Base de clientes y prospectos. Cada cliente tiene contactos (correos) y proyectos.",
  },
  {
    icon: FolderKanban,
    title: "Proyectos",
    href: "/projects",
    desc: "Eje central. Vincula cliente, una o más áreas, estado, etapa comercial y próxima acción.",
  },
  {
    icon: Boxes,
    title: "Servicios",
    href: "/services",
    desc: "Catálogo por área y subárea, con valores en UF (o CLP por unidad). Editable.",
  },
  {
    icon: FileSignature,
    title: "Propuestas",
    href: "/proposals",
    desc: "Cotizaciones: servicios, equipo, totales UF+IVA, deck/PDF, versiones y envío.",
  },
  {
    icon: Mail,
    title: "Plantillas de correo",
    href: "/settings/email-templates",
    desc: "Cuerpos de email para enviar propuestas, con variables por servicio/área.",
  },
];

const STEPS = [
  "Crea el cliente apenas haya un primer contacto (estado Prospecto).",
  "Crea el proyecto vinculado al cliente; elige una o más áreas y la etapa comercial.",
  "Desde el proyecto, abre Nueva cotización.",
  "Agrega servicios del catálogo (se agrupan por área) y el equipo (con su rol).",
  "Completa las secciones y guarda; revisa los totales (UF → CLP + IVA).",
  "Vista previa / Descargar PDF para revisar el deck.",
  "Enviar: elige los contactos del cliente, CC al equipo, plantilla y adjunta el PDF.",
  "Si el cliente pide ajustes, registra el comentario en Seguimiento y crea una Nueva versión (v2).",
];

const TIPS = [
  "Mantén siempre una próxima acción en los proyectos activos.",
  "Los clientes y propuestas no se borran a la ligera: usa estados (Cerrado/Rechazada).",
  "Los valores se guardan en UF; el CLP se recalcula con la UF del día.",
  "El PDF se nombra solo: AREA_AAMMDD | Cliente - Proyecto.",
  "Un proyecto multi-área separa los servicios por área en la propuesta y el PDF.",
];

export default function OnboardingPage() {
  return (
    <>
      <PageHeader
        title="Cómo usar Noma"
        description="Guía rápida del equipo de Studio Nomade para operar la plataforma."
      />

      {/* Qué es */}
      <div className="glass rounded-xl p-6">
        <h2 className="font-heading mb-2 text-lg font-medium">
          Noma es el corazón operativo del estudio
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Centraliza el ciclo comercial: clientes → proyectos → servicios →
          cotizaciones → envío. La regla de oro: si un proyecto o propuesta no
          está en Noma, no existe como unidad de negocio.
        </p>
      </div>

      {/* Flujo principal */}
      <h2 className="font-heading mt-8 mb-3 text-sm font-medium tracking-wide uppercase">
        Flujo principal
      </h2>
      <ol className="glass space-y-2 rounded-xl p-6">
        {STEPS.map((s, i) => (
          <li key={i} className="flex gap-3 text-sm">
            <span className="bg-foreground text-background flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-medium">
              {i + 1}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ol>

      {/* Módulos */}
      <h2 className="font-heading mt-8 mb-3 text-sm font-medium tracking-wide uppercase">
        Módulos
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="glass hover-lift group rounded-xl p-5"
          >
            <div className="mb-2 flex items-center justify-between">
              <m.icon className="size-5" />
              <ArrowRight className="text-muted-foreground size-4 opacity-0 transition group-hover:opacity-100" />
            </div>
            <p className="font-medium">{m.title}</p>
            <p className="text-muted-foreground mt-1 text-sm">{m.desc}</p>
          </Link>
        ))}
      </div>

      {/* Buenas prácticas */}
      <h2 className="font-heading mt-8 mb-3 text-sm font-medium tracking-wide uppercase">
        Buenas prácticas
      </h2>
      <ul className="glass list-inside list-disc space-y-1.5 rounded-xl p-6 text-sm">
        {TIPS.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>

      {/* Equipo y accesos */}
      <div className="border-border bg-accent/40 mt-8 rounded-xl border p-6">
        <h2 className="font-heading mb-1 text-sm font-medium">
          Equipo y accesos (próximamente)
        </h2>
        <p className="text-muted-foreground text-sm">
          Perfiles del equipo con foto, herramientas y accesos por{" "}
          <strong>referencia a un gestor de contraseñas</strong> (nunca claves
          en texto plano). El correo de cada integrante habilitará el CC
          automático al enviar propuestas.
        </p>
      </div>
    </>
  );
}
