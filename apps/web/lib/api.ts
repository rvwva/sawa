/**
 * Normalised API base URL, including the /api prefix.
 *
 * Ensures NEXT_PUBLIC_API_URL always has a protocol, even if the Railway
 * env var was set without `https://` (which causes the browser to treat it
 * as a relative path and resolve it against the web origin).
 */
export const API_BASE: string = (() => {
  const url = process.env.NEXT_PUBLIC_API_URL ?? "";
  if (!url) return "/api";
  const normalized = url.startsWith("http") ? url.replace(/\/$/, "") : `https://${url.replace(/\/$/, "")}`;
  return `${normalized}/api`;
})();
