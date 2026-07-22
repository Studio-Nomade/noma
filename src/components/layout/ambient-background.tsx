/**
 * Fondo ambiental de la plataforma: degradés en deriva lenta con los acentos de
 * las áreas de Studio Nomade (ver AREA_THEME en src/lib/brand/brand.ts), grano
 * y viñeta. Es la superficie contra la que apoya todo el vidrio de la app.
 *
 * Server Component: son cuatro divs y CSS puro, no necesita JS en el cliente.
 * Las animaciones se apagan solas con `prefers-reduced-motion` y en impresión
 * (reglas en globals.css).
 */
export function AmbientBackground() {
  return (
    <div className="ambient-root" aria-hidden="true">
      <div className="ambient-blob ambient-blob-1" />
      <div className="ambient-blob ambient-blob-2" />
      <div className="ambient-blob ambient-blob-3" />
      <div className="ambient-blob ambient-blob-4" />
      <div className="ambient-vignette" />
      <div className="ambient-grain" />
    </div>
  );
}
