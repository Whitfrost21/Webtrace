import { getDomain } from "tldts";

export type RequestParty =
  | "first-party"
  | "third-party"
  | "unknown";

function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url
      : null;
  } catch {
    return null;
  }
}

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/\.$/, "");
}

export function getRegistrableDomain(value: string): string | null {
  const url = parseHttpUrl(value);
  if (!url) return null;

  return getDomain(normalizeHostname(url.hostname), {
    allowPrivateDomains: true,
  });
}

export function classifyRequest(
  pageUrl: string,
  requestUrl: string
): RequestParty {
  const page = parseHttpUrl(pageUrl);
  const request = parseHttpUrl(requestUrl);

  if (!page || !request) return "unknown";

  const pageHost = normalizeHostname(page.hostname);
  const requestHost = normalizeHostname(request.hostname);

  // Same host, including localhost or an IP address.
  if (pageHost === requestHost) return "first-party";

  const pageDomain = getRegistrableDomain(pageUrl);
  const requestDomain = getRegistrableDomain(requestUrl);

  if (!pageDomain || !requestDomain) return "unknown";

  return pageDomain === requestDomain
    ? "first-party"
    : "third-party";
}
