import { desc } from "drizzle-orm";
import { db } from "@/db";
import { exchangeRates } from "@/db/schema";
import type { Rates } from "./convert";

const API_URL = process.env.MINDICADOR_API_URL ?? "https://mindicador.cl/api";
const CMF_API_URL =
  process.env.CMF_API_URL ?? "https://api.cmfchile.cl/api-sbifv3/recursos_api";

interface MindicadorResponse {
  fecha: string;
  uf: { valor: number; fecha: string };
  dolar: { valor: number; fecha: string };
}

interface CmfIndicatorResponse {
  UFs?: { Valor: string; Fecha: string }[];
  Dolares?: { Valor: string; Fecha: string }[];
}

export interface FetchedRates {
  date: string; // YYYY-MM-DD
  ufClp: number;
  usdClp: number;
}

/**
 * Obtiene UF y dólar observado del día desde mindicador.cl (Banco Central).
 * No toca la base de datos.
 */
async function fetchRatesFromMindicador(): Promise<FetchedRates> {
  const res = await fetch(API_URL, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`mindicador respondió ${res.status}`);
  }
  const data = (await res.json()) as MindicadorResponse;
  const date = (data.uf?.fecha ?? data.fecha ?? new Date().toISOString()).slice(
    0,
    10,
  );
  return {
    date,
    ufClp: data.uf.valor,
    usdClp: data.dolar.valor,
  };
}

function parseCmfValue(value: string): number {
  return Number(value.replace(/\./g, "").replace(",", "."));
}

/**
 * Fuente oficial de respaldo. CMF exige una API key, siempre server-side.
 * UF puede traer fecha calendario y dólar la última fecha hábil disponible.
 */
async function fetchRatesFromCmf(apiKey: string): Promise<FetchedRates> {
  const query = `apikey=${encodeURIComponent(apiKey)}&formato=json`;
  const [ufResponse, usdResponse] = await Promise.all([
    fetch(`${CMF_API_URL}/uf?${query}`, { cache: "no-store" }),
    fetch(`${CMF_API_URL}/dolar?${query}`, { cache: "no-store" }),
  ]);
  if (!ufResponse.ok || !usdResponse.ok) {
    throw new Error(
      `CMF respondió UF ${ufResponse.status} / dólar ${usdResponse.status}`,
    );
  }
  const [ufData, usdData] = (await Promise.all([
    ufResponse.json(),
    usdResponse.json(),
  ])) as [CmfIndicatorResponse, CmfIndicatorResponse];
  const uf = ufData.UFs?.[0];
  const usd = usdData.Dolares?.[0];
  const ufClp = parseCmfValue(uf?.Valor ?? "");
  const usdClp = parseCmfValue(usd?.Valor ?? "");
  if (!uf || !usd || !Number.isFinite(ufClp) || !Number.isFinite(usdClp)) {
    throw new Error("CMF entregó una respuesta sin UF o dólar válidos.");
  }
  return { date: uf.Fecha, ufClp, usdClp };
}

export async function fetchRatesFromSource(): Promise<FetchedRates> {
  const apiKey = process.env.CMF_API_KEY;
  if (apiKey) {
    try {
      return await fetchRatesFromCmf(apiKey);
    } catch {
      // Si CMF no responde, mindicador mantiene operativo el sync diario.
    }
  }
  try {
    return await fetchRatesFromMindicador();
  } catch (primaryError) {
    if (!apiKey) throw primaryError;
    return fetchRatesFromCmf(apiKey);
  }
}

/**
 * Sincroniza las tasas del día en `exchange_rates` (upsert por fecha).
 */
export async function syncRates(): Promise<FetchedRates> {
  const rates = await fetchRatesFromSource();
  await db
    .insert(exchangeRates)
    .values({
      date: rates.date,
      ufClp: String(rates.ufClp),
      usdClp: String(rates.usdClp),
    })
    .onConflictDoUpdate({
      target: exchangeRates.date,
      set: { ufClp: String(rates.ufClp), usdClp: String(rates.usdClp) },
    });
  return rates;
}

/**
 * Devuelve la última tasa conocida (la del día o la más reciente disponible).
 * Si no hay datos, retorna ceros y `stale = true`.
 */
export async function getLatestRates(): Promise<Rates & { stale: boolean }> {
  const [row] = await db
    .select()
    .from(exchangeRates)
    .orderBy(desc(exchangeRates.date))
    .limit(1);

  if (!row) return { ufClp: 0, usdClp: 0, stale: true };
  const today = new Date().toISOString().slice(0, 10);
  return {
    ufClp: Number(row.ufClp ?? 0),
    usdClp: Number(row.usdClp ?? 0),
    stale: row.date !== today,
  };
}
