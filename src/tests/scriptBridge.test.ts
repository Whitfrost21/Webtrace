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

beforeAll(async () => {
  vi.stubGlobal("chrome", {
    runtime: { sendMessage },
  });

  await import("../content/scriptBridge");
});

beforeEach(() => {
  sendMessage.mockClear();
});

describe("Detection event bridge", () => {
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

describe("cookie bridge", () => {
  it("forwards a valid cookie event", () => {
    const payload = {
      kind: "cookie",
      api: "document.cookie",
      action: "get",
      timestamp: Date.now(),
    };

    window.dispatchEvent(
      new CustomEvent("webtrace:cookie", {
        detail: payload,
      })
    );

    expect(sendMessage).toHaveBeenCalledWith({
      type: "DETECTION_EVENT",
      payload,
    });
  });

  it("forwards cookie set events", () => {
    window.dispatchEvent(
      new CustomEvent("webtrace:cookie", {
        detail: {
          kind: "cookie",
          api: "document.cookie",
          action: "set",
          timestamp: Date.now(),
        },
      })
    );

    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it("ignores an invalid cookie kind", () => {
    window.dispatchEvent(
      new CustomEvent("webtrace:cookie", {
        detail: {
          kind: "storage",
          api: "document.cookie",
          action: "get",
          timestamp: Date.now(),
        },
      })
    );

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("ignores an invalid cookie API", () => {
    window.dispatchEvent(
      new CustomEvent("webtrace:cookie", {
        detail: {
          kind: "cookie",
          api: "document.cookies",
          action: "get",
          timestamp: Date.now(),
        },
      })
    );

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("ignores an invalid cookie action", () => {
    window.dispatchEvent(
      new CustomEvent("webtrace:cookie", {
        detail: {
          kind: "cookie",
          api: "document.cookie",
          action: "delete",
          timestamp: Date.now(),
        },
      })
    );

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("ignores an invalid timestamp", () => {
    window.dispatchEvent(
      new CustomEvent("webtrace:cookie", {
        detail: {
          kind: "cookie",
          api: "document.cookie",
          action: "get",
          timestamp: "invalid",
        },
      })
    );

    expect(sendMessage).not.toHaveBeenCalled();
  });
});

describe("media bridge", () => {
  it("forwards a valid media event", () => {
    const payload = {
      kind: "media",
      api: "navigator.mediaDevices.getUserMedia",
      action: "getUserMedia",
      timestamp: Date.now(),
    };

    window.dispatchEvent(
      new CustomEvent("webtrace:media", {
        detail: payload,
      })
    );

    expect(sendMessage).toHaveBeenCalledWith({
      type: "DETECTION_EVENT",
      payload,
    });
  });

  it("ignores an invalid media kind", () => {
    window.dispatchEvent(
      new CustomEvent("webtrace:media", {
        detail: {
          kind: "storage",
          api: "navigator.mediaDevices.getUserMedia",
          action: "getUserMedia",
          timestamp: Date.now(),
        },
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
          timestamp: Date.now(),
        },
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
          timestamp: Date.now(),
        },
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
          timestamp: "invalid",
        },
      })
    );

    expect(sendMessage).not.toHaveBeenCalled();
  });
});

describe("canvas bridge", () => {
  it("forwards a valid toDataURL event", () => {
    const payload = {
      kind: "canvas",
      api: "HTMLCanvasElement.toDataURL",
      action: "toDataURL",
      timestamp: Date.now(),
    };

    window.dispatchEvent(
      new CustomEvent("webtrace:canvas", {
        detail: payload,
      })
    );

    expect(sendMessage).toHaveBeenCalledWith({
      type: "DETECTION_EVENT",
      payload,
    });
  });

  it("forwards a valid getImageData event", () => {
    const payload = {
      kind: "canvas",
      api: "CanvasRenderingContext2D.getImageData",
      action: "getImageData",
      timestamp: Date.now(),
    };

    window.dispatchEvent(
      new CustomEvent("webtrace:canvas", {
        detail: payload,
      })
    );

    expect(sendMessage).toHaveBeenCalledWith({
      type: "DETECTION_EVENT",
      payload,
    });
  });

  it("ignores an invalid canvas kind", () => {
    window.dispatchEvent(
      new CustomEvent("webtrace:canvas", {
        detail: {
          kind: "storage",
          api: "HTMLCanvasElement.toDataURL",
          action: "toDataURL",
          timestamp: Date.now(),
        },
      })
    );

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("ignores an invalid canvas API", () => {
    window.dispatchEvent(
      new CustomEvent("webtrace:canvas", {
        detail: {
          kind: "canvas",
          api: "HTMLCanvasElement.toDataURL.fake",
          action: "toDataURL",
          timestamp: Date.now(),
        },
      })
    );

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("ignores an invalid canvas action", () => {
    window.dispatchEvent(
      new CustomEvent("webtrace:canvas", {
        detail: {
          kind: "canvas",
          api: "HTMLCanvasElement.toDataURL",
          action: "fakeAction",
          timestamp: Date.now(),
        },
      })
    );

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("ignores an invalid timestamp", () => {
    window.dispatchEvent(
      new CustomEvent("webtrace:canvas", {
        detail: {
          kind: "canvas",
          api: "HTMLCanvasElement.toDataURL",
          action: "toDataURL",
          timestamp: "invalid",
        },
      })
    );

    expect(sendMessage).not.toHaveBeenCalled();
  });
});
