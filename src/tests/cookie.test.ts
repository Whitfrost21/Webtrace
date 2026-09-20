// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach } from "vitest";
import "../detectors/cookie";

describe("cookie detector", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("detects document.cookie reads", () => {
    const events: CustomEvent[] = [];

    window.addEventListener("webtrace:cookie", (event) => {
      events.push(event as CustomEvent);
    });

    void document.cookie;

    expect(events).toHaveLength(1);

    expect(events[0].detail).toMatchObject({
      kind: "cookie",
      api: "document.cookie",
      action: "get"
    });

    expect(typeof events[0].detail.timestamp).toBe("number");
  });

  it("detects document.cookie writes", () => {
    const events: CustomEvent[] = [];

    window.addEventListener("webtrace:cookie", (event) => {
      events.push(event as CustomEvent);
    });

    document.cookie = "test=value";

    expect(events).toHaveLength(1);

    expect(events[0].detail).toMatchObject({
      kind: "cookie",
      api: "document.cookie",
      action: "set"
    });

    expect(typeof events[0].detail.timestamp).toBe("number");
  });

  it("does not expose the cookie value in the detection event", () => {
    const events: CustomEvent[] = [];

    window.addEventListener("webtrace:cookie", (event) => {
      events.push(event as CustomEvent);
    });

    document.cookie = "secret=super-sensitive-value";

    expect(events[0].detail).not.toHaveProperty("value");
    expect(events[0].detail).not.toHaveProperty("cookie");
  });

  it("preserves normal document.cookie behavior", () => {
    document.cookie = "test=value";

    expect(document.cookie).toContain("test=value");
  });
});
