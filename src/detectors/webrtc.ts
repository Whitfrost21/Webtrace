(() => {
  const eventName = "webtrace:webrtc";

  function report(): void {
    window.dispatchEvent(
      new CustomEvent(eventName, {
        detail: {
          kind: "webrtc",
          api: "RTCPeerConnection",
          action: "constructor",
          timestamp: Date.now()
        }
      })
    );
  }

  const OriginalRTCPeerConnection = window.RTCPeerConnection;

  if (!OriginalRTCPeerConnection) return;

  const WrappedRTCPeerConnection =
    class extends OriginalRTCPeerConnection {
      constructor(
        ...args: ConstructorParameters<typeof OriginalRTCPeerConnection>
      ) {
        report();
        super(...args);
      }
    } as typeof RTCPeerConnection;

  Object.defineProperty(window, "RTCPeerConnection", {
    configurable: true,
    writable: true,
    value: WrappedRTCPeerConnection
  });
})();
