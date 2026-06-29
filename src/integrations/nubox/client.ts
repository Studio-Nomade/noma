import { NotImplementedError } from "../errors";
import type { NuboxInvoiceDraft, NuboxDocumentResponse } from "./types";

/**
 * Cliente de la API de Nubox (creación de documentos tributarios).
 *
 * ⚠️ V1: NO implementado. La estructura queda lista para V2/V3.
 * Regla: NO emitir automáticamente; crear borrador para revisión y emisión manual.
 * Variables de entorno requeridas (cuando se implemente):
 *   NUBOX_API_URL · NUBOX_CLIENT_ID · NUBOX_CLIENT_SECRET
 *
 * Ver docs/technical/integrations/nubox.md
 */
export class NuboxClient {
  private readonly baseUrl = process.env.NUBOX_API_URL ?? "";
  private readonly clientId = process.env.NUBOX_CLIENT_ID ?? "";
  private readonly clientSecret = process.env.NUBOX_CLIENT_SECRET ?? "";

  isConfigured(): boolean {
    return Boolean(this.baseUrl && this.clientId && this.clientSecret);
  }

  /** Crea el documento como BORRADOR en Nubox (no emite). */
  async createInvoiceDraft(
    draft: NuboxInvoiceDraft,
  ): Promise<NuboxDocumentResponse> {
    void draft; // V1: stub
    throw new NotImplementedError("nubox");
  }
}

export const nubox = new NuboxClient();
