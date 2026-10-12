interface NetworkAggregate {
  site: string;
  pageUrl: string;
  destination: string;
  party: "first-party" | "third-party" | "unknown";
  method: string;
  resourceType: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
}

interface DetectionAggregate {
  site: string;
  pageUrl: string;
  kind: string;
  api: string;
  action: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
}

interface SiteAudit {
  site: string;
  network: NetworkAggregate[];
  detections: DetectionAggregate[];
  evidence: unknown[];
  totalEvents: number;
  evidenceLimitReached: boolean;
  droppedNetworkGroups: number;
  droppedDetectionGroups: number;
}

interface AuditSession {
  sessionId: string;
  startedAt: number;
  updatedAt: number;
  sites: SiteAudit[];
  totalEvents: number;
  storageError: boolean;
}

interface ThirdParty {
  domain: string;
  count: number;
  blocked: boolean;
}

const STORAGE_KEY = "webtrace_sessions";
const BLOCKED_KEY = "webtrace_blocked_domains";
const RULE_IDS_KEY = "webtrace_block_rule_ids";

const $ = (id: string): HTMLElement => {
  const el = document.getElementById(id);

  if (!el) {
    throw new Error(`Missing element: ${id}`);
  }

  return el;
};

let sites: SiteAudit[] = [];
let blocked = new Set<string>();
let selectedSite: SiteAudit | null = null;

function domainFromUrl(value: string): string | null {
  try {
    const url = new URL(value);

    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }

    return url.hostname.toLowerCase().replace(/\.$/, "") || null;
  } catch {
    return null;
  }
}

function apiCount(site: SiteAudit): number {
  return (site.detections ?? []).reduce(
    (n, item) => n + (item.count || 0),
    0,
  );
}

function thirdParties(site: SiteAudit): ThirdParty[] {
  const counts = new Map<string, number>();

  for (const request of site.network ?? []) {
    if (request.party !== "third-party") {
      continue;
    }

    const domain = domainFromUrl(request.destination);

    if (domain) {
      counts.set(domain, (counts.get(domain) ?? 0) + (request.count || 0));
    }
  }

  return [...counts]
    .map(([domain, count]) => ({
      domain,
      count,
      blocked: blocked.has(domain),
    }))
    .sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain));
}

function showOverview(): void {
  selectedSite = null;
  $("siteDetailView").hidden = true;
  $("overviewView").hidden = false;
}

function showDetail(site: SiteAudit): void {
  selectedSite = site;
  $("overviewView").hidden = true;
  $("siteDetailView").hidden = false;
  $("detailSiteName").textContent = site.site;
  $("detailEventCount").textContent = String(site.totalEvents);
  $("detailApiCount").textContent = String(apiCount(site));

  renderThirdParties(site);
  renderDetections(site);
}

function renderThirdParties(site: SiteAudit): void {
  const root = $("thirdParties");
  root.replaceChildren();

  const list = thirdParties(site);

  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No third-party destinations recorded for this site.";
    root.append(empty);
    return;
  }

  for (const item of list) {
    const row = document.createElement("div");
    row.className = "domainrow";

    const info = document.createElement("div");
    info.className = "domaininfo";

    const name = document.createElement("div");
    name.className = "domain";
    name.textContent = item.domain;

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `${item.count} observed requests`;

    const tag = document.createElement("span");
    tag.className = item.blocked ? "tag blocked" : "tag";
    tag.textContent = item.blocked
      ? "Blocked by WebTrace"
      : "Service identity pending analyzer";

    info.append(name, meta, tag);

    const label = document.createElement("label");
    label.className = "toggle";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = item.blocked;
    checkbox.setAttribute("aria-label", `Block ${item.domain}`);
    checkbox.addEventListener("change", () => {
      void setBlocked(item.domain, checkbox.checked, checkbox);
    });

    const labelText = document.createElement("span");
    labelText.textContent = item.blocked ? "Blocked" : "Block";

    label.append(checkbox, labelText);
    row.append(info, label);
    root.append(row);
  }
}

