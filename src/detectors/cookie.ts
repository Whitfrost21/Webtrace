(() => {
  const eventName = "webtrace:cookie";

  function report(action: string): void {
    window.dispatchEvent(
      new CustomEvent(eventName, {
        detail: {
          kind: "cookie",
          api: "document.cookie",
          action,
          timestamp: Date.now()
        }
      })
    );
  }

  const descriptor = Object.getOwnPropertyDescriptor(
    Document.prototype,
    "cookie"
  );

  if (!descriptor) {
    return;
  }

  const originalGet = descriptor.get;
  const originalSet = descriptor.set;

  Object.defineProperty(Document.prototype, "cookie", {
    configurable: descriptor.configurable,
    enumerable: descriptor.enumerable,

    get(this: Document): string {
      report("get");

      if (!originalGet) {
        return "";
      }

      return originalGet.call(this);
    },

    set(this: Document, value: string): void {
      report("set");

      if (originalSet) {
        originalSet.call(this, value);
      }
    }
  });
})();
