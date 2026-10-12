import type { DetectionEvent } from "../types/detection.js";

export interface NetworkEvent {
  type: "network";
  requestId: string;
  pageUrl: string;
  destination: string;
  party: "first-party" | "third-party" | "unknown";
  method: string;
  tabId: number;
  resourceType: string;
  timestamp: number;
}

export type StoredEvent = NetworkEvent | DetectionEvent;

export interface NetworkAggregate {
  site: string;
  pageUrl: string;
  destination: string;
  party: NetworkEvent["party"];
  method: string;
  resourceType: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
}

export interface DetectionAggregate {
  site: string;
  pageUrl: string;
  kind: DetectionEvent["kind"];
  api: string;
  action: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
}

export interface SiteAudit {
  site: string;
  network: NetworkAggregate[];
  detections: DetectionAggregate[];
  evidence: StoredEvent[];
  totalEvents: number;
  evidenceLimitReached: boolean;
  droppedNetworkGroups: number;
  droppedDetectionGroups: number;
}

export interface AuditSession {
  sessionId: string;
  startedAt: number;
  updatedAt: number;
  sites: SiteAudit[];
  totalEvents: number;
  storageError: boolean;
}

export interface WebTraceExport {
  schemaVersion: 1;
  product: "WebTrace";
  exportedAt: number;
  sessions: AuditSession[];
}

const STORAGE_KEY = "webtrace_sessions";
const MAX_SESSIONS = 10;
const MAX_SITES_PER_SESSION = 100;
const MAX_EVIDENCE_PER_SITE = 20;
const MAX_NETWORK_GROUPS_PER_SITE = 200;
const MAX_DETECTION_GROUPS_PER_SITE = 50;
const BATCH_SIZE = 25;
const FLUSH_INTERVAL_MS = 2000;

let sessions: AuditSession[] | null = null;
let initialization: Promise<void> | null = null;
let pendingEvents = 0;
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let writeChain: Promise<void> = Promise.resolve();