function renderDetections(site: SiteAudit): void {
  const root = $("detailGroups");
  root.replaceChildren();

  if (!site.detections?.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No browser API detections recorded.";
    root.append(empty);
  } else {
    for (const item of site.detections) {
      const row = document.createElement("div");
      row.className = "group";

      const name = document.createElement("div");
      name.className = "domaininfo";

      const api = document.createElement("div");
      api.className = "domain";
      api.textContent = item.api || item.kind;

      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = `${item.kind} · ${item.action}`;

      const count = document.createElement("div");
      count.className = "count";
      count.textContent = `${item.count} events`;

      name.append(api, meta);
      row.append(name, count);
      root.append(row);
    }
  }

  $("detailNote").textContent = site.evidenceLimitReached
    ? "Evidence storage limit reached; some individual events were not retained."
    : `${site.evidence?.length ?? 0} individual evidence events retained.`;
}

function renderSites(query = ""): void {
  const root = $("sites");
  root.replaceChildren();

  const filtered = sites.filter((site) =>
    site.site.toLowerCase().includes(query.trim().toLowerCase()),
  );

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = sites.length
      ? "No sites match your search."
      : "No activity recorded yet. Browse a site to start your audit.";
    root.append(empty);
    return;
  }

  const max = Math.max(...filtered.map((site) => site.totalEvents), 1);

  for (const site of filtered) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "site";

    const top = document.createElement("div");
    top.className = "rowtop";

    const name = document.createElement("div");
    name.className = "sitename";
    name.textContent = site.site;

    const count = document.createElement("div");
    count.className = "count";
    count.textContent = `${site.totalEvents} events`;

    top.append(name, count);

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent =
      `${thirdParties(site).length} third-party domains · ` +
      `${apiCount(site)} API detections`;

    const bar = document.createElement("div");
    bar.className = "bar";

    const fill = document.createElement("div");
    fill.style.width = `${Math.max(3, (site.totalEvents / max) * 100)}%`;
    bar.append(fill);

    button.append(top, meta, bar);
    button.addEventListener("click", () => showDetail(site));
    root.append(button);
  }
}

function renderBlocked(): void {
  $("blockedCount").textContent = String(blocked.size);

  const root = $("blockedList");
  root.replaceChildren();

  if (!blocked.size) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No domains blocked.";
    root.append(empty);
    return;
  }

  for (const domain of [...blocked].sort()) {
    const row = document.createElement("div");
    row.className = "domainrow";

    const info = document.createElement("div");
    info.className = "domaininfo";

    const name = document.createElement("div");
    name.className = "domain";
    name.textContent = domain;

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = "Requests to this domain are blocked across sites.";

    info.append(name, meta);

    const button = document.createElement("button");
    button.className = "back";
    button.style.margin = "0";
    button.textContent = "Unblock";
    button.addEventListener("click", () => {
      void setBlocked(domain, false);
    });

    row.append(info, button);
    root.append(row);
  }
}

function nextRuleId(domain: string, ids: Record<string, number>): number {
  let hash = 2166136261;

  for (const char of domain) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  let id = 10000 + ((hash >>> 0) % 1000000000);
  const used = new Set(Object.values(ids));

  while (used.has(id)) {
    id = id >= 2000000000 ? 10000 : id + 1;
  }

  return id;
}

