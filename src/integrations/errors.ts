import type { Integration } from "@/types/enums";

/** Error base de cualquier integración externa. */
export class IntegrationError extends Error {
  constructor(
    public integration: Integration,
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "IntegrationError";
  }
}

/** La integración aún no está implementada (V1 solo prepara la arquitectura). */
export class NotImplementedError extends IntegrationError {
  constructor(integration: Integration) {
    super(
      integration,
      `La integración con ${integration} no está implementada en V1.`,
    );
    this.name = "NotImplementedError";
  }
}
