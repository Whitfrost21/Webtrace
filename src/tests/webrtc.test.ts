// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

describe("WebRTC detector", () => {
  let peerConnectionSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();

    peerConnectionSpy = vi.fn();

    class MockRTCPeerConnection {
      constructor(...args: unknown[]) {
        peerConnectionSpy(...args);
      }
    }

    Object.defineProperty(window, "RTCPeerConnection", {
      configurable: true,
      value: MockRTCPeerConnection
    });

    Object.defineProperty(globalThis, "RTCPeerConnection", {
      configurable: true,
      value: MockRTCPeerConnection
    });
  });

  it("detects RTCPeerConnection creation", async () => {
    await import("../detectors/webrtc");

    const events: CustomEvent[] = [];

    window.addEventListener("webtrace:webrtc", (event) => {
      events.push(event as CustomEvent);
    });

    new RTCPeerConnection();

    expect(events).toHaveLength(1);
    expect(events[0].detail).toMatchObject({
      kind: "webrtc",
      api: "RTCPeerConnection",
      action: "constructor"
    });
    expect(typeof events[0].detail.timestamp).toBe("number");
  });

  it("calls the original RTCPeerConnection constructor", async () => {
    await import("../detectors/webrtc");

    new RTCPeerConnection();

    expect(peerConnectionSpy).toHaveBeenCalledTimes(1);
  });

  it("preserves constructor arguments", async () => {
    await import("../detectors/webrtc");

    const config = {
      iceServers: [{ urls: "stun:example.com" }]
    };

    new RTCPeerConnection(config);

    expect(peerConnectionSpy).toHaveBeenCalledWith(config);
  });

  it("does not expose WebRTC connection data", async () => {
    await import("../detectors/webrtc");

    const events: CustomEvent[] = [];

    window.addEventListener("webtrace:webrtc", (event) => {
      events.push(event as CustomEvent);
    });

    new RTCPeerConnection();

    expect(events).toHaveLength(1);
    expect(events[0].detail).not.toHaveProperty("sdp");
    expect(events[0].detail).not.toHaveProperty("candidate");
    expect(events[0].detail).not.toHaveProperty("iceCandidate");
    expect(events[0].detail).not.toHaveProperty("config");
  });
});
