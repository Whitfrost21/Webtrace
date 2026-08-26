export type RequestParty = "first-party" | "third-party";

export function classifyRequest(
  pageUrl: string,
  requestUrl: string
): RequestParty {
  const page = new URL(pageUrl);
  const request = new URL(requestUrl);

  if (page.hostname === request.hostname) {
    return "first-party";
  }

  return "third-party";
}
