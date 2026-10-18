package registry

import "time"

// Registry is the complete, normalized service knowledge base.
type Registry struct {
	Version   string       `json:"version"`
	UpdatedAt time.Time    `json:"updatedAt"`
	Services  []Service    `json:"services"`
	Rules     []DomainRule `json:"rules"`
	Sources   []Source     `json:"sources"`
}

// Service describes a company or product identified by the analyzer.
type Service struct {
	ServiceID        string   `json:"serviceId"`
	Name             string   `json:"name"`
	Owner            string   `json:"owner,omitempty"`
	Categories       []string `json:"categories"`
	Description      string   `json:"description,omitempty"`
	PrivacyPolicyURL string   `json:"privacyPolicyUrl,omitempty"`
}

// DomainRule maps a hostname pattern to a known service.
type DomainRule struct {
	RuleID      string     `json:"ruleId"`
	Pattern     string     `json:"pattern"`
	MatchType   MatchType  `json:"matchType"`
	ServiceID   string     `json:"serviceId"`
	Categories  []string   `json:"categories,omitempty"`
	Status      RuleStatus `json:"status"`
	Confidence  Confidence `json:"confidence"`
	SourceIDs   []string   `json:"sources"`
	VerifiedAt  time.Time  `json:"verifiedAt,omitempty"`
	ReviewAfter time.Time  `json:"reviewAfter,omitempty"`
	Notes       string     `json:"notes,omitempty"`
}

// Source records the origin and licensing of a domain mapping.
type Source struct {
	SourceID       string     `json:"sourceId"`
	Name           string     `json:"name"`
	SourceType     SourceType `json:"sourceType"`
	SourceURL      string     `json:"sourceUrl,omitempty"`
	License        string     `json:"license,omitempty"`
	RetrievedAt    time.Time  `json:"retrievedAt,omitempty"`
	DatasetVersion string     `json:"datasetVersion,omitempty"`
}

// MatchType determines how a hostname is matched.
type MatchType string

const (
	MatchExact               MatchType = "exact"
	MatchDomainAndSubdomains MatchType = "domain-and-subdomains"
)

// RuleStatus indicates whether a rule can be used.
type RuleStatus string

const (
	RuleActive     RuleStatus = "active"
	RuleDeprecated RuleStatus = "deprecated"
	RuleDisputed   RuleStatus = "disputed"
)

// Confidence describes identification reliability, not privacy risk.
type Confidence string

const (
	ConfidenceHigh   Confidence = "high"
	ConfidenceMedium Confidence = "medium"
	ConfidenceLow    Confidence = "low"
)

// SourceType identifies how the mapping entered the registry.
type SourceType string

const (
	SourceManual   SourceType = "manual"
	SourceExternal SourceType = "external"
)
