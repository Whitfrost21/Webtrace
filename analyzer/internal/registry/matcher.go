package registry

import (
	"sort"
	"strings"
	"time"
)

type MatchStatus string

const (
	MatchIdentified MatchStatus = "identified"
	MatchUnknown    MatchStatus = "unknown"
	MatchDisputed   MatchStatus = "disputed"
)

type MatchResult struct {
	Status     MatchStatus `json:"status"`
	Domain     string      `json:"domain"`
	Service    *Service    `json:"service,omitempty"`
	RuleID     string      `json:"matchedRuleId,omitempty"`
	Confidence Confidence  `json:"confidence,omitempty"`
	SourceIDs  []string    `json:"sources,omitempty"`
	MatchedAt  time.Time   `json:"matchedAt"`
	Reason     string      `json:"reason,omitempty"`
}

// Match finds the best applicable rule for a hostname.
func (r *Registry) Match(hostname string) MatchResult {
	host, ok := normalizeHostname(hostname)
	if !ok {
		return unknownResult(hostname, "invalid hostname")
	}

	now := time.Now().UTC()
	matches := make([]DomainRule, 0)

	for _, rule := range r.Rules {
		if rule.Status == RuleDeprecated {
			continue
		}

		pattern, valid := normalizeHostname(rule.Pattern)
		if !valid {
			continue
		}

		matched := false
		switch rule.MatchType {
		case MatchExact:
			matched = host == pattern
		case MatchDomainAndSubdomains:
			matched = host == pattern || strings.HasSuffix(host, "."+pattern)
		}

		if matched {
			matches = append(matches, rule)
		}
	}

	if len(matches) == 0 {
		return MatchResult{
			Status:    MatchUnknown,
			Domain:    host,
			MatchedAt: now,
			Reason:    "no active registry rule matched this hostname",
		}
	}

	// Exact hostname rules take priority over parent-domain rules.
	sort.Slice(matches, func(i, j int) bool {
		if matches[i].MatchType != matches[j].MatchType {
			return matches[i].MatchType == MatchExact
		}
		return len(matches[i].Pattern) > len(matches[j].Pattern)
	})

	best := matches[0]

	// Rules at the same specificity must agree on service identity.
	for _, candidate := range matches[1:] {
		if candidate.MatchType != best.MatchType ||
			len(candidate.Pattern) != len(best.Pattern) {
			break
		}

		if candidate.ServiceID != best.ServiceID ||
			candidate.Status == RuleDisputed ||
			best.Status == RuleDisputed {
			return MatchResult{
				Status:    MatchDisputed,
				Domain:    host,
				MatchedAt: now,
				Reason:    "equally specific registry rules conflict",
			}
		}
	}

	if best.Status == RuleDisputed {
		return MatchResult{
			Status:    MatchDisputed,
			Domain:    host,
			RuleID:    best.RuleID,
			MatchedAt: now,
			Reason:    "the best matching rule is disputed",
		}
	}

	service, found := r.findService(best.ServiceID)
	if !found {
		return unknownResult(host, "matched rule references a missing service")
	}

	return MatchResult{
		Status:     MatchIdentified,
		Domain:     host,
		Service:    &service,
		RuleID:     best.RuleID,
		Confidence: best.Confidence,
		SourceIDs:  append([]string(nil), best.SourceIDs...),
		MatchedAt:  now,
	}
}

func (r *Registry) findService(serviceID string) (Service, bool) {
	for _, service := range r.Services {
		if service.ServiceID == serviceID {
			return service, true
		}
	}
	return Service{}, false
}

func normalizeHostname(input string) (string, bool) {
	host := strings.ToLower(strings.TrimSpace(input))
	host = strings.TrimSuffix(host, ".")

	if host == "" || strings.ContainsAny(host, "/:@?#") {
		return "", false
	}

	// This function expects a hostname, not a URL. URL parsing belongs
	// in the analyzer before calling Match.
	if strings.Contains(host, "..") || strings.HasPrefix(host, ".") {
		return "", false
	}

	return host, true
}

func unknownResult(input, reason string) MatchResult {
	host, ok := normalizeHostname(input)
	if !ok {
		host = input
	}
	return MatchResult{
		Status:    MatchUnknown,
		Domain:    host,
		MatchedAt: time.Now().UTC(),
		Reason:    reason,
	}
}
