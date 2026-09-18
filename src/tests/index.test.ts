import { describe, expect, it, vi, beforeEach } from "vitest";

const listeners: Array<(...args: any[]) => void> = [];

vi.mock("../background/webRequest.js", () => ({
  observeRequests: vi.fn()
}));

vi.mock("../background/classifier.js", () => ({
  classifyRequest: vi.fn()
}));

vi.mock("../background/tabContext.js", () => ({
  setTabUrl: vi.fn(),
  getTabUrl: vi.fn(),
  removeTab: vi.fn()
}));

vi.stubGlobal("chrome", {
  tabs: {
    onUpdated: {
      addListener: vi.fn()
    },
    onRemoved: {
      addListener: vi.fn()
    }
  },
  runtime: {
    onMessage: {
      addListener: vi.fn((callback) => {
        listeners.push(callback);
      })
    }
  }
});

await import("../background/index.js");

const messageListener = listeners[0];

describe("detection event validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts a valid cookie get event", () => {
    const consoleSpy = vi
      .spyOn(console, "log")
      .mockImplementation(() => {});

    messageListener(
      {
        type: "DETECTION_EVENT",
        payload: {
          kind: "cookie",
          api: "document.cookie",
          action: "get",
          timestamp: Date.now()
        }
      },
      {
        tab: {
          id: 123,
          url: "https://example.com"
        }
      }
    );

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("accepts a valid cookie set event", () => {
    const consoleSpy = vi
      .spyOn(console, "log")
      .mockImplementation(() => {});

    messageListener(
      {
        type: "DETECTION_EVENT",
        payload: {
          kind: "cookie",
          api: "document.cookie",
          action: "set",
          timestamp: Date.now()
        }
      },
      {
        tab: {
          id: 123,
          url: "https://example.com"
        }
      }
    );

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("rejects an invalid cookie API", () => {
    const consoleSpy = vi
      .spyOn(console, "log")
      .mockImplementation(() => {});

    messageListener(
      {
        type: "DETECTION_EVENT",
        payload: {
          kind: "cookie",
          api: "document.cookies",
          action: "get",
          timestamp: Date.now()
        }
      },
      {
        tab: {
          id: 123,
          url: "https://example.com"
        }
      }
    );

    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("rejects an invalid cookie action", () => {
    const consoleSpy = vi
      .spyOn(console, "log")
      .mockImplementation(() => {});

    messageListener(
      {
        type: "DETECTION_EVENT",
        payload: {
          kind: "cookie",
          api: "document.cookie",
          action: "delete",
          timestamp: Date.now()
        }
      },
      {
        tab: {
          id: 123,
          url: "https://example.com"
        }
      }
    );

    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
