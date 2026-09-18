(() => {
  const eventName = "webtrace:geolocation";

  function report(action: string): void {
    window.dispatchEvent(
      new CustomEvent(eventName, {
        detail: {
          kind: "geolocation",
          api: "navigator.geolocation",
          action,
          timestamp: Date.now()
        }
      })
    );
  }

  const prototype = Geolocation.prototype;

  const originalGetCurrentPosition = prototype.getCurrentPosition;
  prototype.getCurrentPosition = function (
    this: Geolocation,
    success: PositionCallback,
    error?: PositionErrorCallback | null,
    options?: PositionOptions
  ): void {
    report("getCurrentPosition");
    return originalGetCurrentPosition.call(this, success, error, options);
  };

  const originalWatchPosition = prototype.watchPosition;
  prototype.watchPosition = function (
    this: Geolocation,
    success: PositionCallback,
    error?: PositionErrorCallback | null,
    options?: PositionOptions
  ): number {
    report("watchPosition");
    return originalWatchPosition.call(this, success, error, options);
  };
})();
