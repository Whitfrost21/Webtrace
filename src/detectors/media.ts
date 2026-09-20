(() => {
  const eventName = "webtrace:media";

  function report(): void {
    window.dispatchEvent(
      new CustomEvent(eventName, {
        detail: {
          kind: "media",
          api: "navigator.mediaDevices.getUserMedia",
          action: "getUserMedia",
          timestamp: Date.now()
        }
      })
    );
  }

  if (!navigator.mediaDevices) {
    return;
  }

  const prototype = MediaDevices.prototype;
  const originalGetUserMedia = prototype.getUserMedia;

  prototype.getUserMedia = function (
    this: MediaDevices,
    constraints: MediaStreamConstraints
  ): Promise<MediaStream> {
    report();

    return originalGetUserMedia.call(this, constraints);
  };
})();
