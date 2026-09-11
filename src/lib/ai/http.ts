import "server-only";
import { AIError } from "./errors";

/** Bound streamed response bytes before decoding or parsing JSON. */
export async function readJSON(response: Response, maxBytes = 512_000): Promise<unknown> {
  if (!response.ok) {
    await response.body?.cancel();
    throw new AIError(response.status === 401 || response.status === 403 ? "AUTHENTICATION" : response.status === 429 ? "RATE_LIMIT" : "PROVIDER");
  }
  if (!response.body) throw new AIError("INVALID_OUTPUT");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new AIError("INVALID_OUTPUT"); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    try { return JSON.parse(new TextDecoder().decode(bytes)); }
    catch { throw new AIError("INVALID_OUTPUT"); }
  } finally { reader.releaseLock(); }
}
