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
