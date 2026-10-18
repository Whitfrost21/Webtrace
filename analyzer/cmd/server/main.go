package main

import (
	"Webtrace/analyzer/internal/analysis"
	"Webtrace/analyzer/internal/registry"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"Webtrace/analyzer/internal/report"
)

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		if origin == "http://localhost:5173" ||
			origin == "http://127.0.0.1:5173" ||
			(len(origin) > len("chrome-extension://") && origin[:len("chrome-extension://")] == "chrome-extension://") {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func main() {
	dataDir := os.Getenv("WEBTRACE_DATA_DIR")
	if dataDir == "" {
		dataDir = "data"
	}

	reg, err := registry.Load(dataDir)
	if err != nil {
		log.Fatalf("load registry: %v", err)
	}

	analyzer := analysis.NewAnalyzer(reg)

	historyPath := filepath.Join(dataDir, "history", "reports-history.json")
	history, err := newReportHistory(historyPath, 100)
	if err != nil {
		log.Fatalf("load report history: %v", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	mux.HandleFunc("/reports", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(history.List()); err != nil {
			log.Printf("encode report history: %v", err)
		}
	})

	mux.HandleFunc("/analyze", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, 10<<20) // 10 MB
		defer r.Body.Close()

		var input analysis.Export
		decoder := json.NewDecoder(r.Body)
		decoder.DisallowUnknownFields()

		if err := decoder.Decode(&input); err != nil {
			http.Error(w, "invalid JSON: "+err.Error(), http.StatusBadRequest)
			return
		}

		var extra any
		if err := decoder.Decode(&extra); err != nil {
			if err.Error() != "EOF" {
				http.Error(w, "request must contain one JSON value", http.StatusBadRequest)
				return
			}
		} else {
			http.Error(w, "request must contain one JSON value", http.StatusBadRequest)
			return
		}

		result, err := analyzer.Analyze(input)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		if _, err := history.Add(result); err != nil {
			http.Error(w, "analysis completed but report history could not be saved: "+err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(result); err != nil {
			log.Printf("encode report: %v", err)
		}
	})

	addr := os.Getenv("WEBTRACE_ADDR")
	if addr == "" {
		addr = "127.0.0.1:8080"
	}

	log.Printf("WebTrace analyzer listening on http://%s", addr)
	handler := corsMiddleware(mux)
	log.Fatal(http.ListenAndServe(addr, handler))
}

type storedReport struct {
	ID      string                `json:"id"`
	SavedAt int64                 `json:"savedAt"`
	Report  report.AnalysisReport `json:"report"`
}

type reportHistory struct {
	mu      sync.RWMutex
	path    string
	limit   int
	reports []storedReport
}

func newReportHistory(path string, limit int) (*reportHistory, error) {
	h := &reportHistory{path: path, limit: limit, reports: []storedReport{}}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return h, nil
		}
		return nil, err
	}
	if err := json.Unmarshal(data, &h.reports); err != nil {
		return nil, fmt.Errorf("decode %s: %w", path, err)
	}
	if h.reports == nil {
		h.reports = []storedReport{}
	}
	if len(h.reports) > limit {
		h.reports = h.reports[:limit]
	}
	return h, nil
}

func (h *reportHistory) List() []storedReport {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return append([]storedReport{}, h.reports...)
}

func (h *reportHistory) Add(value report.AnalysisReport) (storedReport, error) {
	h.mu.Lock()
	defer h.mu.Unlock()

	entry := storedReport{
		ID:      fmt.Sprintf("%d", time.Now().UnixNano()),
		SavedAt: time.Now().UnixMilli(),
		Report:  value,
	}
	next := make([]storedReport, 0, h.limit)
	next = append(next, entry)
	next = append(next, h.reports...)
	if len(next) > h.limit {
		next = next[:h.limit]
	}

	if err := os.MkdirAll(filepath.Dir(h.path), 0o755); err != nil {
		return storedReport{}, err
	}
	data, err := json.MarshalIndent(next, "", "  ")
	if err != nil {
		return storedReport{}, err
	}
	tempPath := h.path + ".tmp"
	if err := os.WriteFile(tempPath, data, 0o600); err != nil {
		return storedReport{}, err
	}
	if err := os.Rename(tempPath, h.path); err != nil {
		_ = os.Remove(tempPath)
		return storedReport{}, err
	}
	h.reports = next
	return entry, nil
}
