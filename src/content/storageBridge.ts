const eventName = "webtrace:storage";

window.addEventListener(eventName, (event) => {
  const detail = (event as CustomEvent).detail;

  if (
    !detail ||
    detail.kind !== "storage" ||
    typeof detail.api !== "string" ||
    typeof detail.action !== "string" ||
    typeof detail.timestamp !== "number"
  ) {
    return;
  }
try {
  void chrome.runtime.sendMessage({
    type: "DETECTION_EVENT",
    payload: detail
  }).catch(() => {
    // Extension may have been reloaded; ignore stale context.
  });
} catch {
  // Handles synchronous context errors.
}
});

window.addEventListener("webtrace:geolocation", (event) => {
  const detail = (event as CustomEvent).detail;

  if (
    !detail ||
    detail.kind !== "geolocation" ||
    detail.api !== "navigator.geolocation" ||
    !["getCurrentPosition", "watchPosition"].includes(detail.action) ||
    typeof detail.timestamp !== "number"
  ) {
    return;
  }

  chrome.runtime.sendMessage({
    type: "DETECTION_EVENT",
    payload: detail
  });
});

//cookie detector bridge
const cookieEventName = "webtrace:cookie";

window.addEventListener(cookieEventName, (event) => {
  const detail = (event as CustomEvent).detail;

  if (
    !detail ||
    detail.kind !== "cookie" ||
    detail.api !== "document.cookie" ||
    !["get", "set"].includes(detail.action) ||
    typeof detail.timestamp !== "number"
  ) {
    return;
  }

  try {
    void chrome.runtime.sendMessage({
      type: "DETECTION_EVENT",
      payload: detail
    }).catch(() => {
      // Extension may have been reloaded; ignore stale context.
    });
  } catch {
    // Handles synchronous context errors.
  }
});

// media detector bridge 

const mediaEventName = "webtrace:media";

window.addEventListener(mediaEventName, (event) => {
  const detail = (event as CustomEvent).detail;

  if (
    !detail ||
    detail.kind !== "media" ||
    detail.api !== "navigator.mediaDevices.getUserMedia" ||
    detail.action !== "getUserMedia" ||
    typeof detail.timestamp !== "number"
  ) {
    return;
  }

  try {
    void chrome.runtime
      .sendMessage({
        type: "DETECTION_EVENT",
        payload: detail,
      })
      .catch(() => {});
  } catch {}
});
