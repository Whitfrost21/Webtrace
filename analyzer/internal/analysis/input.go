package analysis

// Export mirrors the extension's WebTraceExport schemaVersion 1.
type Export struct {
	SchemaVersion int       `json:"schemaVersion"`
	Product       string    `json:"product"`
	ExportedAt    int64     `json:"exportedAt"`
	Sessions      []Session `json:"sessions"`
}

type Session struct {
	SessionID    string `json:"sessionId"`
	StartedAt    int64  `json:"startedAt"`
	UpdatedAt    int64  `json:"updatedAt"`
	Sites        []Site `json:"sites"`
	TotalEvents  int    `json:"totalEvents"`
	StorageError bool   `json:"storageError"`
}

type Site struct {
	Site                   string               `json:"site"`
	Network                []NetworkAggregate   `json:"network"`
	Detections             []DetectionAggregate `json:"detections"`
	Evidence               []Evidence           `json:"evidence"`
	TotalEvents            int                  `json:"totalEvents"`
	EvidenceLimitReached   bool                 `json:"evidenceLimitReached"`
	DroppedNetworkGroups   int                  `json:"droppedNetworkGroups"`
	DroppedDetectionGroups int                  `json:"droppedDetectionGroups"`
}

type NetworkAggregate struct {
	Site         string  `json:"site"`
	PageURL      string  `json:"pageUrl"`
	Destination  string  `json:"destination"`
	Party        string  `json:"party"`
	Method       string  `json:"method"`
	ResourceType string  `json:"resourceType"`
	Count        int     `json:"count"`
	FirstSeen    float64 `json:"firstSeen"`
	LastSeen     float64 `json:"lastSeen"`
}

type DetectionAggregate struct {
	Site      string  `json:"site"`
	PageURL   string  `json:"pageUrl"`
	Kind      string  `json:"kind"`
	API       string  `json:"api"`
	Action    string  `json:"action"`
	Count     int     `json:"count"`
	FirstSeen float64 `json:"firstSeen"`
	LastSeen  float64 `json:"lastSeen"`
}

type Evidence struct {
	Type         string         `json:"type"`
	RequestID    string         `json:"requestId,omitempty"`
	PageURL      string         `json:"pageUrl"`
	Destination  string         `json:"destination,omitempty"`
	Party        string         `json:"party,omitempty"`
	Method       string         `json:"method,omitempty"`
	TabID        int            `json:"tabId,omitempty"`
	ResourceType string         `json:"resourceType,omitempty"`
	Timestamp    float64        `json:"timestamp"`
	Kind         string         `json:"kind,omitempty"`
	API          string         `json:"api,omitempty"`
	Action       string         `json:"action,omitempty"`
	Details      map[string]any `json:"details,omitempty"`
}