export function normalizeSite(pageUrl: string): string {
  try {
    const url = new URL(pageUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "unknown";
    return url.hostname.toLowerCase().replace(/\.$/, "") || "unknown";
  } catch {
    return "unknown";
  }
}

function createSession(): AuditSession {
  const now = Date.now();
  return {
    sessionId: crypto.randomUUID(),
    startedAt: now,
    updatedAt: now,
    sites: [],
    totalEvents: 0,
    storageError: false
  };
}

function createSite(site: string): SiteAudit {
  return {
    site,
    network: [],
    detections: [],
    evidence: [],
    totalEvents: 0,
    evidenceLimitReached: false,
    droppedNetworkGroups: 0,
    droppedDetectionGroups: 0
  };
}

function migrateSession(raw: any): AuditSession {
  // Migrate the previous flat session schema without discarding its aggregates.
  if (Array.isArray(raw.sites)) {
    const session = raw as AuditSession;
    session.storageError ??= false;
    for (const site of session.sites) {
      site.evidence ??= [];
      site.totalEvents ??= 0;
      site.evidenceLimitReached ??= false;
      site.droppedNetworkGroups ??= 0;
      site.droppedDetectionGroups ??= 0;
    }
    return session;
  }

  const migrated: AuditSession = {
    sessionId: typeof raw.sessionId === "string" ? raw.sessionId : crypto.randomUUID(),
    startedAt: typeof raw.startedAt === "number" ? raw.startedAt : Date.now(),
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
    sites: [],
    totalEvents: typeof raw.totalEvents === "number" ? raw.totalEvents : 0,
    storageError: raw.storageError ?? false
  };

  const getOrCreate = (siteName: string): SiteAudit => {
    let site = migrated.sites.find(item => item.site === siteName);
    if (!site) {
      site = createSite(siteName);
      migrated.sites.push(site);
    }
    return site;
  };

  for (const item of raw.network ?? []) {
    const siteName = normalizeSite(item.pageUrl ?? "");
    getOrCreate(siteName).network.push({ ...item, site: siteName });
  }
  for (const item of raw.detections ?? []) {
    const siteName = normalizeSite(item.pageUrl ?? "");
    getOrCreate(siteName).detections.push({ ...item, site: siteName });
  }
  for (const event of raw.evidence ?? []) {
    const siteName = normalizeSite(event.pageUrl ?? "");
    const site = getOrCreate(siteName);
    if (site.evidence.length < MAX_EVIDENCE_PER_SITE) site.evidence.push(event);
    else site.evidenceLimitReached = true;
  }
  for (const site of migrated.sites) {
    site.totalEvents =
      site.network.reduce((sum, item) => sum + item.count, 0) +
      site.detections.reduce((sum, item) => sum + item.count, 0);
    site.evidenceLimitReached ||= Boolean(raw.evidenceLimitReached);
    site.droppedNetworkGroups = raw.droppedNetworkGroups ?? 0;
    site.droppedDetectionGroups = raw.droppedDetectionGroups ?? 0;
  }
  return migrated;
}

async function ensureInitialized(): Promise<void> {
  if (sessions !== null) return;
  if (initialization) return initialization;

  initialization = (async () => {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const saved = (result[STORAGE_KEY] as unknown[] | undefined) ?? [];
    sessions = saved.slice(0, MAX_SESSIONS).map(migrateSession);
  })();

  try {
    await initialization;
  } finally {
    initialization = null;
  }
}

export async function getSessions(): Promise<AuditSession[]> {
  await ensureInitialized();
  return sessions!;
}

export async function getSession(): Promise<AuditSession> {
  await ensureInitialized();
  if (sessions!.length === 0) {
    sessions!.push(createSession());
    await flushSession();
  }
  return sessions![0];
}

export async function startNewSession(): Promise<AuditSession> {
  await ensureInitialized();
  sessions!.unshift(createSession());
  sessions!.splice(MAX_SESSIONS);
  await flushSession();
  return sessions![0];
}

export async function addEvent(event: StoredEvent): Promise<boolean> {
  await ensureInitialized();
  if (sessions!.length === 0) sessions!.push(createSession());

  const session = sessions![0];
  const pageUrl = event.pageUrl;
  const siteName = normalizeSite(pageUrl);

  let site = session.sites.find(item => item.site === siteName);
  if (!site) {
    if (session.sites.length >= MAX_SITES_PER_SESSION) return false;
    site = createSite(siteName);
    session.sites.push(site);
  }

  session.totalEvents++;
  site.totalEvents++;
  session.updatedAt = Math.max(session.updatedAt, event.timestamp);

  if (event.type === "network") {
    const existing = site.network.find(item =>
      item.destination === event.destination &&
      item.party === event.party &&
      item.method === event.method &&
      item.resourceType === event.resourceType
    );
    if (existing) {
      existing.count++;
      existing.lastSeen = Math.max(existing.lastSeen, event.timestamp);
      existing.pageUrl = pageUrl;
    } else if (site.network.length < MAX_NETWORK_GROUPS_PER_SITE) {
      site.network.push({
        site: siteName,
        pageUrl,
        destination: event.destination,
        party: event.party,
        method: event.method,
        resourceType: event.resourceType,
        count: 1,
        firstSeen: event.timestamp,
        lastSeen: event.timestamp
      });
    } else {
      site.droppedNetworkGroups++;
    }
  } else {
    const existing = site.detections.find(item =>
      item.kind === event.kind &&
      item.api === event.api &&
      item.action === event.action
    );
    if (existing) {
      existing.count++;
      existing.lastSeen = Math.max(existing.lastSeen, event.timestamp);
      existing.pageUrl = pageUrl;
    } else if (site.detections.length < MAX_DETECTION_GROUPS_PER_SITE) {
      site.detections.push({
        site: siteName,
        pageUrl,
        kind: event.kind,
        api: event.api,
        action: event.action,
        count: 1,
        firstSeen: event.timestamp,
        lastSeen: event.timestamp
      });
    } else {
      site.droppedDetectionGroups++;
    }
  }

  if (site.evidence.length < MAX_EVIDENCE_PER_SITE) {
    site.evidence.push(event);
  } else {
    site.evidenceLimitReached = true;
  }

  pendingEvents++;
  if (pendingEvents >= BATCH_SIZE) await flushSession();
  else scheduleFlush();
  return true;
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = undefined;
    void flushSession();
  }, FLUSH_INTERVAL_MS);
}

export async function flushSession(): Promise<void> {
  await ensureInitialized();
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = undefined;
  }
  if (!sessions) return;

  pendingEvents = 0;
  const snapshot = structuredClone(sessions);

  writeChain = writeChain.then(async () => {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: snapshot });
      for (const session of sessions ?? []) session.storageError = false;
    } catch (error) {
      for (const session of sessions ?? []) session.storageError = true;
      console.error("[WebTrace] Failed to persist sessions", error);
    }
  });
  await writeChain;
}

export async function exportSessionsJson(): Promise<WebTraceExport> {
  await flushSession();
  const savedSessions = await getSessions();
  return {
    schemaVersion: 1,
    product: "WebTrace",
    exportedAt: Date.now(),
    sessions: structuredClone(savedSessions)
  };
}

export async function getEvents(): Promise<StoredEvent[]> {
  const session = await getSession();
  return session.sites.flatMap(site => site.evidence);
}

export async function clearSession(): Promise<void> {
  await ensureInitialized();
  sessions = [];
  pendingEvents = 0;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = undefined;
  }
  writeChain = writeChain.then(async () => {
    await chrome.storage.local.remove(STORAGE_KEY);
  });
  await writeChain;
}

export async function clearAllSessions(): Promise<void> {
  await clearSession();
}
