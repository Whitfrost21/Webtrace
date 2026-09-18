// @vitest-environment jsdom
import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const sendMessage = vi.fn().mockResolvedValue(undefined);

//storage bridge tests
describe("Detection event bridge", () => {

  beforeAll(async () => {
    vi.stubGlobal("chrome", {
      runtime: { sendMessage },
    });

    await import("../content/storageBridge");
  });

  beforeEach(() => {
    sendMessage.mockClear();
  });

  it("forwards valid storage events", () => {
    const payload = {
      kind: "storage",
      api: "localStorage",
      action: "setItem",
      timestamp: 123,
    };

    window.dispatchEvent(
      new CustomEvent("webtrace:storage", { detail: payload })
    );

    expect(sendMessage).toHaveBeenCalledWith({
      type: "DETECTION_EVENT",
      payload,
    });
  });

  it("ignores malformed storage events", () => {
    window.dispatchEvent(
      new CustomEvent("webtrace:storage", {
        detail: { kind: "storage" },
      })
    );

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("forwards valid geolocation events", () => {
    const payload = {
      kind: "geolocation",
      api: "navigator.geolocation",
      action: "watchPosition",
      timestamp: 123,
    };

    window.dispatchEvent(
      new CustomEvent("webtrace:geolocation", { detail: payload })
    );

    expect(sendMessage).toHaveBeenCalledWith({
      type: "DETECTION_EVENT",
      payload,
    });
  });

  it("ignores unsupported geolocation actions", () => {
    window.dispatchEvent(
      new CustomEvent("webtrace:geolocation", {
        detail: {
          kind: "geolocation",
          api: "navigator.geolocation",
          action: "unsupported",
          timestamp: 123,
        },
      })
    );

    expect(sendMessage).not.toHaveBeenCalled();
  });
});

//cookie bridge tests 
describe("cookie bridge", () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage: vi.fn().mockResolvedValue(undefined)
      }
    });
  });

  it("forwards a valid cookie event", async () => {
    await import("../content/storageBridge");

    window.dispatchEvent(
      new CustomEvent("webtrace:cookie", {
        detail: {
          kind: "cookie",
          api: "document.cookie",
          action: "get",
          timestamp: Date.now()
        }
      })
    );

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: "DETECTION_EVENT",
      payload: expect.objectContaining({
        kind: "cookie",
        api: "document.cookie",
        action: "get"
      })
    });
  });

  it("forwards cookie set events", async () => {
    await import("../content/storageBridge");

    window.dispatchEvent(
      new CustomEvent("webtrace:cookie", {
        detail: {
          kind: "cookie",
          api: "document.cookie",
          action: "set",
          timestamp: Date.now()
        }
      })
    );

    expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
  });

  it("ignores an invalid cookie kind", async () => {
    await import("../content/storageBridge");

    window.dispatchEvent(
      new CustomEvent("webtrace:cookie", {
        detail: {
          kind: "storage",
          api: "document.cookie",
          action: "get",
          timestamp: Date.now()
        }
      })
    );

    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it("ignores an invalid cookie API", async () => {
    await import("../content/storageBridge");

    window.dispatchEvent(
      new CustomEvent("webtrace:cookie", {
        detail: {
          kind: "cookie",
          api: "document.cookies",
          action: "get",
          timestamp: Date.now()
        }
      })
    );

    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it("ignores an invalid cookie action", async () => {
    await import("../content/storageBridge");

    window.dispatchEvent(
      new CustomEvent("webtrace:cookie", {
        detail: {
          kind: "cookie",
          api: "document.cookie",
          action: "delete",
          timestamp: Date.now()
        }
      })
    );

    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it("ignores an invalid timestamp", async () => {
    await import("../content/storageBridge");

    window.dispatchEvent(
      new CustomEvent("webtrace:cookie", {
        detail: {
          kind: "cookie",
          api: "document.cookie",
          action: "get",
          timestamp: "invalid"
        }
      })
    );

    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });
});

// media bridge tests 
//
describe("media bridge", () => {
  beforeAll(async () => {
    await import("../content/storageBridge");
  });

  beforeEach(() => {
    sendMessage.mockClear();
  });

 it("forwards a valid media event", () => {
  const payload = {
    kind: "media",
    api: "navigator.mediaDevices.getUserMedia",
    action: "getUserMedia",
    timestamp: Date.now()
  };

  window.dispatchEvent(
    new CustomEvent("webtrace:media", {
      detail: payload
    })
  );

  expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
    type: "DETECTION_EVENT",
    payload
  });
});

  it("ignores an invalid media kind", () => {
    window.dispatchEvent(
      new CustomEvent("webtrace:media", {
        detail: {
          kind: "storage",
          api: "navigator.mediaDevices.getUserMedia",
          action: "getUserMedia",
          timestamp: Date.now()
        }
      })
    );

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("ignores an invalid media API", () => {
    window.dispatchEvent(
      new CustomEvent("webtrace:media", {
        detail: {
          kind: "media",
          api: "navigator.mediaDevices.getUserMedia.fake",
          action: "getUserMedia",
          timestamp: Date.now()
        }
      })
    );

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("ignores an invalid media action", () => {
    window.dispatchEvent(
      new CustomEvent("webtrace:media", {
        detail: {
          kind: "media",
          api: "navigator.mediaDevices.getUserMedia",
          action: "requestCamera",
          timestamp: Date.now()
        }
      })
    );

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("ignores an invalid timestamp", () => {
    window.dispatchEvent(
      new CustomEvent("webtrace:media", {
        detail: {
          kind: "media",
          api: "navigator.mediaDevices.getUserMedia",
          action: "getUserMedia",
          timestamp: "invalid"
        }
      })
    );

    expect(sendMessage).not.toHaveBeenCalled();
  });
});
