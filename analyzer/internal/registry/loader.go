package registry

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"
)

type servicesFile struct {
	Services []Service `json:"services"`
}

type rulesFile struct {
	Rules []DomainRule `json:"rules"`
}

type sourcesFile struct {
	Sources []Source `json:"sources"`
}

// Load reads the separate registry files and validates their relationships.
func Load(dataDir string) (*Registry, error) {
	services, err := readJSON[servicesFile](dataDir + "/services.json")
	if err != nil {
		return nil, fmt.Errorf("load services: %w", err)
	}

	rules, err := readJSON[rulesFile](dataDir + "/domain-rules.json")
	if err != nil {
		return nil, fmt.Errorf("load domain rules: %w", err)
	}

	sources, err := readJSON[sourcesFile](dataDir + "/sources.json")
	if err != nil {
		return nil, fmt.Errorf("load sources: %w", err)
	}

	reg := &Registry{
		Version:   "1.0",
		UpdatedAt: time.Now().UTC(),
		Services:  services.Services,
		Rules:     rules.Rules,
		Sources:   sources.Sources,
	}

	if err := reg.Validate(); err != nil {
		return nil, fmt.Errorf("invalid registry: %w", err)
	}

	return reg, nil
}

func readJSON[T any](path string) (T, error) {
	var result T

	data, err := os.ReadFile(path)
	if err != nil {
		return result, err
	}

	if err := json.Unmarshal(data, &result); err != nil {
		return result, fmt.Errorf("parse %s: %w", path, err)
	}

	return result, nil
}

// Validate rejects malformed records and broken references.
func (r *Registry) Validate() error {
	serviceIDs := make(map[string]struct{}, len(r.Services))
	sourceIDs := make(map[string]struct{}, len(r.Sources))
	ruleIDs := make(map[string]struct{}, len(r.Rules))

	for _, s := range r.Services {
		if strings.TrimSpace(s.ServiceID) == "" || strings.TrimSpace(s.Name) == "" {
			return fmt.Errorf("service requires serviceId and name")
		}
		if _, exists := serviceIDs[s.ServiceID]; exists {
			return fmt.Errorf("duplicate serviceId %q", s.ServiceID)
		}
		serviceIDs[s.ServiceID] = struct{}{}
	}

	for _, s := range r.Sources {
		if strings.TrimSpace(s.SourceID) == "" || strings.TrimSpace(s.Name) == "" {
			return fmt.Errorf("source requires sourceId and name")
		}
		if _, exists := sourceIDs[s.SourceID]; exists {
			return fmt.Errorf("duplicate sourceId %q", s.SourceID)
		}
		if s.SourceType != SourceManual && s.SourceType != SourceExternal {
			return fmt.Errorf("source %q has invalid sourceType %q", s.SourceID, s.SourceType)
		}
		sourceIDs[s.SourceID] = struct{}{}
	}

	for _, rule := range r.Rules {
		if strings.TrimSpace(rule.RuleID) == "" {
			return fmt.Errorf("domain rule requires ruleId")
		}
		if _, exists := ruleIDs[rule.RuleID]; exists {
			return fmt.Errorf("duplicate ruleId %q", rule.RuleID)
		}
		ruleIDs[rule.RuleID] = struct{}{}

		pattern := strings.ToLower(strings.TrimSpace(rule.Pattern))
		if pattern == "" || strings.ContainsAny(pattern, "/:@?#") {
			return fmt.Errorf("rule %q has invalid domain pattern %q", rule.RuleID, rule.Pattern)
		}

		if rule.MatchType != MatchExact &&
			rule.MatchType != MatchDomainAndSubdomains {
			return fmt.Errorf("rule %q has invalid matchType %q", rule.RuleID, rule.MatchType)
		}

		if rule.Status != RuleActive &&
			rule.Status != RuleDeprecated &&
			rule.Status != RuleDisputed {
			return fmt.Errorf("rule %q has invalid status %q", rule.RuleID, rule.Status)
		}

		if rule.Confidence != ConfidenceHigh &&
			rule.Confidence != ConfidenceMedium &&
			rule.Confidence != ConfidenceLow {
			return fmt.Errorf("rule %q has invalid confidence %q", rule.RuleID, rule.Confidence)
		}

		if _, exists := serviceIDs[rule.ServiceID]; !exists {
			return fmt.Errorf("rule %q references unknown serviceId %q", rule.RuleID, rule.ServiceID)
		}

		if len(rule.SourceIDs) == 0 {
			return fmt.Errorf("rule %q must reference at least one source", rule.RuleID)
		}

		for _, id := range rule.SourceIDs {
			if _, exists := sourceIDs[id]; !exists {
				return fmt.Errorf("rule %q references unknown source %q", rule.RuleID, id)
			}
		}
	}

	return nil
}
