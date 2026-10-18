package analysis

import (
	"fmt"
	"net/url"
	"sort"
	"strings"
	"time"

	"Webtrace/analyzer/internal/registry"
	"Webtrace/analyzer/internal/report"
)

type Analyzer struct {
	registry *registry.Registry
}

func NewAnalyzer(reg *registry.Registry) *Analyzer {
	return &Analyzer{registry: reg}
}

func (a *Analyzer) Analyze(input Export) (report.AnalysisReport, error) {
	if a.registry == nil {
		return report.AnalysisReport{}, fmt.Errorf("registry is nil")
	}
	if input.SchemaVersion != 1 {
		return report.AnalysisReport{}, fmt.Errorf(
			"unsupported schema version: %d", input.SchemaVersion,
		)
	}
	if input.Product != "WebTrace" {
		return report.AnalysisReport{}, fmt.Errorf(
			"unsupported product: %q", input.Product,
		)
	}

	output := report.AnalysisReport{
		SchemaVersion:    1,
		AnalyzerVersion:  "1.0.0",
		RegistryVersion:  a.registry.Version,
		AnalyzedAt:       time.Now().UnixMilli(),
		SourceExportedAt: input.ExportedAt,
		Sessions:         make([]report.AnalyzedSession, 0, len(input.Sessions)),
	}

	for _, session := range input.Sessions {
		outSession := report.AnalyzedSession{
			SessionID: session.SessionID,
			StartedAt: session.StartedAt,
			UpdatedAt: session.UpdatedAt,
			Sites:     make([]report.AnalyzedSite, 0, len(session.Sites)),
		}

		for _, site := range session.Sites {
			outSite := report.AnalyzedSite{
				Site:                   site.Site,
				ThirdParties:           []report.DomainReport{},
				UnclassifiedDomains:    []report.DomainReport{},
				APIDetections:          []report.APIDetection{},
				EvidenceLimitReached:   site.EvidenceLimitReached,
				DroppedNetworkGroups:   site.DroppedNetworkGroups,
				DroppedDetectionGroups: site.DroppedDetectionGroups,
			}

			for _, network := range site.Network {
				domain := normalizeDestination(network.Destination)
				if domain == "" {
					continue
				}

				switch network.Party {
				case "third-party":
					match := a.registry.Match(domain)
					domainReport := report.DomainReport{
						Domain:        domain,
						RequestCount:  network.Count,
						Methods:       []string{network.Method},
						ResourceTypes: []string{network.ResourceType},
						FirstSeen:     network.FirstSeen,
						LastSeen:      network.LastSeen,
						MatchStatus:   string(match.Status),
						Reason:        match.Reason,
					}
					for _, evidence := range site.Evidence {
						if evidence.Type != "network" {
							continue
						}

						if normalizeDestination(evidence.Destination) != domain {
							continue
						}

						domainReport.Evidence = append(
							domainReport.Evidence,
							report.RequestEvidence{
								RequestID:    evidence.RequestID,
								PageURL:      evidence.PageURL,
								Destination:  evidence.Destination,
								Method:       evidence.Method,
								ResourceType: evidence.ResourceType,
								Party:        evidence.Party,
								Timestamp:    evidence.Timestamp,
								TabID:        evidence.TabID,
								Details:      evidence.Details,
							},
						)
					}

					if match.Service != nil {
						domainReport.ServiceID = match.Service.ServiceID
						domainReport.ServiceName = match.Service.Name
						domainReport.Owner = match.Service.Owner
						domainReport.Categories = match.Service.Categories
						domainReport.Confidence = string(match.Confidence)
						domainReport.MatchedRuleID = match.RuleID
						domainReport.Sources = match.SourceIDs
					}

					outSite.ThirdParties = append(outSite.ThirdParties, domainReport)
					outSite.TotalThirdPartyRequests += network.Count

				case "unknown":
					outSite.UnclassifiedDomains = append(
						outSite.UnclassifiedDomains,
						report.DomainReport{
							Domain:        domain,
							RequestCount:  network.Count,
							Methods:       []string{network.Method},
							ResourceTypes: []string{network.ResourceType},
							FirstSeen:     network.FirstSeen,
							LastSeen:      network.LastSeen,
							MatchStatus:   "unclassified",
							Reason:        "Extension did not classify this request.",
						},
					)
				}
			}

			for _, detection := range site.Detections {
				outSite.APIDetections = append(outSite.APIDetections, report.APIDetection{
					Kind:      detection.Kind,
					API:       detection.API,
					Action:    detection.Action,
					Count:     detection.Count,
					FirstSeen: detection.FirstSeen,
					LastSeen:  detection.LastSeen,
				})
			}

			outSite.ThirdParties = mergeDomainReports(outSite.ThirdParties)
			outSite.UnclassifiedDomains = mergeDomainReports(outSite.UnclassifiedDomains)

			// Count each unique third-party domain once.
			for _, domain := range outSite.ThirdParties {
				switch domain.MatchStatus {
				case string(registry.MatchIdentified):
					outSite.IdentifiedDomains++
				case string(registry.MatchDisputed):
					outSite.DisputedDomains++
				default:
					outSite.UnknownDomains++
				}
			}

			outSession.Sites = append(outSession.Sites, outSite)
		}

		output.Sessions = append(output.Sessions, outSession)
	}

	return output, nil
}

func normalizeDestination(destination string) string {
	destination = strings.TrimSpace(destination)
	if destination == "" {
		return ""
	}

	// Parse full URLs; otherwise treat the value as a hostname.
	if strings.Contains(destination, "://") {
		parsed, err := url.Parse(destination)
		if err != nil {
			return ""
		}
		destination = parsed.Hostname()
	} else {
		// Remove an optional port from host:port values.
		if parsed, err := url.Parse("//" + destination); err == nil &&
			parsed.Hostname() != "" {
			destination = parsed.Hostname()
		}
	}

	return strings.TrimSuffix(strings.ToLower(destination), ".")
}

func mergeDomainReports(items []report.DomainReport) []report.DomainReport {
	merged := make(map[string]report.DomainReport)

	for _, item := range items {
		key := item.Domain
		existing, ok := merged[key]
		if !ok {
			merged[key] = item
			continue
		}

		existing.RequestCount += item.RequestCount
		if item.FirstSeen < existing.FirstSeen {
			existing.FirstSeen = item.FirstSeen
		}
		if item.LastSeen > existing.LastSeen {
			existing.LastSeen = item.LastSeen
		}

		existing.Methods = uniqueSorted(append(existing.Methods, item.Methods...))
		existing.ResourceTypes = uniqueSorted(
			append(existing.ResourceTypes, item.ResourceTypes...),
		)
		existing.Evidence = append(existing.Evidence, item.Evidence...)
		merged[key] = existing
	}

	result := make([]report.DomainReport, 0, len(merged))
	for _, item := range merged {
		result = append(result, item)
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].Domain < result[j].Domain
	})
	return result
}

func uniqueSorted(values []string) []string {
	set := make(map[string]struct{})
	for _, value := range values {
		if value != "" {
			set[value] = struct{}{}
		}
	}

	result := make([]string, 0, len(set))
	for value := range set {
		result = append(result, value)
	}
	sort.Strings(result)
	return result
}
