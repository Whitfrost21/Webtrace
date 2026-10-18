package registry

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadRegistry(t *testing.T) {
	dir := t.TempDir()

	files := map[string]string{
		"services.json":     `{"services":[{"serviceId":"analytics","name":"Analytics","categories":["analytics"]}]}`,
		"domain-rules.json": `{"rules":[{"ruleId":"analytics-domain","pattern":"analytics.example","matchType":"domain-and-subdomains","serviceId":"analytics","status":"active","confidence":"high","sources":["curated"]}]}`,
		"sources.json":      `{"sources":[{"sourceId":"curated","name":"Test registry","sourceType":"manual"}]}`,
	}

	for name, contents := range files {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(contents), 0600); err != nil {
			t.Fatal(err)
		}
	}

	reg, err := Load(dir)
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if len(reg.Services) != 1 || len(reg.Rules) != 1 || len(reg.Sources) != 1 {
		t.Fatal("registry records were not loaded correctly")
	}
}

func TestValidateRejectsUnknownService(t *testing.T) {
	reg := &Registry{
		Services: []Service{},
		Sources: []Source{
			{SourceID: "curated", Name: "Curated", SourceType: SourceManual},
		},
		Rules: []DomainRule{
			{
				RuleID:     "broken",
				Pattern:    "example.com",
				MatchType:  MatchExact,
				ServiceID:  "missing",
				Status:     RuleActive,
				Confidence: ConfidenceHigh,
				SourceIDs:  []string{"curated"},
			},
		},
	}

	if err := reg.Validate(); err == nil {
		t.Fatal("expected unknown service reference to fail validation")
	}
}