async function setBlocked(
  domain: string,
  shouldBlock: boolean,
  checkbox?: HTMLInputElement,
): Promise<void> {
  const status = $("status");

  if (checkbox) {
    checkbox.disabled = true;
  }

  try {
    const saved = await chrome.storage.local.get([BLOCKED_KEY, RULE_IDS_KEY]);
    const next = new Set<string>(
      Array.isArray(saved[BLOCKED_KEY])
        ? (saved[BLOCKED_KEY] as string[])
        : [],
    );
    const ids = {
      ...((saved[RULE_IDS_KEY] ?? {}) as Record<string, number>),
    };

    if (shouldBlock && !next.has(domain)) {
      const id = ids[domain] ?? nextRuleId(domain, ids);
      ids[domain] = id;

      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: [
          {
            id,
            priority: 1,
            action: { type: "block" },
            condition: { requestDomains: [domain] },
          },
        ],
        removeRuleIds: [],
      });

      next.add(domain);
    } else if (!shouldBlock && next.has(domain)) {
      const id = ids[domain];

      if (typeof id === "number") {
        await chrome.declarativeNetRequest.updateDynamicRules({
          addRules: [],
          removeRuleIds: [id],
        });
      }

      next.delete(domain);
      delete ids[domain];
    } else {
      return;
    }

    await chrome.storage.local.set({
      [BLOCKED_KEY]: [...next].sort(),
      [RULE_IDS_KEY]: ids,
    });

    blocked = next;
    renderBlocked();
    renderSites(($("siteSearch") as HTMLInputElement).value);

    if (selectedSite) {
      renderThirdParties(selectedSite);
    }

    status.textContent = shouldBlock
      ? `Blocking enabled for ${domain}.`
      : `Blocking removed for ${domain}.`;
  } catch (error) {
    if (checkbox) {
      checkbox.checked = !shouldBlock;
    }

    status.textContent =
      `Could not update blocking. Ensure declarativeNetRequest is enabled ` +
      `in manifest.json. ${
        error instanceof Error ? error.message : String(error)
      }`;
  } finally {
    if (checkbox) {
      checkbox.disabled = false;
    }
  }
}

async function refresh(): Promise<void> {
  const result = await chrome.storage.local.get([STORAGE_KEY, BLOCKED_KEY]);
  const sessions = (result[STORAGE_KEY] ?? []) as AuditSession[];
  const latest = sessions[0];

  blocked = new Set(
    Array.isArray(result[BLOCKED_KEY])
      ? (result[BLOCKED_KEY] as string[])
      : [],
  );

  $("eventCount").textContent = String(latest?.totalEvents ?? 0);
  $("siteCount").textContent = String(latest?.sites?.length ?? 0);
  $("detectionCount").textContent = String(
    (latest?.sites ?? []).reduce(
      (sum, site) => sum + apiCount(site),
      0,
    ),
  );

  sites = [...(latest?.sites ?? [])].sort(
    (a, b) => b.totalEvents - a.totalEvents,
  );

  renderSites(($("siteSearch") as HTMLInputElement).value);
  renderBlocked();
}

async function exportJson(): Promise<void> {
  const button = $("exportButton") as HTMLButtonElement;
  button.disabled = true;
  $("status").textContent = "Preparing export…";

  try {
    const response = await chrome.runtime.sendMessage({
      type: "EXPORT_SESSIONS_JSON",
    });

    if (!response?.ok) {
      throw new Error(response?.error ?? "Export failed");
    }

    const blob = new Blob([JSON.stringify(response.data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `webtrace-${Date.now()}.json`;
    anchor.click();

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    $("status").textContent = "JSON export downloaded.";
  } catch (error) {
    $("status").textContent =
      error instanceof Error ? error.message : "Export failed.";
  } finally {
    button.disabled = false;
  }
}

$("siteSearch").addEventListener("input", () => {
  renderSites(($("siteSearch") as HTMLInputElement).value);
});

$("backButton").addEventListener("click", showOverview);
$("exportButton").addEventListener("click", () => {
  void exportJson();
});

$("clear-data").addEventListener("click", async () => {
  const button = $("clear-data") as HTMLButtonElement;

  if (
    !confirm(
      "Delete all WebTrace activity? Blocking preferences will be kept.",
    )
  ) {
    return;
  }

  button.disabled = true;

  try {
    const response = await chrome.runtime.sendMessage({
      type: "CLEAR_WEBTRACE_DATA",
    });

    if (!response?.success) {
      throw new Error("Could not clear WebTrace data.");
    }

    showOverview();
    await refresh();
    $("status").textContent =
      "Activity cleared. Blocking preferences were kept.";
  } catch (error) {
    $("status").textContent =
      error instanceof Error ? error.message : "Failed to clear data.";
  } finally {
    button.disabled = false;
  }
});

void refresh().catch((error) => {
  $("status").textContent = `Could not load data: ${String(error)}`;
});
