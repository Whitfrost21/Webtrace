(() => {
  const eventName = "webtrace:storage";

  function getStorageArea(storage: Storage): string {
    try {
      if (storage === window.localStorage) return "localStorage";
      if (storage === window.sessionStorage) return "sessionStorage";
    } catch {
      // Storage may be unavailable.
    }

    return "unknown";
  }

  function report(storage: Storage, action: string): void {
    window.dispatchEvent(
      new CustomEvent(eventName, {
        detail: {
          kind: "storage",
          api: getStorageArea(storage),
          action,
          timestamp: Date.now()
        }
      })
    );
  }

  const prototype = Storage.prototype;

  const originalGetItem = prototype.getItem;
  prototype.getItem = function (this: Storage, key: string): string | null {
    report(this, "getItem");
    return originalGetItem.call(this, key);
  };

  const originalSetItem = prototype.setItem;
  prototype.setItem = function (
    this: Storage,
    key: string,
    value: string
  ): void {
    report(this, "setItem");
    return originalSetItem.call(this, key, value);
  };

  const originalRemoveItem = prototype.removeItem;
  prototype.removeItem = function (this: Storage, key: string): void {
    report(this, "removeItem");
    return originalRemoveItem.call(this, key);
  };

  const originalClear = prototype.clear;
  prototype.clear = function (this: Storage): void {
    report(this, "clear");
    return originalClear.call(this);
  };
})();
