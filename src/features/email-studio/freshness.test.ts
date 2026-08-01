import assert from "node:assert/strict";
import { isEmailStudioDocumentCurrent } from "./freshness";

const generatedAt = new Date("2026-07-30T12:00:00.000Z");

assert.equal(
  isEmailStudioDocumentCurrent({
    currentDocument: { version: "1.0" },
    generatedAt,
    updatedAt: generatedAt,
  }),
  true,
);
assert.equal(
  isEmailStudioDocumentCurrent({
    currentDocument: { version: "1.0" },
    generatedAt,
    updatedAt: new Date("2026-07-30T12:00:01.000Z"),
  }),
  false,
);
assert.equal(
  isEmailStudioDocumentCurrent({
    currentDocument: null,
    generatedAt,
    updatedAt: generatedAt,
  }),
  false,
);
