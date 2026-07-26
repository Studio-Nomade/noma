import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

function encryptionKey(): Buffer {
  const value = process.env.NOMA_TOKEN_ENCRYPTION_KEY?.trim();
  if (!value) {
    throw new Error(
      "NOMA_TOKEN_ENCRYPTION_KEY no está configurada. Genera una clave base64 de 32 bytes.",
    );
  }

  const key = Buffer.from(value, "base64");
  if (
    key.length !== 32 ||
    key.toString("base64").replace(/=+$/, "") !== value.replace(/=+$/, "")
  ) {
    throw new Error(
      "NOMA_TOKEN_ENCRYPTION_KEY debe ser base64 válido de exactamente 32 bytes.",
    );
  }
  return key;
}

export function encryptToken(plain: string): string {
  if (!plain) throw new Error("No se puede cifrar un token vacío.");

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

export function decryptToken(payload: string): string {
  const [version, ivValue, tagValue, ciphertextValue, ...extra] =
    payload.split(":");
  if (
    version !== VERSION ||
    !ivValue ||
    !tagValue ||
    !ciphertextValue ||
    extra.length > 0
  ) {
    throw new Error("El token cifrado tiene un formato inválido.");
  }

  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      encryptionKey(),
      Buffer.from(ivValue, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error(
      "No se pudo descifrar el token. Revisa la clave de cifrado configurada.",
    );
  }
}
