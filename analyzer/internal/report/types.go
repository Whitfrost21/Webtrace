package report

type AnalysisReport struct {
	SchemaVersion    int               `json:"schemaVersion"`
	AnalyzerVersion  string            `json:"analyzerVersion"`
	RegistryVersion  string            `json:"registryVersion"`
	AnalyzedAt       int64             `json:"analyzedAt"`
	SourceExportedAt int64             `json:"sourceExportedAt"`
	Sessions         []AnalyzedSession `json:"sessions"`
}

type AnalyzedSession struct {
	SessionID string         `json:"sessionId"`
	StartedAt int64          `json:"startedAt"`
	UpdatedAt int64          `json:"updatedAt"`
	Sites     []AnalyzedSite `json:"sites"`
}

type AnalyzedSite struct {
	Site                    string         `json:"site"`
	ThirdParties            []DomainReport `json:"thirdParties"`
	UnclassifiedDomains     []DomainReport `json:"unclassifiedDomains"`
	APIDetections           []APIDetection `json:"apiDetections"`
	TotalThirdPartyRequests int            `json:"totalThirdPartyRequests"`
	IdentifiedDomains       int            `json:"identifiedDomains"`
	UnknownDomains          int            `json:"unknownDomains"`
	DisputedDomains         int            `json:"disputedDomains"`
	EvidenceLimitReached    bool           `json:"evidenceLimitReached"`
	DroppedNetworkGroups    int            `json:"droppedNetworkGroups"`
	DroppedDetectionGroups  int            `json:"droppedDetectionGroups"`
}
type RequestEvidence struct {
	RequestID    string         `json:"requestId,omitempty"`
	PageURL      string         `json:"pageUrl"`
	Destination  string         `json:"destination"`
	Method       string         `json:"method,omitempty"`
	ResourceType string         `json:"resourceType,omitempty"`
	Party        string         `json:"party,omitempty"`
	Timestamp    float64        `json:"timestamp"`
	TabID        int            `json:"tabId,omitempty"`
	Details      map[string]any `json:"details,omitempty"`
}
type DomainReport struct {
	Domain        string            `json:"domain"`
	RequestCount  int               `json:"requestCount"`
	Methods       []string          `json:"methods"`
	ResourceTypes []string          `json:"resourceTypes"`
	FirstSeen     float64           `json:"firstSeen"`
	LastSeen      float64           `json:"lastSeen"`
	Evidence      []RequestEvidence `json:"evidence,omitempty"`
	MatchStatus   string            `json:"matchStatus"`
	ServiceID     string            `json:"serviceId,omitempty"`
	ServiceName   string            `json:"serviceName,omitempty"`
	Owner         string            `json:"owner,omitempty"`
	Categories    []string          `json:"categories,omitempty"`
	Confidence    string            `json:"confidence,omitempty"`
	MatchedRuleID string            `json:"matchedRuleId,omitempty"`
	Sources       []string          `json:"sources,omitempty"`
	Reason        string            `json:"reason,omitempty"`
}

type APIDetection struct {
	Kind      string  `json:"kind"`
	API       string  `json:"api"`
	Action    string  `json:"action"`
	Count     int     `json:"count"`
	FirstSeen float64 `json:"firstSeen"`
	LastSeen  float64 `json:"lastSeen"`
}
