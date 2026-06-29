import { Badge } from "@/components/ui/badge";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 text-center">
      <Badge variant="secondary" className="mb-6 tracking-wide uppercase">
        Studio Nomade
      </Badge>
      <h1 className="font-heading text-5xl font-semibold tracking-tight">
        Noma
      </h1>
      <p className="text-muted-foreground mt-4 max-w-md text-balance">
        El corazón operativo de Studio Nomade. Clientes, proyectos, briefs,
        propuestas y servicios en un solo lugar.
      </p>
      <p className="text-muted-foreground/70 mt-10 text-xs tracking-widest uppercase">
        Fase 0 · setup en progreso
      </p>
    </main>
  );
}
