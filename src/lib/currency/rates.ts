import { desc } from "drizzle-orm";
import { db } from "@/db";
import { exchangeRates } from "@/db/schema";
import type { Rates } from "./convert";

const API_URL = process.env.MINDICADOR_API_URL ?? "https://mindicador.cl/api";

interface MindicadorResponse {
  fecha: string;
  uf: { valor: number; fecha: string };
  dolar: { valor: number; fecha: string };
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
export async function fetchRatesFromSource(): Promise<FetchedRates> {
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
