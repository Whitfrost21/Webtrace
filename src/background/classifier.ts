import { getDomain } from "tldts";

export type RequestParty = "first-party" | "third-party";
export function getRegistrableDomain(url:string):string |null {
 return getDomain(url) 
}

export function classifyRequest(
  pageUrl: string,
  requestUrl: string
): RequestParty {
  const pageDomain = getRegistrableDomain(pageUrl);
  const requestDomain = getRegistrableDomain(requestUrl)
  
  if(!pageDomain||!requestDomain)return "third-party"

 return pageDomain==requestDomain?"first-party" :"third-party"
}
