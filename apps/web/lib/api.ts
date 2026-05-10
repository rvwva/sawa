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

/**
 * Normalised web app base URL for constructing public-facing links
 * (e.g. /assess/:token).
 *
 * Prefers NEXT_PUBLIC_APP_URL (baked in at build time).
 * In the browser, falls back to window.location.origin so the correct
 * domain is always used even if the env var is misconfigured.
 */
export function getWebBase(): string {
  const env = process.env.NEXT_PUBLIC_APP_URL ?? "";
  if (env) {
    return env.startsWith("http") ? env.replace(/\/$/, "") : `https://${env.replace(/\/$/, "")}`;
  }
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}
