const privateRoots = ["/dashboard", "/problems", "/notifications", "/settings"];

export function isPrivatePath(pathname: string) {
  return privateRoots.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

/** Return only known, same-origin private URLs. Reject ambiguous browser normalization. */
export function safeReturnTo(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048 || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return "/dashboard";
  try {
    const url = new URL(value, "https://resolve.invalid");
    if (url.origin !== "https://resolve.invalid" || !isPrivatePath(url.pathname) || /%2f|%5c|%0[0-9a-f]|%1[0-9a-f]/i.test(url.pathname)) return "/dashboard";
    return `${url.pathname}${url.search}`;
  } catch {
    return "/dashboard";
  }
}
