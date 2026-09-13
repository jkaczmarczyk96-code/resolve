export function hasSameOrigin(request: Request, expectedOrigin: string) {
  const origin = request.headers.get("origin");
  if (origin) return origin === expectedOrigin;
  const referer = request.headers.get("referer");
  if (referer) {
    try { return new URL(referer).origin === expectedOrigin; } catch { return false; }
  }
  return request.headers.get("sec-fetch-site") === "same-origin";
}
