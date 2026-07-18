import "server-only";
import { StorageClient } from "@supabase/storage-js";

/**
 * Acceso a Supabase Storage con la service role key (solo servidor).
 *
 * Se usa `StorageClient` directo en vez del cliente completo de supabase-js:
 * ese inicializa realtime, que en Node 20 (sin WebSocket nativo) lanza
 * "Node.js 20 detected without native WebSocket support".
 *
 * Ojo: Storage vive en el Supabase de producción incluso en desarrollo local
 * (donde los datos van a un Postgres local). Subir archivos en local escribe en
 * el bucket real.
 */

// Facturas: bucket PRIVADO. Se sirven por enlaces firmados de corta duración.
export const INVOICES_BUCKET = "invoices";
// Marca (logo animado, iconos): bucket PÚBLICO — los clientes de correo cargan
// la imagen sin auth, así que un enlace firmado (que expira) no sirve.
export const BRAND_BUCKET = "brand";

let cached: StorageClient | null = null;

function storage(): StorageClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Falta NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY para Storage.",
    );
  }
  cached = new StorageClient(`${url}/storage/v1`, {
    apikey: key,
    Authorization: `Bearer ${key}`,
  });
  return cached;
}

export async function uploadToStorage(
  bucket: string,
  path: string,
  body: ArrayBuffer | Buffer,
  contentType: string,
): Promise<void> {
  const { error } = await storage()
    .from(bucket)
    .upload(path, body, { contentType, upsert: true });
  if (error) throw new Error(`No se pudo subir el archivo: ${error.message}`);
}

/** Enlace firmado de descarga (bucket privado). `expiresIn` en segundos. */
export async function signedUrl(
  bucket: string,
  path: string,
  expiresIn = 60 * 10,
): Promise<string | null> {
  const { data, error } = await storage()
    .from(bucket)
    .createSignedUrl(path, expiresIn);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/** Enlaces firmados para varios paths de una vez (una sola llamada). */
export async function signedUrls(
  bucket: string,
  paths: string[],
  expiresIn = 60 * 10,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const clean = [...new Set(paths.filter(Boolean))];
  if (!clean.length) return out;
  const { data, error } = await storage()
    .from(bucket)
    .createSignedUrls(clean, expiresIn);
  if (error || !data) return out;
  for (const r of data) {
    if (r.path && r.signedUrl) out.set(r.path, r.signedUrl);
  }
  return out;
}

/** URL pública estable (solo para el bucket público de marca). */
export function publicUrl(bucket: string, path: string): string {
  return storage().from(bucket).getPublicUrl(path).data.publicUrl;
}

export async function removeFromStorage(
  bucket: string,
  path: string,
): Promise<void> {
  await storage().from(bucket).remove([path]);
}

/** Crea los buckets si no existen (idempotente). Lo usa el script de setup. */
export async function ensureBuckets(): Promise<void> {
  const s = storage();
  const { data: buckets } = await s.listBuckets();
  const names = new Set((buckets ?? []).map((b) => b.name));
  if (!names.has(INVOICES_BUCKET)) {
    await s.createBucket(INVOICES_BUCKET, { public: false });
  }
  if (!names.has(BRAND_BUCKET)) {
    await s.createBucket(BRAND_BUCKET, { public: true });
  }
}
