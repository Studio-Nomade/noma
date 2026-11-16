import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyGoogleDenial } from "./errors";

describe("classifyGoogleDenial", () => {
  it("detecta la API desactivada en Google Cloud", () => {
    const d = classifyGoogleDenial(
      403,
      {
        error: {
          code: 403,
          status: "PERMISSION_DENIED",
          errors: [{ reason: "accessNotConfigured" }],
          details: [{ reason: "SERVICE_DISABLED" }],
        },
      },
      "Google Drive",
    );
    assert.equal(d.kind, "api_disabled");
    assert.equal(d.googleReason, "SERVICE_DISABLED");
  });

  it("detecta el scope no concedido", () => {
    const d = classifyGoogleDenial(
      403,
      {
        error: {
          status: "PERMISSION_DENIED",
          details: [{ reason: "ACCESS_TOKEN_SCOPE_INSUFFICIENT" }],
        },
      },
      "Google Drive",
    );
    assert.equal(d.kind, "scope");
    assert.match(d.message, /marca la casilla de Google Drive/);
  });

  it("trata un 401 sin cuerpo como scope", () => {
    assert.equal(classifyGoogleDenial(401, null, "Google Drive").kind, "scope");
  });

  it("un 403 sin motivo conocido es acceso al archivo o política", () => {
    const d = classifyGoogleDenial(
      403,
      { error: { errors: [{ reason: "forbidden" }] } },
      "Google Drive",
    );
    assert.equal(d.kind, "forbidden");
  });
});
