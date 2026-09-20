// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach } from "vitest";

describe("media detector", () => {
  let getUserMediaSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();

    getUserMediaSpy = vi.fn().mockResolvedValue({});

    class MockMediaDevices {
      getUserMedia(
        constraints: MediaStreamConstraints
      ): Promise<MediaStream> {
        return getUserMediaSpy(constraints);
      }
    }

    Object.defineProperty(window, "MediaDevices", {
      configurable: true,
      value: MockMediaDevices
    });

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: new MockMediaDevices()
    });
  });

  it("detects getUserMedia calls", async () => {
    await import("../detectors/media");

    const events: CustomEvent[] = [];

    window.addEventListener("webtrace:media", (event) => {
      events.push(event as CustomEvent);
    });

    await navigator.mediaDevices.getUserMedia({
      audio: true
    });

    expect(events).toHaveLength(1);

    expect(events[0].detail).toMatchObject({
      kind: "media",
      api: "navigator.mediaDevices.getUserMedia",
      action: "getUserMedia"
    });

    expect(typeof events[0].detail.timestamp).toBe("number");
  });

  it("calls the original getUserMedia implementation", async () => {
    await import("../detectors/media");

    const constraints = {
      video: true,
      audio: true
    };

    await navigator.mediaDevices.getUserMedia(constraints);

    expect(getUserMediaSpy).toHaveBeenCalledTimes(1);
    expect(getUserMediaSpy).toHaveBeenCalledWith(constraints);
  });

  it("detects both audio and video requests", async () => {
    await import("../detectors/media");

    const events: CustomEvent[] = [];

    window.addEventListener("webtrace:media", (event) => {
      events.push(event as CustomEvent);
    });

    await navigator.mediaDevices.getUserMedia({
      audio: true
    });

    await navigator.mediaDevices.getUserMedia({
      video: true
    });

    expect(events).toHaveLength(2);
  });

  it("does not expose media constraints in the detection event", async () => {
    await import("../detectors/media");

    const events: CustomEvent[] = [];

    window.addEventListener("webtrace:media", (event) => {
      events.push(event as CustomEvent);
    });

    await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true
    });

    expect(events).toHaveLength(1);
    expect(events[0].detail).not.toHaveProperty("constraints");
    expect(events[0].detail).not.toHaveProperty("audio");
    expect(events[0].detail).not.toHaveProperty("video");
  });
});
