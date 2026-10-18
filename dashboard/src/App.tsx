import { Fragment, useEffect, useMemo, useState } from "react";
import {
  ShieldCheck,
  FileUp,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Search,
  ExternalLink,
} from "lucide-react";
import "./App.css";

const ANALYZER_URL = "http://127.0.0.1:8080/analyze";

type RequestEvidence = {
  requestId?: string;
  pageUrl?: string;
  destination?: string;
  method?: string;
  resourceType?: string;
  party?: string;
  timestamp?: number;
  tabId?: number;
  details?: Record<string, unknown>;
};

type DomainReport = {
  domain: string;
  requestCount: number;
  matchStatus: string;
  serviceName?: string;
  owner?: string;
  categories?: string[];
  evidence?: RequestEvidence[];
};

type APIDetection = {
  kind: string;
  api: string;
  action: string;
  count: number;
  firstSeen?: number;
  lastSeen?: number;
};

type SiteReport = {
  site: string;
  totalThirdPartyRequests: number;
  identifiedDomains: number;
  unknownDomains: number;
  disputedDomains: number;
  evidenceLimitReached?: boolean;
  droppedNetworkGroups?: number;
  droppedDetectionGroups?: number;
  thirdParties: DomainReport[];
  unclassifiedDomains: Array<{
    domain: string;
    requestCount: number;
  }>;
  apiDetections: APIDetection[];
};

type Report = {
  schemaVersion: number;
  analyzerVersion: string;
  registryVersion: string;
  analyzedAt: number;
  sourceExportedAt: number;
  sessions: Array<{
    sessionId: string;
    startedAt?: number;
    updatedAt?: number;
    sites: SiteReport[];
  }>;
};

type StoredReport = {
  id: string;
  savedAt: number;
  report: Report;
};

type DomainRow = {
  key: string;
  site: SiteReport;
  domain: DomainReport;
};

function isAnalysisReport(value: unknown): value is Report {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Report> & { product?: unknown };
  return (
    candidate.product !== "WebTrace" &&
    typeof candidate.schemaVersion === "number" &&
    typeof candidate.analyzerVersion === "string" &&
    typeof candidate.registryVersion === "string" &&
    Array.isArray(candidate.sessions) &&
    candidate.sessions.every(
      (session) =>
        !!session &&
        typeof session.sessionId === "string" &&
        Array.isArray(session.sites) &&
        session.sites.every(
          (site) =>
            !!site &&
            typeof site.site === "string" &&
            Array.isArray(site.thirdParties) &&
            Array.isArray(site.unclassifiedDomains) &&
            Array.isArray(site.apiDetections),
        ),
    )
  );
}

function formatTimestamp(timestamp?: number) {
  if (timestamp === undefined || !Number.isFinite(timestamp)) return "Not recorded";
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleString();
}

