package analysis

import (
	"Webtrace/analyzer/internal/registry"
	"testing"
)

func testRegistry() *registry.Registry {
	return &registry.Registry{
		Version: "1.0",
		Services: []registry.Service{
			{
				ServiceID:  "google-analytics",
				Name:       "Google Analytics",
				Owner:      "Google",
				Categories: []string{"analytics"},
			},
		},
		Sources: []registry.Source{
			{
				SourceID:   "curated-webtrace",
				Name:       "WebTrace Curated Registry",
				SourceType: registry.SourceManual,
			},
		},
		Rules: []registry.DomainRule{
			{
				RuleID:     "google-analytics-main",
				Pattern:    "google-analytics.com",
				MatchType:  registry.MatchDomainAndSubdomains,
				ServiceID:  "google-analytics",
				Status:     registry.RuleActive,
				Confidence: registry.ConfidenceHigh,
				SourceIDs:  []string{"curated-webtrace"},
			},
		},
	}
}

func testExport() Export {
	return Export{
		SchemaVersion: 1,
		Product:       "WebTrace",
		ExportedAt:    1000,
		Sessions: []Session{
			{
				SessionID: "session-1",
				StartedAt: 100,
				UpdatedAt: 900,
				Sites: []Site{
					{
						Site: "example.com",
						Network: []NetworkAggregate{
							{
								Destination:  "www.google-analytics.com",
								Party:        "third-party",
								Method:       "GET",
								ResourceType: "script",
								Count:        3,
								FirstSeen:    200,
								LastSeen:     400,
							},
							{
								Destination:  "unknown-tracker.example",
								Party:        "third-party",
								Method:       "POST",
								ResourceType: "xmlhttprequest",
								Count:        2,
								FirstSeen:    300,
								LastSeen:     500,
							},
							{
								Destination:  "example.com",
								Party:        "first-party",
								Method:       "GET",
								ResourceType: "document",
								Count:        1,
								FirstSeen:    100,
								LastSeen:     100,
							},
							{
								Destination:  "unclassified.example",
								Party:        "unknown",
								Method:       "GET",
								ResourceType: "fetch",
								Count:        1,
								FirstSeen:    600,
								LastSeen:     600,
							},
						},
						Detections: []DetectionAggregate{
							{
								Kind:      "storage",
								API:       "localStorage",
								Action:    "getItem",
								Count:     2,
								FirstSeen: 250,
								LastSeen:  350,
							},
						},
						EvidenceLimitReached:   true,
						DroppedNetworkGroups:   4,
						DroppedDetectionGroups: 1,
					},
				},
			},
		},
	}
}

func TestAnalyzeIdentifiesKnownDomain(t *testing.T) {
	analyzer := NewAnalyzer(testRegistry())

	result, err := analyzer.Analyze(testExport())
	if err != nil {
		t.Fatalf("Analyze() error = %v", err)
	}

	site := result.Sessions[0].Sites[0]
	if len(site.ThirdParties) != 2 {
		t.Fatalf("expected 2 third-party domains, got %d", len(site.ThirdParties))
	}

	var found bool
	for _, domain := range site.ThirdParties {
		if domain.Domain == "www.google-analytics.com" {
			found = true
			if domain.MatchStatus != string(registry.MatchIdentified) {
				t.Errorf("MatchStatus = %q, want identified", domain.MatchStatus)
			}
			if domain.ServiceID != "google-analytics" {
				t.Errorf("ServiceID = %q, want google-analytics", domain.ServiceID)
			}
			if domain.RequestCount != 3 {
				t.Errorf("RequestCount = %d, want 3", domain.RequestCount)
			}
		}
	}
	if !found {
		t.Error("known third-party domain was not reported")
	}
}

func TestAnalyzeReportsUnknownDomain(t *testing.T) {
	result, err := NewAnalyzer(testRegistry()).Analyze(testExport())
	if err != nil {
		t.Fatalf("Analyze() error = %v", err)
	}

	site := result.Sessions[0].Sites[0]
	for _, domain := range site.ThirdParties {
		if domain.Domain == "unknown-tracker.example" {
			if domain.MatchStatus != string(registry.MatchUnknown) {
				t.Errorf("MatchStatus = %q, want unknown", domain.MatchStatus)
			}
			return
		}
	}
	t.Fatal("unknown third-party domain was not reported")
}

func TestAnalyzeExcludesFirstPartyRequests(t *testing.T) {
	result, err := NewAnalyzer(testRegistry()).Analyze(testExport())
	if err != nil {
		t.Fatalf("Analyze() error = %v", err)
	}

	site := result.Sessions[0].Sites[0]
	for _, domain := range site.ThirdParties {
		if domain.Domain == "example.com" {
			t.Error("first-party domain included in third-party results")
		}
	}
}

func TestAnalyzePreservesUnclassifiedDomains(t *testing.T) {
	result, err := NewAnalyzer(testRegistry()).Analyze(testExport())
	if err != nil {
		t.Fatalf("Analyze() error = %v", err)
	}

	site := result.Sessions[0].Sites[0]
	if len(site.UnclassifiedDomains) != 1 {
		t.Fatalf("expected 1 unclassified domain, got %d", len(site.UnclassifiedDomains))
	}
	if site.UnclassifiedDomains[0].Domain != "unclassified.example" {
		t.Errorf("unexpected domain: %q", site.UnclassifiedDomains[0].Domain)
	}
}

func TestAnalyzePreservesDetectionsAndEvidenceMetadata(t *testing.T) {
	result, err := NewAnalyzer(testRegistry()).Analyze(testExport())
	if err != nil {
		t.Fatalf("Analyze() error = %v", err)
	}

	site := result.Sessions[0].Sites[0]
	if len(site.APIDetections) != 1 {
		t.Fatalf("expected 1 API detection, got %d", len(site.APIDetections))
	}
	if site.APIDetections[0].API != "localStorage" {
		t.Errorf("API = %q, want localStorage", site.APIDetections[0].API)
	}
	if !site.EvidenceLimitReached {
		t.Error("EvidenceLimitReached should be true")
	}
	if site.DroppedNetworkGroups != 4 {
		t.Errorf("DroppedNetworkGroups = %d, want 4", site.DroppedNetworkGroups)
	}
	if site.DroppedDetectionGroups != 1 {
		t.Errorf("DroppedDetectionGroups = %d, want 1", site.DroppedDetectionGroups)
	}
}

func TestAnalyzeRejectsUnsupportedSchema(t *testing.T) {
	input := testExport()
	input.SchemaVersion = 99

	_, err := NewAnalyzer(testRegistry()).Analyze(input)
	if err == nil {
		t.Fatal("expected an error for unsupported schema version")
	}
}
