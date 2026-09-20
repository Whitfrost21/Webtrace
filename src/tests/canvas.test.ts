// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from "vitest";

describe("canvas detector", () => {
  let toDataURLSpy: ReturnType<typeof vi.fn>;
  let getImageDataSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();

  toDataURLSpy = vi.fn().mockReturnValue(
    "data:image/png;base64,test"
  );

  getImageDataSpy = vi.fn().mockReturnValue({});

  class MockCanvasRenderingContext2D {
    getImageData(...args: unknown[]) {
      return getImageDataSpy(...args);
    }
  }

  Object.defineProperty(window, "CanvasRenderingContext2D", {
    configurable: true,
    value: MockCanvasRenderingContext2D
  });

  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL")
    .mockImplementation(toDataURLSpy);

  vi.spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockImplementation(() => {
      return new MockCanvasRenderingContext2D() as unknown as CanvasRenderingContext2D;
    });
});

class MockCanvasRenderingContext2D {
  getImageData(...args: unknown[]) {
    return getImageDataSpy(...args);
  }
}

Object.defineProperty(window, "CanvasRenderingContext2D", {
  configurable: true,
  value: MockCanvasRenderingContext2D
});

  it("detects toDataURL calls", async () => {
    await import("../detectors/canvas");

    const events: CustomEvent[] = [];

    window.addEventListener("webtrace:canvas", (event) => {
      events.push(event as CustomEvent);
    });

    const canvas = document.createElement("canvas");
    canvas.toDataURL();

    expect(events).toHaveLength(1);
    expect(events[0].detail).toMatchObject({
      kind: "canvas",
      api: "HTMLCanvasElement.toDataURL",
      action: "toDataURL"
    });
    expect(typeof events[0].detail.timestamp).toBe("number");
  });

  it("detects getImageData calls", async () => {
    await import("../detectors/canvas");

    const events: CustomEvent[] = [];

    window.addEventListener("webtrace:canvas", (event) => {
      events.push(event as CustomEvent);
    });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    expect(context).not.toBeNull();

    context!.getImageData(0, 0, 1, 1);

    expect(events).toHaveLength(1);
    expect(events[0].detail).toMatchObject({
      kind: "canvas",
      api: "CanvasRenderingContext2D.getImageData",
      action: "getImageData"
    });
    expect(typeof events[0].detail.timestamp).toBe("number");
  });

  it("calls the original toDataURL implementation", async () => {
    await import("../detectors/canvas");

    const canvas = document.createElement("canvas");
    canvas.toDataURL();

    expect(toDataURLSpy).toHaveBeenCalledTimes(1);
  });

  it("calls the original getImageData implementation", async () => {
    await import("../detectors/canvas");

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    expect(context).not.toBeNull();

    context!.getImageData(0, 0, 1, 1);

    expect(getImageDataSpy).toHaveBeenCalledTimes(1);
  });

  it("does not expose canvas data in the detection event", async () => {
    await import("../detectors/canvas");

    const events: CustomEvent[] = [];

    window.addEventListener("webtrace:canvas", (event) => {
      events.push(event as CustomEvent);
    });

    const canvas = document.createElement("canvas");
    canvas.toDataURL();

    expect(events).toHaveLength(1);
    expect(events[0].detail).not.toHaveProperty("data");
    expect(events[0].detail).not.toHaveProperty("imageData");
  });
});
