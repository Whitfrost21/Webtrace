declare namespace chrome.webRequest {
  interface ObserveEvent<TDetails> {
    addListener(
      callback: (details: TDetails) => void,
      filter: RequestFilter,
      extraInfoSpec?: string[]
    ): void;
  }
}
