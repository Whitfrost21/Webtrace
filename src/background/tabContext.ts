const tabUrls = new Map<number, string>();

export function setTabUrl(tabId: number, url: string): void {
  tabUrls.set(tabId, url);
}

export function getTabUrl(tabId: number): string | undefined {
  return tabUrls.get(tabId);
}

export function removeTab(tabId: number): void {
  tabUrls.delete(tabId);
}
