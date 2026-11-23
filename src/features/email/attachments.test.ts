import assert from "node:assert/strict";
import test from "node:test";
import { formatBytes, matchAttachments, mimeTypeFor } from "./attachments";

const ZIP = {
  gid: "1",
  name: "20261127_Decision_Summit_Cooperativas.zip",
  size: 10_385_886,
  downloadable: true,
  createdAt: "2026-11-23T17:00:00.000Z",
};
const PNG = {
  gid: "2",
  name: "Vista previa Invitación.png",
  size: 1_299_858,
  downloadable: true,
  createdAt: "2026-11-23T16:00:00.000Z",
};

test("adjuntos: nombre exacto, sin extensión, sin tildes y parcial único", () => {
  assert.deepEqual(
    matchAttachments(["20261127_Decision_Summit_Cooperativas.zip"], [ZIP, PNG])
      .matched,
    [ZIP],
  );
  assert.deepEqual(
    matchAttachments(["20261127_decision_summit_cooperativas"], [ZIP, PNG])
      .matched,
    [ZIP],
  );
  assert.deepEqual(
    matchAttachments(["vista previa invitacion.png"], [ZIP, PNG]).matched,
    [PNG],
  );
  assert.deepEqual(matchAttachments(["Decision_Summit"], [ZIP, PNG]).matched, [
    ZIP,
  ]);
});

test("adjuntos: faltantes, ambiguos y el más reciente ante nombres repetidos", () => {
  const result = matchAttachments(["informe.pdf"], [ZIP, PNG]);
  assert.deepEqual(result.missing, ["informe.pdf"]);
  // «Vista» calza con dos archivos distintos: ambiguo, no se adivina.
  const other = { ...PNG, gid: "3", name: "Vista general.png" };
  assert.deepEqual(matchAttachments(["Vista"], [PNG, other]).missing, [
    "Vista",
  ]);
  const older = { ...ZIP, gid: "0", createdAt: "2026-11-20T10:00:00.000Z" };
  assert.equal(matchAttachments([ZIP.name], [older, ZIP]).matched[0].gid, "1");
});

test("adjuntos: tamaño legible y tipo MIME", () => {
  assert.equal(formatBytes(10_385_886), "9,9 MB");
  assert.equal(formatBytes(850_000), "830 KB");
  assert.equal(formatBytes(null), "");
  assert.equal(mimeTypeFor("a.ZIP"), "application/zip");
  assert.equal(mimeTypeFor("correo.html"), "text/html");
  assert.equal(mimeTypeFor("sin-extension"), "application/octet-stream");
});
