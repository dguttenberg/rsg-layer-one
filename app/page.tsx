"use client";

import { useState } from "react";

type ResultItem = {
  filename: string;
  success: boolean;
  intentObject?: any;
  processed?: any;
  error?: string;
};

type BatchResponse = {
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
  results: ResultItem[];
};

export default function Home() {
  const [response, setResponse] = useState<BatchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [expandedResults, setExpandedResults] = useState<Set<number>>(new Set());

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedFiles || selectedFiles.length === 0) {
      setError("Please select at least one file");
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);
    setExpandedResults(new Set());

    const formData = new FormData();
    Array.from(selectedFiles).forEach((file) => {
      formData.append("files", file);
    });

    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Request failed");
      }

      const data = await res.json();
      setResponse(data);
    } catch (err: any) {
      setError(err.message || "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  function toggleExpand(index: number) {
    setExpandedResults((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  return (
    <main style={styles.main}>
      {/* Header */}
      <header style={styles.header}>
        <h1 style={styles.title}>RSG Brand Brain</h1>
        <p style={styles.subtitle}>Batch Brief Intake & Processing</p>
      </header>

      {/* Upload Section */}
      <section style={styles.card}>
        <form onSubmit={handleSubmit}>
          <div style={styles.uploadArea}>
            <input
              type="file"
              multiple
              accept=".txt,.pdf"
              onChange={(e) => setSelectedFiles(e.target.files)}
              style={styles.fileInput}
              id="file-upload"
            />
            <label htmlFor="file-upload" style={styles.uploadLabel}>
              <span style={styles.uploadIcon}>📁</span>
              <span style={styles.uploadText}>
                {selectedFiles && selectedFiles.length > 0
                  ? `${selectedFiles.length} file${selectedFiles.length > 1 ? "s" : ""} selected`
                  : "Click to select briefs (.txt, .pdf)"}
              </span>
              <span style={styles.uploadHint}>or drag and drop</span>
            </label>
          </div>

          {selectedFiles && selectedFiles.length > 0 && (
            <div style={styles.fileList}>
              {Array.from(selectedFiles).map((file, i) => (
                <div key={i} style={styles.fileItem}>
                  <span style={styles.fileIcon}>📄</span>
                  <span style={styles.fileName}>{file.name}</span>
                  <span style={styles.fileSize}>
                    {(file.size / 1024).toFixed(1)} KB
                  </span>
                </div>
              ))}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !selectedFiles?.length}
            style={{
              ...styles.button,
              ...(loading || !selectedFiles?.length ? styles.buttonDisabled : {}),
            }}
          >
            {loading ? (
              <span style={styles.spinner}>⏳</span>
            ) : (
              <>
                <span>🧠</span>
                <span>Process {selectedFiles?.length || 0} Brief{selectedFiles?.length !== 1 ? "s" : ""}</span>
              </>
            )}
          </button>
        </form>
      </section>

      {/* Error */}
      {error && (
        <div style={styles.errorCard}>
          <span style={styles.errorIcon}>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Results Summary */}
      {response && (
        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Results Summary</h2>
          <div style={styles.summaryGrid}>
            <div style={styles.summaryItem}>
              <span style={styles.summaryNumber}>{response.summary.total}</span>
              <span style={styles.summaryLabel}>Total</span>
            </div>
            <div style={{ ...styles.summaryItem, ...styles.successBg }}>
              <span style={styles.summaryNumber}>{response.summary.successful}</span>
              <span style={styles.summaryLabel}>✓ Successful</span>
            </div>
            <div style={{ ...styles.summaryItem, ...styles.failBg }}>
              <span style={styles.summaryNumber}>{response.summary.failed}</span>
              <span style={styles.summaryLabel}>✗ Failed</span>
            </div>
          </div>
        </section>
      )}

      {/* Individual Results */}
      {response?.results.map((result, index) => (
        <section key={index} style={styles.resultCard}>
          <div
            style={styles.resultHeader}
            onClick={() => toggleExpand(index)}
          >
            <div style={styles.resultTitle}>
              <span style={result.success ? styles.successIcon : styles.failIcon}>
                {result.success ? "✓" : "✗"}
              </span>
              <span style={styles.resultFilename}>{result.filename}</span>
            </div>
            <span style={styles.expandIcon}>
              {expandedResults.has(index) ? "▼" : "▶"}
            </span>
          </div>

          {expandedResults.has(index) && (
            <div style={styles.resultContent}>
              {result.error && (
                <div style={styles.errorBox}>
                  <strong>Error:</strong> {result.error}
                </div>
              )}

              {result.processed?.producer_summary && (
                <div style={styles.section}>
                  <h3 style={styles.subTitle}>Producer Summary</h3>
                  <div style={styles.summaryContent}>
                    <p><strong>Job:</strong> {result.processed.producer_summary.job_title}</p>
                    <p><strong>Property:</strong> {result.processed.producer_summary.property}</p>
                    <p><strong>Purpose:</strong> {result.processed.producer_summary.campaign_purpose}</p>
                    <p><strong>Deliverables:</strong> {result.processed.producer_summary.deliverables_count}</p>
                    <p><strong>Channels:</strong> {result.processed.producer_summary.channels?.join(", ")}</p>
                    <p><strong>Confidence:</strong> {Math.round((result.processed.producer_summary.confidence_score || 0) * 100)}%</p>
                    {result.processed.producer_summary.requires_human_review && (
                      <p style={styles.reviewFlag}>⚠️ Requires Human Review</p>
                    )}
                  </div>
                </div>
              )}

              {result.processed?.workflow_recommendation && (
                <div style={styles.workflowBadge}>
                  Workflow: <strong>{result.processed.workflow_recommendation}</strong>
                </div>
              )}

              {result.processed?.producer_summary?.risk_flags?.length > 0 && (
                <div style={styles.section}>
                  <h3 style={styles.subTitle}>Risk Flags</h3>
                  <ul style={styles.flagList}>
                    {result.processed.producer_summary.risk_flags.map((flag: string, i: number) => (
                      <li key={i} style={styles.flagItem}>⚠️ {flag}</li>
                    ))}
                  </ul>
                </div>
              )}

              <details style={styles.jsonDetails}>
                <summary style={styles.jsonSummary}>View Raw JSON</summary>
                <pre style={styles.jsonPre}>
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </section>
      ))}
    </main>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  main: {
    maxWidth: 800,
    margin: "0 auto",
    padding: "40px 20px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    background: "#f5f7fa",
    minHeight: "100vh",
  },
  header: {
    textAlign: "center",
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 700,
    color: "#1a1a2e",
    margin: 0,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginTop: 8,
  },
  card: {
    background: "#fff",
    borderRadius: 12,
    padding: 24,
    marginBottom: 20,
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },
  uploadArea: {
    position: "relative",
    marginBottom: 20,
  },
  fileInput: {
    position: "absolute",
    width: "100%",
    height: "100%",
    opacity: 0,
    cursor: "pointer",
  },
  uploadLabel: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 20px",
    border: "2px dashed #ccc",
    borderRadius: 8,
    cursor: "pointer",
    transition: "all 0.2s",
    background: "#fafafa",
  },
  uploadIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  uploadText: {
    fontSize: 16,
    fontWeight: 500,
    color: "#333",
  },
  uploadHint: {
    fontSize: 13,
    color: "#888",
    marginTop: 4,
  },
  fileList: {
    marginBottom: 20,
  },
  fileItem: {
    display: "flex",
    alignItems: "center",
    padding: "8px 12px",
    background: "#f5f5f5",
    borderRadius: 6,
    marginBottom: 8,
  },
  fileIcon: {
    marginRight: 10,
  },
  fileName: {
    flex: 1,
    fontWeight: 500,
  },
  fileSize: {
    color: "#888",
    fontSize: 13,
  },
  button: {
    width: "100%",
    padding: "14px 20px",
    fontSize: 16,
    fontWeight: 600,
    color: "#fff",
    background: "#4f46e5",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    transition: "background 0.2s",
  },
  buttonDisabled: {
    background: "#ccc",
    cursor: "not-allowed",
  },
  spinner: {
    animation: "spin 1s linear infinite",
  },
  errorCard: {
    background: "#fef2f2",
    color: "#b91c1c",
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  errorIcon: {
    fontSize: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 600,
    marginTop: 0,
    marginBottom: 16,
    color: "#1a1a2e",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 16,
  },
  summaryItem: {
    textAlign: "center",
    padding: 16,
    background: "#f5f5f5",
    borderRadius: 8,
  },
  summaryNumber: {
    display: "block",
    fontSize: 28,
    fontWeight: 700,
    color: "#1a1a2e",
  },
  summaryLabel: {
    fontSize: 13,
    color: "#666",
  },
  successBg: {
    background: "#ecfdf5",
  },
  failBg: {
    background: "#fef2f2",
  },
  resultCard: {
    background: "#fff",
    borderRadius: 12,
    marginBottom: 12,
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    overflow: "hidden",
  },
  resultHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 20px",
    cursor: "pointer",
    borderBottom: "1px solid #eee",
  },
  resultTitle: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  resultFilename: {
    fontWeight: 600,
    color: "#1a1a2e",
  },
  successIcon: {
    color: "#10b981",
    fontWeight: 700,
  },
  failIcon: {
    color: "#ef4444",
    fontWeight: 700,
  },
  expandIcon: {
    color: "#888",
    fontSize: 12,
  },
  resultContent: {
    padding: 20,
  },
  errorBox: {
    background: "#fef2f2",
    color: "#b91c1c",
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
  },
  section: {
    marginBottom: 20,
  },
  subTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#666",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  summaryContent: {
    lineHeight: 1.8,
  },
  reviewFlag: {
    color: "#f59e0b",
    fontWeight: 600,
    marginTop: 8,
  },
  workflowBadge: {
    display: "inline-block",
    background: "#eef2ff",
    color: "#4f46e5",
    padding: "8px 14px",
    borderRadius: 20,
    fontSize: 14,
    marginBottom: 16,
  },
  flagList: {
    margin: 0,
    paddingLeft: 0,
    listStyle: "none",
  },
  flagItem: {
    padding: "6px 0",
    color: "#b45309",
  },
  jsonDetails: {
    marginTop: 16,
  },
  jsonSummary: {
    cursor: "pointer",
    fontWeight: 500,
    color: "#4f46e5",
    padding: "8px 0",
  },
  jsonPre: {
    background: "#1a1a2e",
    color: "#e2e8f0",
    padding: 16,
    borderRadius: 8,
    overflow: "auto",
    fontSize: 12,
    lineHeight: 1.5,
    maxHeight: 400,
  },
};
