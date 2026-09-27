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

export interface AuditSession {
  sessionId: string;
  startedAt: number;
  events: StoredEvent[];
}

const STORAGE_KEY = "webtrace_session";
const MAX_EVENTS = 5000;

function createSession(): AuditSession {
  return {
    sessionId: crypto.randomUUID(),
    startedAt: Date.now(),
    events: []
  };
}

export async function getSession(): Promise<AuditSession> {
  const result = await chrome.storage.local.get(STORAGE_KEY);

  const stored = result[STORAGE_KEY] as AuditSession | undefined;

  return stored ?? createSession();
}

export async function addEvent(event: StoredEvent): Promise<boolean> {
  const session = await getSession();

  if (session.events.length >= MAX_EVENTS) {
    return false;
  }

  session.events.push(event);

  await chrome.storage.local.set({
    [STORAGE_KEY]: session
  });

  return true;
}

export async function getEvents(): Promise<StoredEvent[]> {
  const session = await getSession();

  return session.events;
}

export async function clearSession(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}

export async function startNewSession(): Promise<AuditSession> {
  const session = createSession();

  await chrome.storage.local.set({
    [STORAGE_KEY]: session
  });

  return session;
}
