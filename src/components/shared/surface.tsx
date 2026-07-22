import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Superficie base de Noma. Reemplaza el patrón repetido
 * `rounded-xl border border-border bg-card p-N` que estaba copiado en decenas
 * de vistas, y centraliza el lenguaje de vidrio del design system.
 *
 * Elección de variante:
 * - `glass`  — por defecto: cards de contenido, paneles, bloques de detalle.
 * - `solid`  — datos densos (contenedores de tabla, listados largos). Sin
 *   `backdrop-filter`: filtrar el fondo por cada fila arruina el scroll.
 * - `raised` — superficies interactivas (cards clicables): suma elevación en hover.
 * - `flat`   — sin fondo, solo el hairline: agrupaciones sutiles.
 */
const surfaceVariants = cva("rounded-xl", {
  variants: {
    variant: {
      glass: "glass",
      solid: "glass-solid",
      raised: "glass hover-lift",
      flat: "glass-hairline",
    },
    padding: {
      none: "",
      sm: "p-3",
      md: "p-4 sm:p-5",
      lg: "p-5 sm:p-6",
    },
  },
  defaultVariants: {
    variant: "glass",
    padding: "md",
  },
});

export type SurfaceProps = React.ComponentProps<"div"> &
  VariantProps<typeof surfaceVariants> & {
    /** Añade el brillo horizontal en el canto superior del cristal. */
    sheen?: boolean;
  };

export function Surface({
  className,
  variant,
  padding,
  sheen = false,
  ...props
}: SurfaceProps) {
  return (
    <div
      data-slot="surface"
      className={cn(
        surfaceVariants({ variant, padding }),
        sheen && "glass-sheen",
        className,
      )}
      {...props}
    />
  );
}

export { surfaceVariants };
