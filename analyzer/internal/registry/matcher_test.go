package registry

import "testing"

func testRegistry() *Registry {
	return &Registry{
		Services: []Service{
			{ServiceID: "analytics", Name: "Analytics"},
			{ServiceID: "other", Name: "Other Service"},
		},
		Sources: []Source{
			{SourceID: "curated", Name: "Curated", SourceType: SourceManual},
		},
		Rules: []DomainRule{
			{
				RuleID:     "parent",
				Pattern:    "example.com",
				MatchType:  MatchDomainAndSubdomains,
				ServiceID:  "analytics",
				Status:     RuleActive,
				Confidence: ConfidenceHigh,
				SourceIDs:  []string{"curated"},
			},
			{
				RuleID:     "exact",
				Pattern:    "api.example.com",
				MatchType:  MatchExact,
				ServiceID:  "other",
				Status:     RuleActive,
				Confidence: ConfidenceMedium,
				SourceIDs:  []string{"curated"},
			},
		},
	}
}

func TestMatchParentDomain(t *testing.T) {
	result := testRegistry().Match("cdn.example.com")
	if result.Status != MatchIdentified || result.RuleID != "parent" {
		t.Fatalf("unexpected result: %+v", result)
	}
}

func TestMatchExactOverridesParent(t *testing.T) {
	result := testRegistry().Match("api.example.com")
	if result.Status != MatchIdentified || result.RuleID != "exact" {
		t.Fatalf("unexpected result: %+v", result)
	}
	if result.Service == nil || result.Service.ServiceID != "other" {
		t.Fatalf("wrong service: %+v", result.Service)
	}
}

func TestMatchRejectsSubstring(t *testing.T) {
	result := testRegistry().Match("notexample.com")
	if result.Status != MatchUnknown {
		t.Fatalf("expected unknown, got %+v", result)
	}
}

func TestMatchUnknownDomain(t *testing.T) {
	result := testRegistry().Match("unlisted.test")
	if result.Status != MatchUnknown {
		t.Fatalf("expected unknown, got %+v", result)
	}
}
