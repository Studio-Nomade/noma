import { NotImplementedError } from "../errors";
import type { ChipaxClientFinance } from "./types";

/**
 * Cliente de la API de Chipax (visualización financiera).
 *
 * ⚠️ V1: NO implementado. La estructura queda lista para V2/V3.
 * Variables de entorno requeridas (cuando se implemente):
 *   CHIPAX_API_URL · CHIPAX_APP_ID · CHIPAX_SECRET_KEY
 *
 * Ver docs/technical/integrations/chipax.md
 */
export class ChipaxClient {
  private readonly baseUrl = process.env.CHIPAX_API_URL ?? "";
  private readonly appId = process.env.CHIPAX_APP_ID ?? "";
  private readonly secretKey = process.env.CHIPAX_SECRET_KEY ?? "";

  /** ¿Está configurada la integración? */
  isConfigured(): boolean {
    return Boolean(this.baseUrl && this.appId && this.secretKey);
  }

  /** Resumen financiero + facturas de un cliente (por RUT o chipaxId). */
  async getClientFinance(ref: {
    rut?: string;
    chipaxId?: string;
  }): Promise<ChipaxClientFinance> {
    void ref; // V1: stub
    throw new NotImplementedError("chipax");
  }
}

export const chipax = new ChipaxClient();