function App() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [siteFilter, setSiteFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [apiKindFilter, setApiKindFilter] = useState("all");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [history, setHistory] = useState<StoredReport[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  async function refreshHistory() {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const response = await fetch("http://127.0.0.1:8080/reports");
      if (!response.ok) throw new Error(`History request failed (${response.status}).`);
      const value: unknown = await response.json();
      if (!Array.isArray(value)) throw new Error("The analyzer returned invalid history data.");
      const entries = value.filter((item): item is StoredReport =>
        !!item && typeof item === "object" &&
        typeof item.id === "string" && typeof item.savedAt === "number" &&
        isAnalysisReport(item.report),
      );
      setHistory(entries);
    } catch (err) {
      setHistoryError(err instanceof Error
        ? `${err.message} Start the Go analyzer to load saved reports.`
        : "Unable to load report history.");
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    void refreshHistory();
  }, []);

  async function analyzeFile(file?: File) {
    if (!file) return;

    setLoading(true);
    setError("");
    setReport(null);
    setSelectedHistoryId(null);
    setExpandedKey(null);

    try {
      const rawText = await file.text();
      const parsed: unknown = JSON.parse(rawText);

      // Analyzer reports already contain sessions with analyzed site data.
      // Load them directly; only raw extension exports should call /analyze.
      if (isAnalysisReport(parsed)) {
        setReport(parsed);
        return;
      }

      const response = await fetch(ANALYZER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: rawText,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const result: unknown = await response.json();
      if (!isAnalysisReport(result)) {
        throw new Error("The analyzer returned an unexpected report format.");
      }
      setReport(result);
      await refreshHistory();
    } catch (err) {
      setError(
        err instanceof SyntaxError
          ? "This file is not valid JSON."
          : err instanceof Error
            ? err.message
            : "Unable to load this WebTrace file.",
      );
    } finally {
      setLoading(false);
    }
  }

  const sites = report?.sessions.flatMap((session) => session.sites) ?? [];
  const allDomains: DomainRow[] = sites.flatMap((site, siteIndex) =>
    site.thirdParties.map((domain, domainIndex) => ({
      key: `${siteIndex}:${domainIndex}:${site.site}:${domain.domain}`,
      site,
      domain,
    })),
  );
  const uniqueDomains = new Set(allDomains.map(({ domain }) => domain.domain));
  const apiDetectionCount = sites.reduce(
    (total, site) =>
      total + site.apiDetections.reduce((sum, item) => sum + item.count, 0),
    0,
  );
  const siteOptions = [...new Set(sites.map((site) => site.site))].sort();
  const apiKinds = [
    ...new Set(sites.flatMap((site) => site.apiDetections.map((item) => item.kind))),
  ].sort();

  const normalizedSearch = search.trim().toLowerCase();
  const filteredDomains = useMemo(
    () =>
      allDomains.filter(({ site, domain }) => {
        const matchesSearch =
          !normalizedSearch ||
          [site.site, domain.domain, domain.serviceName, domain.owner]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(normalizedSearch));
        const matchesSite = siteFilter === "all" || site.site === siteFilter;
        const matchesStatus =
          statusFilter === "all" || domain.matchStatus === statusFilter;
        return matchesSearch && matchesSite && matchesStatus;
      }),
    [allDomains, normalizedSearch, siteFilter, statusFilter],
  );

  const filteredUnknownDomains = sites.flatMap((site) =>
    siteFilter !== "all" && site.site !== siteFilter
      ? []
      : site.unclassifiedDomains
          .filter(({ domain }) => !normalizedSearch || `${site.site} ${domain}`.toLowerCase().includes(normalizedSearch))
          .map((domain, index) => ({ ...domain, site: site.site, key: `${site.site}:${domain.domain}:${index}` })),
  );

  const filteredApiActivity = sites
    .filter((site) => siteFilter === "all" || site.site === siteFilter)
    .map((site) => ({
      ...site,
      apiDetections: site.apiDetections.filter((detection) => {
        const matchesKind = apiKindFilter === "all" || detection.kind === apiKindFilter;
        const matchesSearch =
          !normalizedSearch ||
          `${site.site} ${detection.api} ${detection.kind} ${detection.action}`
            .toLowerCase()
            .includes(normalizedSearch);
        return matchesKind && matchesSearch;
      }),
    }))
    .filter((site) => site.apiDetections.length > 0 || (!normalizedSearch && site.apiDetections.length === 0));

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <ShieldCheck size={28} aria-hidden="true" />
          <div>
            <h1>WebTrace</h1>
            <p>Privacy transparency report</p>
          </div>
        </div>
        <label className="upload-button">
          <FileUp size={18} aria-hidden="true" />
          {loading ? "Analyzing…" : report ? "Import another export" : "Import export"}
          <input
            type="file"
            accept=".json,application/json"
            disabled={loading}
            onChange={(event) => {
              void analyzeFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
      </header>

      <section className="intro">
        <p className="eyebrow">BROWSING TRANSPARENCY</p>
        <h2>Understand what your browser observes.</h2>
        <p>
          Review third-party connections, service identification, and detected
          browser API activity from your WebTrace export.
        </p>
      </section>

      <section className="panel history-panel" aria-label="Report history">
        <div className="section-heading">
          <div>
            <p className="eyebrow">SAVED ANALYSIS</p>
            <h2>Report history</h2>
          </div>
          <button type="button" className="secondary-button" onClick={() => void refreshHistory()} disabled={historyLoading}>
            {historyLoading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        {historyError && <p className="muted history-message">{historyError}</p>}
        {!historyError && history.length === 0 && (
          <p className="muted history-message">No saved reports yet. Send an export from the extension or import a raw JSON export.</p>
        )}
        {history.length > 0 && (
          <div className="history-list">
            {history.map((entry) => {
              const entrySites = entry.report.sessions.reduce((count, session) => count + session.sites.length, 0);
              return (
                <button
                  type="button"
                  key={entry.id}
                  className={`history-entry${selectedHistoryId === entry.id ? " selected" : ""}`}
                  onClick={() => {
                    setReport(entry.report);
                    setSelectedHistoryId(entry.id);
                    setExpandedKey(null);
                    setError("");
                  }}
                >
                  <span className="history-entry-title">Report · {formatTimestamp(entry.savedAt)}</span>
                  <span className="history-entry-meta">{entry.report.sessions.length} sessions · {entrySites} sites · Analyzer {entry.report.analyzerVersion}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {error && (
        <div className="error" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {!report && (
        <section className="empty-state">
          <FileUp size={32} aria-hidden="true" />
          <h3>Import a WebTrace export</h3>
          <p>
            Select the JSON file exported by your browser extension to generate
            its transparency report.
          </p>
        </section>
      )}

      {report && (
        <>
          <section className="summary-grid" aria-label="Report summary">
            <SummaryCard label="Sessions" value={report.sessions.length} />
            <SummaryCard label="Sites" value={sites.length} />
            <SummaryCard label="Third-party domains" value={uniqueDomains.size} />
            <SummaryCard label="API observations" value={apiDetectionCount} />
          </section>

          <section className="panel session-history-panel" aria-label="Sessions in report">
            <div className="section-heading">
              <div>
                <p className="eyebrow">BROWSING TIMELINE</p>
                <h2>Sessions in this report</h2>
              </div>
              <span>{report.sessions.length} sessions</span>
            </div>
            {report.sessions.length === 0 ? (
              <p className="muted">This report contains no sessions.</p>
            ) : (
              <div className="session-history-list">
                {report.sessions.map((session) => {
                  const sessionSites = session.sites.length;
                  const requestCount = session.sites.reduce((sum, site) => sum + site.totalThirdPartyRequests, 0);
                  const detectionCount = session.sites.reduce((sum, site) => sum + site.apiDetections.reduce((n, detection) => n + detection.count, 0), 0);
                  const isExpanded = expandedSessionId === session.sessionId;
                  return (
                    <article className={`session-history-entry${isExpanded ? " expanded" : ""}`} key={session.sessionId}>
                      <button
                        type="button"
                        className="session-history-toggle"
                        aria-expanded={isExpanded}
                        onClick={() => setExpandedSessionId(isExpanded ? null : session.sessionId)}
                      >
                        <span className="session-history-toggle-icon" aria-hidden="true">
                          {isExpanded ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                        </span>
                        <span className="session-history-toggle-content">
                          <span className="session-history-top">
                            <strong>{session.sessionId}</strong>
                            <span>{formatTimestamp(session.startedAt)}</span>
                          </span>
                          <span className="session-history-metrics">{sessionSites} sites · {requestCount.toLocaleString()} third-party requests · {detectionCount.toLocaleString()} API observations</span>
                          <small>Last updated: {formatTimestamp(session.updatedAt)}</small>
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="session-detail-list">
                          {session.sites.length === 0 ? (
                            <p className="muted">No site activity was recorded for this session.</p>
                          ) : session.sites.map((site, siteIndex) => {
                            const siteRequestCount = site.thirdParties.reduce((sum, domain) => sum + domain.requestCount, 0);
                            const siteApiCount = site.apiDetections.reduce((sum, detection) => sum + detection.count, 0);
                            return (
                              <section className="session-site-detail" key={`${site.site}:${siteIndex}`}>
                                <div className="session-site-heading">
                                  <h3>{site.site}</h3>
                                  <span>{siteRequestCount.toLocaleString()} third-party requests · {siteApiCount.toLocaleString()} API observations</span>
                                </div>

                                <div className="session-detail-columns">
                                  <div className="session-detail-group">
                                    <h4>Third-party connections ({site.thirdParties.length})</h4>
                                    {site.thirdParties.length === 0 ? <p className="muted">No identified third-party connections.</p> : (
                                      <ul className="session-domain-list">
                                        {site.thirdParties.map((domain, domainIndex) => (
                                          <li key={`${domain.domain}:${domainIndex}`}>
                                            <div className="session-domain-line">
                                              <strong>{domain.domain}</strong>
                                              <span>{domain.requestCount.toLocaleString()} requests</span>
                                            </div>
                                            <small>{domain.serviceName ?? "Unknown service"} · {domain.matchStatus}</small>
                                            {domain.evidence?.length ? (
                                              <details className="session-evidence-details">
                                                <summary>{domain.evidence.length} evidence event(s)</summary>
                                                <ul>
                                                  {domain.evidence.map((item, evidenceIndex) => (
                                                    <li key={`${item.requestId ?? "request"}:${item.timestamp ?? evidenceIndex}:${evidenceIndex}`}>
                                                      <span>{item.method || "Request"} · {item.resourceType || "Unknown resource"} · {formatTimestamp(item.timestamp)}</span>
                                                      <code>{item.destination || domain.domain}</code>
                                                    </li>
                                                  ))}
                                                </ul>
                                              </details>
                                            ) : <small>No individual request evidence recorded.</small>}
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>

                                  <div className="session-detail-group">
                                    <h4>Unclassified domains ({site.unclassifiedDomains.length})</h4>
                                    {site.unclassifiedDomains.length === 0 ? <p className="muted">No unclassified domains.</p> : (
                                      <ul className="session-domain-list">
                                        {site.unclassifiedDomains.map((domain, domainIndex) => (
                                          <li key={`${domain.domain}:${domainIndex}`}>
                                            <div className="session-domain-line"><strong>{domain.domain}</strong><span>{domain.requestCount.toLocaleString()} requests</span></div>
                                          </li>
                                        ))}
                                      </ul>
                                    )}

                                    <h4 className="session-api-heading">Detected API activity ({site.apiDetections.length})</h4>
                                    {site.apiDetections.length === 0 ? <p className="muted">No API observations recorded.</p> : (
                                      <ul className="session-api-list">
                                        {site.apiDetections.map((detection, detectionIndex) => (
                                          <li key={`${detection.api}:${detection.action}:${detectionIndex}`}>
                                            <strong>{detection.api}</strong>
                                            <span>{detection.kind} · {detection.action} · {detection.count.toLocaleString()} observations</span>
                                            <small>{formatTimestamp(detection.firstSeen)} – {formatTimestamp(detection.lastSeen)}</small>
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                </div>
                                {(site.evidenceLimitReached || (site.droppedNetworkGroups ?? 0) > 0 || (site.droppedDetectionGroups ?? 0) > 0) && (
                                  <p className="session-limit-warning">Some evidence may be incomplete for this site: {site.evidenceLimitReached ? "evidence limit reached" : ""}{(site.droppedNetworkGroups ?? 0) > 0 ? ` · ${site.droppedNetworkGroups} network groups dropped` : ""}{(site.droppedDetectionGroups ?? 0) > 0 ? ` · ${site.droppedDetectionGroups} API groups dropped` : ""}</p>
                                )}
                              </section>
                            );
                          })}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="transparency-note" aria-label="How to read this report">
            <strong>How to read this report</strong>
            <p>
              These entries describe activity observed by the extension. A
              detected connection or API call is not, by itself, proof of
              harmful behavior. “Unknown” means the analyzer could not identify
              a service from its current registry.
            </p>
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">NETWORK ACTIVITY</p>
                <h2>Third-party connections</h2>
              </div>
              <span>{filteredDomains.length} of {allDomains.length} entries</span>
            </div>

            <div className="report-filters network-filters">
              <label className="search-field">
                <Search size={17} aria-hidden="true" />
                <span className="sr-only">Search report</span>
                <input
                  type="search"
                  placeholder="Search site, domain, service, or owner"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <label>
                <span className="sr-only">Filter by website</span>
                <select value={siteFilter} onChange={(event) => setSiteFilter(event.target.value)}>
                  <option value="all">All websites</option>
                  {siteOptions.map((site) => <option key={site} value={site}>{site}</option>)}
                </select>
              </label>
              <label>
                <span className="sr-only">Filter by identification status</span>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="all">All statuses</option>
                  <option value="identified">Identified</option>
                  <option value="unknown">Unknown</option>
                  <option value="disputed">Disputed</option>
                </select>
              </label>
            </div>

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Website</th>
                    <th scope="col">Domain</th>
                    <th scope="col">Service</th>
                    <th scope="col">Requests</th>
                    <th scope="col">Identification</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDomains.map(({ key, site, domain }) => {
                    const expanded = expandedKey === key;
                    const evidence = domain.evidence ?? [];
                    return (
                      <Fragment key={key}>
                        <tr className="expandable-row">
                          <td>
                            <button
                              type="button"
                              className="row-toggle"
                              aria-label={`${expanded ? "Hide" : "Show"} requests for ${domain.domain}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                setExpandedKey(expanded ? null : key);
                              }}
                            >
                              {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                            {site.site}
                          </td>
                          <td className="domain">{domain.domain}</td>
                          <td>
                            {domain.serviceName ?? "Unknown service"}
                            {domain.owner && <small>{domain.owner}</small>}
                            {domain.categories?.length ? <small>{domain.categories.join(", ")}</small> : null}
                          </td>
                          <td>{domain.requestCount.toLocaleString()}</td>
                          <td>
                            <span className={`status status-${domain.matchStatus}`}>
                              {domain.matchStatus}
                            </span>
                          </td>
                        </tr>
                        {expanded && (
                          <tr key={`${key}:details`} className="evidence-row">
                            <td colSpan={5}>
                              <div className="evidence-panel">
                                <div className="evidence-heading">
                                  <strong>Request evidence</strong>
                                  <span>{evidence.length} recorded individual events</span>
                                </div>
                                {evidence.length === 0 ? (
                                  <p className="muted">
                                    Individual request evidence is not available in this report. The aggregate records {domain.requestCount} request(s).
                                  </p>
                                ) : (
                                  <div className="evidence-list">
                                    {evidence.map((item, index) => (
                                      <article className="evidence-item" key={`${item.requestId ?? "request"}:${item.timestamp ?? index}:${index}`}>
                                        <div className="evidence-meta">
                                          <span className="method-pill">{item.method || "Request"}</span>
                                          <span>{item.resourceType || "Resource type not recorded"}</span>
                                          <time>{formatTimestamp(item.timestamp)}</time>
                                        </div>
                                        <p className="evidence-url">{item.destination || domain.domain}</p>
                                        {item.pageUrl && (
                                          <p className="evidence-page">
                                            Initiated by: <a href={item.pageUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                                              {item.pageUrl} <ExternalLink size={12} aria-hidden="true" />
                                            </a>
                                          </p>
                                        )}
                                        {item.requestId && <small>Request ID: {item.requestId}</small>}
                                        {item.details && Object.keys(item.details).length > 0 && (
                                          <details>
                                            <summary>Additional recorded details</summary>
                                            <pre>{JSON.stringify(item.details, null, 2)}</pre>
                                          </details>
                                        )}
                                      </article>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
              {filteredDomains.length === 0 && (
                <p className="table-empty">No third-party connections match these filters.</p>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">UNIDENTIFIED NETWORK ACTIVITY</p>
                <h2>Unclassified domains</h2>
              </div>
              <span>{filteredUnknownDomains.length} entries</span>
            </div>
            <p className="section-description">
              These domains were observed, but could not be matched to a service by the analyzer registry.
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Website</th>
                    <th scope="col">Domain</th>
                    <th scope="col">Requests</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUnknownDomains.map((item) => (
                    <tr key={item.key}>
                      <td>{item.site}</td>
                      <td className="domain">{item.domain}</td>
                      <td>{item.requestCount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredUnknownDomains.length === 0 && (
                <p className="table-empty">No unclassified domains match this search.</p>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">BROWSER API ACTIVITY</p>
                <h2>Detected API usage</h2>
              </div>
            </div>
            <div className="report-filters api-filter">
              <label>
                <span className="sr-only">Filter by API category</span>
                <select value={apiKindFilter} onChange={(event) => setApiKindFilter(event.target.value)}>
                  <option value="all">All API categories</option>
                  {apiKinds.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
                </select>
              </label>
              <span className="filter-hint">Search and website filters above also apply here.</span>
            </div>
            {filteredApiActivity.map((site, index) => (
              <div className="site-activity" key={`${site.site}-${index}`}>
                <h3>{site.site}</h3>
                {site.apiDetections.length === 0 ? (
                  <p className="muted">No API detections match the current filters.</p>
                ) : (
                  <div className="detection-list">
                    {site.apiDetections.map((detection, itemIndex) => (
                      <details
                        className="detection-row"
                        key={`${detection.api}-${detection.action}-${itemIndex}`}
                      >
                        <summary>
                          <div>
                            <strong>{detection.api}</strong>
                            <small>{detection.kind} · {detection.action}</small>
                          </div>
                          <span>{detection.count.toLocaleString()} observations</span>
                        </summary>
                        <div className="detection-details">
                          <p><strong>Category:</strong> {detection.kind}</p>
                          <p><strong>Action:</strong> {detection.action}</p>
                          <p><strong>First observed:</strong> {formatTimestamp(detection.firstSeen)}</p>
                          <p><strong>Last observed:</strong> {formatTimestamp(detection.lastSeen)}</p>
                        </div>
                      </details>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {filteredApiActivity.length === 0 && (
              <p className="table-empty">No API activity matches these filters.</p>
            )}
          </section>

          {sites.some((site) => site.evidenceLimitReached || (site.droppedNetworkGroups ?? 0) > 0 || (site.droppedDetectionGroups ?? 0) > 0) && (
            <section className="transparency-note limit-note">
              <strong>Some evidence may be incomplete</strong>
              <p>
                The extension reached an evidence limit or dropped aggregate groups for one or more sites. Counts and details in this report may not include every observed event.
              </p>
              <ul>
                {sites.filter((site) => site.evidenceLimitReached || (site.droppedNetworkGroups ?? 0) > 0 || (site.droppedDetectionGroups ?? 0) > 0).map((site, index) => (
                  <li key={`${site.site}:${index}`}>
                    <strong>{site.site}</strong>
                    {site.evidenceLimitReached ? " — evidence limit reached" : ""}
                    {(site.droppedNetworkGroups ?? 0) > 0 ? ` — ${site.droppedNetworkGroups} network groups dropped` : ""}
                    {(site.droppedDetectionGroups ?? 0) > 0 ? ` — ${site.droppedDetectionGroups} API groups dropped` : ""}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <footer className="report-footer">
            Analyzer {report.analyzerVersion} · Registry {report.registryVersion} ·
            {" "}Analyzed {formatTimestamp(report.analyzedAt)}
          </footer>
        </>
      )}
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="summary-card">
      <p>{label}</p>
      <strong>{value.toLocaleString()}</strong>
    </article>
  );
}

export default App;
