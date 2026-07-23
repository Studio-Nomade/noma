"use client";

import { usePathname } from "next/navigation";

/**
 * Entrada suave del contenido al cambiar de ruta.
 *
 * `key={pathname}` recrea el contenedor en cada navegación, lo que hace que la
 * animación CSS vuelva a dispararse. Se ata al pathname y no a los
 * searchParams a propósito: filtrar o paginar no debe re-animar la vista.
 *
 * No usa la View Transitions API porque necesita el componente
 * `<ViewTransition>` de React, ausente en React estable.
 */
export function PageTransition({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  return (
    <div key={pathname} className={`page-enter ${className ?? ""}`}>
      {children}
    </div>
  );
}
