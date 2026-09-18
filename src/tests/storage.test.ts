// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

type StorageEventDetail = {
  kind: string;
  api: string;
  action: string;
  timestamp: number;
};

describe("Storage detector", () => {
  let events: StorageEventDetail[] = [];

  beforeAll(async () => {
    window.addEventListener("webtrace:storage", (event) => {
      events.push((event as CustomEvent<StorageEventDetail>).detail);
    });

    // Install the actual detector once in this test environment.
    await import("../detectors/storage");
  });

  beforeEach(() => {
    events = [];
    localStorage.clear();
    sessionStorage.clear();
    events = [];
  });

  const cases = [
    ["localStorage", "getItem"],
    ["localStorage", "setItem"],
    ["localStorage", "removeItem"],
    ["localStorage", "clear"],
    ["sessionStorage", "getItem"],
    ["sessionStorage", "setItem"],
    ["sessionStorage", "removeItem"],
    ["sessionStorage", "clear"],
  ] as const;

  it.each(cases)("detects %s.%s", (area, action) => {
    const storage =
      area === "localStorage"
        ? window.localStorage
        : window.sessionStorage;

    if (action === "setItem") {
      storage.setItem("key", "value");
    } else if (action === "getItem") {
      storage.getItem("key");
    } else if (action === "removeItem") {
      storage.removeItem("key");
    } else {
      storage.clear();
    }

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: "storage",
      api: area,
      action,
    });
    expect(typeof events[0].timestamp).toBe("number");
  });

  it("preserves storage values", () => {
    localStorage.setItem("key", "value");

    expect(localStorage.getItem("key")).toBe("value");

    localStorage.removeItem("key");

    expect(localStorage.getItem("key")).toBeNull();
  });
});
