/**
 * Convención de assets de mailings publicados en assets.studionomade.cl
 * (decisión del 21-10-2026, `docs/technical/email-studio.md`):
 *
 *   https://assets.studionomade.cl/mailings/<cliente>/<AAAAMMDD_evento>/<NN_AAAAMMDD_envio>/<archivo>
 *
 * Reglas: nunca sobrescribir ni borrar un asset publicado (se sube `-v2`),
 * solo png/jpg/gif/pdf/ics, imágenes de menos de 300 KB y hasta 1200 px de
 * ancho. Funciones puras: las usan el generador por brief y, más adelante, la
 * publicación desde Noma (etapa 2, bucket de Supabase con la misma ruta).
 */

export const DEFAULT_MAILING_ASSETS_BASE_URL = "https://assets.studionomade.cl";
export const MAILING_ROOT = "mailings";
export const MAX_MAILING_IMAGE_BYTES = 300 * 1024;
export const MAX_MAILING_IMAGE_WIDTH = 1200;

const ALLOWED_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "pdf", "ics"] as const;
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif"]);

/** Minúsculas, sin tildes, solo [a-z0-9-]. */
export function mailingSlug(value: string): string {
  const slug = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  if (!slug)
    throw new Error(`No se puede convertir "${value}" en nombre de carpeta.`);
  return slug;
}

/** Acepta `AAAA-MM-DD` o `AAAAMMDD` y devuelve `AAAAMMDD`. */
export function compactDate(value: string): string {
  const match = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(value.trim());
  if (!match) throw new Error(`Fecha inválida "${value}": usa AAAA-MM-DD.`);
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    throw new Error(`Fecha inválida "${value}".`);
  }
  return `${year}${month}${day}`;
}

export type MailingLocation = {
  client: string;
  event: { name: string; date: string };
  send: { number: number; date: string; name: string };
};

/** `mailings/<cliente>/<AAAAMMDD_evento>/<NN_AAAAMMDD_envio>` */
export function mailingFolder(location: MailingLocation): string {
  if (
    !Number.isInteger(location.send.number) ||
    location.send.number < 1 ||
    location.send.number > 99
  ) {
    throw new Error("El número de envío va de 1 a 99.");
  }
  const number = String(location.send.number).padStart(2, "0");
  return [
    MAILING_ROOT,
    mailingSlug(location.client),
    `${compactDate(location.event.date)}_${mailingSlug(location.event.name)}`,
    `${number}_${compactDate(location.send.date)}_${mailingSlug(location.send.name)}`,
  ].join("/");
}

/** Nombre de archivo publicable: slug + extensión en minúsculas. */
export function mailingFilename(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot <= 0) throw new Error(`"${filename}" no tiene extensión.`);
  const extension = filename.slice(dot + 1).toLowerCase();
  return `${mailingSlug(filename.slice(0, dot))}.${extension === "jpeg" ? "jpg" : extension}`;
}

/**
 * Devuelve un nombre que no choca con los ya publicados: `pieza.png`,
 * `pieza-v2.png`, `pieza-v3.png`…
 */
export function nextVersionFilename(
  filename: string,
  published: Iterable<string>,
): string {
  const taken = new Set(published);
  const clean = mailingFilename(filename);
  if (!taken.has(clean)) return clean;
  const dot = clean.lastIndexOf(".");
  const base = clean.slice(0, dot).replace(/-v\d+$/, "");
  const extension = clean.slice(dot);
  for (let version = 2; version < 1000; version += 1) {
    const candidate = `${base}-v${version}${extension}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error(`Demasiadas versiones de "${filename}".`);
}

export function mailingAssetUrl(
  folder: string,
  filename: string,
  baseUrl: string = DEFAULT_MAILING_ASSETS_BASE_URL,
): string {
  const base = new URL(baseUrl);
  if (base.protocol !== "https:") {
    throw new Error("La base de assets de mailings debe usar HTTPS.");
  }
  return new URL(
    `${folder}/${filename}`,
    base.href.endsWith("/") ? base.href : `${base.href}/`,
  ).toString();
}

export type MailingAssetCheck = {
  filename: string;
  bytes?: number | null;
  width?: number | null;
};

/** Errores según las reglas de publicación (lista vacía = publicable). */
export function validateMailingAsset(asset: MailingAssetCheck): string[] {
  const errors: string[] = [];
  const dot = asset.filename.lastIndexOf(".");
  const extension = dot > 0 ? asset.filename.slice(dot + 1).toLowerCase() : "";
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(extension)) {
    errors.push(
      `${asset.filename}: formato no permitido (usa png, jpg, gif, pdf o ics).`,
    );
    return errors;
  }
  if (IMAGE_EXTENSIONS.has(extension)) {
    if (asset.bytes != null && asset.bytes >= MAX_MAILING_IMAGE_BYTES) {
      errors.push(
        `${asset.filename}: pesa ${Math.round(asset.bytes / 1024)} KB; debe pesar menos de 300 KB.`,
      );
    }
    if (asset.width != null && asset.width > MAX_MAILING_IMAGE_WIDTH) {
      errors.push(
        `${asset.filename}: mide ${asset.width} px de ancho; el máximo es 1200 px.`,
      );
    }
  }
  return errors;
}

/**
 * Interpreta una carpeta local del estudio (`20260720_Capital Ya Reconexión
 * de Cuenta`) como fecha + slug (`20260720`, `capital-ya-reconexion-de-cuenta`).
 */
export function parseLocalMailingFolder(name: string): {
  date: string;
  slug: string;
} {
  const match = /^(\d{8})_(.+)$/.exec(name.trim());
  if (!match) throw new Error(`"${name}" no sigue el formato AAAAMMDD_NOMBRE.`);
  return { date: compactDate(match[1]), slug: mailingSlug(match[2]) };
}
