(() => {
  const eventName = "webtrace:canvas";

  function report(api: string, action: string): void {
    window.dispatchEvent(
      new CustomEvent(eventName, {
        detail: {
          kind: "canvas",
          api,
          action,
          timestamp: Date.now()
        }
      })
    );
  }

  const canvasPrototype = HTMLCanvasElement.prototype;
  const originalToDataURL = canvasPrototype.toDataURL;

  canvasPrototype.toDataURL = function (
    this: HTMLCanvasElement,
    ...args: Parameters<typeof originalToDataURL>
  ): string {
    report("HTMLCanvasElement.toDataURL", "toDataURL");
    return originalToDataURL.apply(this, args);
  };

  const contextPrototype = CanvasRenderingContext2D.prototype;
  const originalGetImageData = contextPrototype.getImageData;

  contextPrototype.getImageData = function (
    this: CanvasRenderingContext2D,
    ...args: Parameters<typeof originalGetImageData>
  ): ImageData {
    report("CanvasRenderingContext2D.getImageData", "getImageData");
    return originalGetImageData.apply(this, args);
  };
})();
