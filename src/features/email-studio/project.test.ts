import assert from "node:assert/strict";
import {
  emailStudioProjectSchema,
  emailStudioProjectStatusSchema,
  normalizeEmailStudioProjectInput,
} from "./project-schema";

const clientId = "11111111-1111-4111-8111-111111111111";
const nomaProjectId = "22222222-2222-4222-8222-222222222222";

const normalized = normalizeEmailStudioProjectInput({
  name: "  Newsletter lanzamiento  ",
  clientId,
  nomaProjectId,
  description: "  Correo aprobado por el cliente.  ",
});

assert.deepEqual(normalized, {
  name: "Newsletter lanzamiento",
  clientId,
  nomaProjectId,
  description: "Correo aprobado por el cliente.",
});

assert.deepEqual(
  normalizeEmailStudioProjectInput({
    name: "Correo transaccional",
    clientId,
    nomaProjectId: "",
    description: "",
  }),
  {
    name: "Correo transaccional",
    clientId,
    nomaProjectId: null,
    description: null,
  },
);

assert.throws(
  () =>
    emailStudioProjectSchema.parse({
      name: "x",
      clientId,
      nomaProjectId: "",
      description: "",
    }),
  /al menos 2 caracteres/,
);

assert.throws(
  () =>
    emailStudioProjectSchema.parse({
      name: "Proyecto",
      clientId: "cliente-invalido",
      nomaProjectId: "",
      description: "",
    }),
  /Selecciona un cliente/,
);

assert.equal(emailStudioProjectStatusSchema.parse("active"), "active");
assert.equal(emailStudioProjectStatusSchema.parse("archived"), "archived");
assert.throws(() => emailStudioProjectStatusSchema.parse("deleted"));
