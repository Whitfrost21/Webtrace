import { observeRequests } from "./webRequest.js";
import { classifyRequest } from "./classifier.js";
import { setTabUrl, getTabUrl, removeTab } from "./tabContext.js";
import { addEvent, flushSession, exportSessionsJson,startNewSession} from "../storage/eventStore.js";
import { clearAllSessions } from "../storage/eventStore.js";

console.log("[WebTrace] Background service worker started");

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) setTabUrl(tabId, changeInfo.url);
});

chrome.tabs.onRemoved.addListener(removeTab);

observeRequests(async details => {
  const pageUrl = getTabUrl(details.tabId);
  if (!pageUrl) return;

  await addEvent({
    type: "network",
    requestId: details.requestId,
    pageUrl,
    destination: details.url,
    party: classifyRequest(pageUrl, details.url),
    method: details.method,
    tabId: details.tabId,
    resourceType: details.type,
    timestamp: details.timeStamp
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "EXPORT_SESSIONS_JSON") {
    exportSessionsJson()
      .then(data => sendResponse({ ok: true, data }))
      .catch(error => sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      }));
    return true;
  }

  if (message?.type !== "DETECTION_EVENT") return;

  const tabId = sender.tab?.id;
  const pageUrl = sender.tab?.url;
  if (tabId === undefined || !pageUrl) return;

  const payload = message.payload;
  const validKinds = ["storage", "geolocation", "cookie", "media", "canvas", "webrtc"];
  if (
    !payload ||
    !validKinds.includes(payload.kind) ||
    typeof payload.api !== "string" ||
    typeof payload.action !== "string" ||
    typeof payload.timestamp !== "number"
  ) return;

  if (payload.kind === "cookie" &&
      (payload.api !== "document.cookie" || !["get", "set"].includes(payload.action))) return;

  if (payload.kind === "media" &&
      (payload.api !== "navigator.mediaDevices.getUserMedia" || payload.action !== "getUserMedia")) return;

  if (payload.kind === "canvas" &&
      (![
        "HTMLCanvasElement.toDataURL",
        "CanvasRenderingContext2D.getImageData"
      ].includes(payload.api) ||
       !["toDataURL", "getImageData"].includes(payload.action))) return;

  if (payload.kind === "webrtc" &&
      (payload.api !== "RTCPeerConnection" || payload.action !== "constructor")) return;

  void addEvent({
    type: "detection",
    kind: payload.kind,
    timestamp: payload.timestamp,
    tabId,
    pageUrl,
    api: payload.api,
    action: payload.action
  });
});

chrome.runtime.onStartup.addListener(() => {
  void startNewSession();
});

// A best-effort flush only; MV3 service workers may be stopped without this event.
chrome.runtime.onSuspend.addListener(() => {
  void flushSession();
});

//delete collected data 
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "CLEAR_WEBTRACE_DATA") return;

  clearAllSessions()
    .then(() => sendResponse({ success: true }))
    .catch((error) => {
      console.error("[WebTrace] Failed to clear data", error);
      sendResponse({ success: false });
    });

  return true;
});


