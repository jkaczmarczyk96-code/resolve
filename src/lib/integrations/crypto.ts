import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { getGoogleIntegrationConfig } from "./config";

function key() {
  const value = Buffer.from(getGoogleIntegrationConfig().encryptionKey, "base64url");
  if (value.length !== 32) throw new Error("Integration encryption is not configured.");
  return value;
}

export function encryptCredential(value: string) {
  if (!value) throw new Error("Missing integration credential.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptCredential(value: string) {
  const [version, ivValue, tagValue, ciphertextValue, extra] = value.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !ciphertextValue || extra) throw new Error("Invalid integration credential.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextValue, "base64url")), decipher.final()]).toString("utf8");
}
