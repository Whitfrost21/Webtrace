import { observeRequests } from "./webRequest.js";
import { classifyRequest} from "./classifier.js";
import {
  setTabUrl,getTabUrl,
  removeTab
} from "./tabContext.js";

console.log("WebTrace background service worker started");

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) {
    setTabUrl(tabId, changeInfo.url);

    // console.log("[WebTrace] Tab context updated", {
    //   tabId,
    //   url: changeInfo.url
    // });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  removeTab(tabId);
});

observeRequests((details) => {
  const pageUrl=getTabUrl(details.tabId);
  if(!pageUrl){
    return;
  }
  const party=classifyRequest(pageUrl,details.url);
  console.log("[WebTrace]", {
    requestId: details.requestId,
    pageUrl,
    destination:details.url,
    party,
    method: details.method,
    tabId: details.tabId,
    type: details.type,
    timestamp: details.timeStamp
  });
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== "DETECTION_EVENT") return;

  const tabId = sender.tab?.id;
  const pageUrl = sender.tab?.url;

  if (tabId === undefined || !pageUrl) return;

  const payload = message.payload;

const validKinds = ["storage", "geolocation", "cookie","media"];

if (
  !payload ||
  !validKinds.includes(payload.kind) ||
  typeof payload.api !== "string" ||
  typeof payload.action !== "string" ||
  typeof payload.timestamp !== "number"
) {
  return;
}

if (
  payload.kind === "cookie" &&
  (
    payload.api !== "document.cookie" ||
    !["get", "set"].includes(payload.action)
  )
) {
  return;
}

if (
  payload.kind === "media" &&
  (
    payload.api !== "navigator.mediaDevices.getUserMedia" ||
    payload.action !== "getUserMedia"
  )
) {
  return;
}

console.log(`[WebTrace] ${payload.kind} detection`, {
  type: "detection",
  kind: payload.kind,
  timestamp: payload.timestamp,
  tabId,
  pageUrl,
  api: payload.api,
  action: payload.action
});
});
