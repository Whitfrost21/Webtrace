interface WebRequestDetails {
  requestId: string;
  url: string;
  method: string;
  tabId: number;
  type: chrome.webRequest.ResourceType;
  timeStamp: number;
}

type WebRequestListener = (details: WebRequestDetails) => void;

export function observeRequests(
  listener: WebRequestListener
): void {
  const event = chrome.webRequest.onBeforeRequest as unknown as {
    addListener(
      callback: WebRequestListener,
      filter: chrome.webRequest.RequestFilter
    ): void;
  };

  event.addListener(listener, {
    urls: ["<all_urls>"]
  });
}
