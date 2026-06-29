import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Excalidraw } from "@excalidraw/excalidraw";

export default function Generate() {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState("idle"); // idle | streaming | done | error
  const [diagrams, setDiagrams] = useState([]);
  const [hasContent, setHasContent] = useState(false);
  const [activeDiagramId, setActiveDiagramId] = useState(null);
  const navigate = useNavigate();

  // Use a ref for the API — avoids stale closure issues in SSE callbacks
  const excalidrawAPIRef = useRef(null);
  // Pending elements when API isn't ready yet
  const pendingRef = useRef(null);

  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  useEffect(() => {
    if (!token) navigate("/login");
    fetchDiagrams();
  }, []);

  async function fetchDiagrams() {
    try {
      const res = await fetch("/api/v1/diagrams/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setDiagrams(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to fetch diagrams:", e);
    }
  }

  // Called once Excalidraw mounts and gives us its API
  const onExcalidrawMount = useCallback((api) => {
    excalidrawAPIRef.current = api;

    // If elements were generated before the API was ready, apply them now
    if (pendingRef.current) {
      applyElements(api, pendingRef.current);
      pendingRef.current = null;
    }
  }, []);

  // Central function to push elements onto the canvas
  function applyElements(api, elements) {
    if (!api || !elements?.length) return;

    api.updateScene({
      elements,
      appState: {
        viewBackgroundColor: "#06060B",
      },
    });

    // Give the renderer a frame to paint before scrolling
    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          api.scrollToContent(elements, { fitToContent: true });
        } catch (_) {
          // scrollToContent can throw if canvas isn't fully mounted yet — safe to ignore
        }
      }, 150);
    });

    setHasContent(true);
  }

  function sanitizeElements(elements) {
    return elements.map((el) => {
      if (el.type === "arrow" || el.type === "line") {
        return {
          ...el,
          points: Array.isArray(el.points) && el.points.length >= 2
            ? el.points
            : [[0, 0], [0, 50]],
        };
      }
      return el;
    });
  }

  function handleGenerate() {
    if (!prompt.trim() || status === "streaming") return;
    setStatus("streaming");

    const url = `/api/v1/diagrams/stream?prompt=${encodeURIComponent(prompt)}&token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    let fullContent = "";

    es.onmessage = (e) => {
      let data;
      try {
        data = JSON.parse(e.data);
      } catch {
        return;
      }

      if (data.type === "chunk") {
        fullContent += data.content;
      }

      if (data.type === "done") {
        es.close();
        setStatus("done");
        try {
          const parsed = JSON.parse(fullContent);
          const elements = sanitizeElements(parsed.elements || []);

          const api = excalidrawAPIRef.current;
          if (api) {
            applyElements(api, elements);
          } else {
            // API not ready yet — queue and apply on mount
            pendingRef.current = elements;
            setHasContent(true);
          }

          if (data.diagram_id) {
            setActiveDiagramId(data.diagram_id);
          }
          fetchDiagrams();
        } catch (err) {
          console.error("JSON parse error:", err, "\nRaw content:", fullContent);
          setStatus("error");
        }
      }

      if (data.type === "error") {
        es.close();
        setStatus("error");
      }
    };

    es.onerror = () => {
      es.close();
      setStatus("error");
    };
  }

  function loadDiagram(diagram) {
    try {
      const data = diagram.excalidraw_data;
      const elements = sanitizeElements(data?.elements || []);
      const api = excalidrawAPIRef.current;
      if (api) {
        applyElements(api, elements);
        setActiveDiagramId(diagram.id);
      }
    } catch (e) {
      console.error("Failed to load diagram:", e);
    }
  }

  function handleLogout() {
    localStorage.clear();
    navigate("/login");
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg)", overflow: "hidden" }}>

      {/* ── Left Sidebar ── */}
      <div className="sidebar">

        {/* Header */}
        <div style={{ padding: "20px 20px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{
                width: "30px",
                height: "30px",
                borderRadius: "var(--radius-sm)",
                background: "var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                fontWeight: "700",
                color: "var(--bg)",
                fontFamily: "Space Grotesk, sans-serif",
              }}>
                ◇
              </div>
              <span className="mono" style={{ color: "var(--text-secondary)", fontSize: "11px", letterSpacing: "0.05em" }}>
                AI DIAGRAM STUDIO
              </span>
            </div>
          </div>

          {/* User info */}
          <div style={{
            marginTop: "16px",
            padding: "10px 12px",
            borderRadius: "var(--radius-sm)",
            background: "var(--bg)",
            border: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}>
            <div style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-dim) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              fontWeight: "600",
              color: "var(--bg)",
              fontFamily: "Space Grotesk, sans-serif",
              flexShrink: 0,
            }}>
              {(user.name || user.email || "U").charAt(0).toUpperCase()}
            </div>
            <div style={{ overflow: "hidden" }}>
              <p style={{
                color: "var(--text)",
                fontSize: "12px",
                fontWeight: "500",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
                overflow: "hidden",
              }}>
                {user.name || "User"}
              </p>
              <p className="mono" style={{
                color: "var(--muted)",
                fontSize: "10px",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
                overflow: "hidden",
              }}>
                {user.email}
              </p>
            </div>
          </div>
        </div>

        <hr className="divider" />

        {/* Prompt input section */}
        <div style={{ padding: "20px" }}>
          <label className="field-label">DESCRIBE YOUR DIAGRAM</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A microservices architecture with API gateway, auth service, and PostgreSQL..."
            rows={4}
            className="textarea-field"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate();
            }}
          />

          <button
            onClick={handleGenerate}
            disabled={status === "streaming" || !prompt.trim()}
            className="btn-primary"
            style={{ marginTop: "12px" }}
          >
            {status === "streaming" ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                Generating
                <span className="loading-dots"><span></span><span></span><span></span></span>
              </span>
            ) : (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M14 2L7 13l-1-4-4-1L14 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Generate diagram
              </span>
            )}
          </button>

          {/* Status indicators */}
          {status === "streaming" && (
            <div className="status-bar status-streaming animate-fade-in">
              <span className="status-dot streaming"></span>
              streaming from AI...
            </div>
          )}
          {status === "error" && (
            <div className="status-bar status-error animate-fade-in">
              <span className="status-dot error"></span>
              generation failed — try again
            </div>
          )}
          {status === "done" && (
            <div className="status-bar status-done animate-fade-in">
              <span className="status-dot done"></span>
              diagram generated ✓
            </div>
          )}
        </div>

        <hr className="divider" />

        {/* Diagram history */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 12px" }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 6px",
            marginBottom: "12px",
          }}>
            <label className="field-label" style={{ margin: 0 }}>HISTORY</label>
            <span className="mono" style={{
              fontSize: "10px",
              color: "var(--muted)",
              background: "var(--bg)",
              padding: "2px 8px",
              borderRadius: "999px",
              border: "1px solid var(--border)",
            }}>
              {diagrams.length}
            </span>
          </div>

          {diagrams.length === 0 && (
            <div style={{
              padding: "32px 16px",
              textAlign: "center",
            }}>
              <div style={{ fontSize: "24px", marginBottom: "8px", opacity: 0.4 }}>📊</div>
              <p style={{ color: "var(--muted)", fontSize: "12px", lineHeight: "1.6" }}>
                No diagrams yet.
                <br />
                <span style={{ fontSize: "11px" }}>Generate your first one above!</span>
              </p>
            </div>
          )}

          {diagrams.map((d) => (
            <div
              key={d.id}
              onClick={() => loadDiagram(d)}
              className="history-item"
              style={{
                background: activeDiagramId === d.id ? "var(--bg-elevated)" : "transparent",
                borderColor: activeDiagramId === d.id ? "var(--border-hover)" : "transparent",
              }}
            >
              <p style={{
                fontSize: "12px",
                color: "var(--text)",
                marginBottom: "6px",
                lineHeight: "1.4",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}>
                {d.title}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="mono" style={{ fontSize: "10px", color: "var(--muted)" }}>
                  {formatDate(d.created_at)}
                </span>
                {d.llm_model === "cached" && (
                  <span className="tag" style={{ fontSize: "9px", padding: "1px 6px" }}>
                    ⚡ cached
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Logout */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
          <button onClick={handleLogout} className="btn-ghost">
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3M11 11l3-3-3-3M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Sign out
            </span>
          </button>
        </div>
      </div>

      {/* ── Right — Excalidraw canvas ── */}
      {/*
        CRITICAL: The wrapper must be position:relative with explicit width+height.
        Excalidraw reads the parent's bounding rect on mount to size its canvas.
        flex:1 alone can give 0-height in some browsers — add height:100% to be safe.
      */}
      <div className="excalidraw-wrapper">

        {/* Empty state overlay — pointer-events:none so it never blocks the canvas */}
        {!hasContent && (
          <div className="empty-state">
            <div className="empty-state-content animate-fade-in">
              <div className="empty-state-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <path d="M3 9h18M9 21V9"/>
                </svg>
              </div>
              <p style={{ color: "var(--text-secondary)", fontSize: "14px", fontWeight: "500" }}>
                Describe a system to get started
              </p>
              <p className="mono" style={{ color: "var(--muted)", fontSize: "11px", marginTop: "8px" }}>
                Ctrl + Enter to generate
              </p>
            </div>
          </div>
        )}

        <Excalidraw
          excalidrawAPI={onExcalidrawMount}
          theme="dark"
          initialData={{
            elements: [],
            appState: {
              viewBackgroundColor: "#06060B",
              // Hide the toolbar / welcome screen icons
              isLoading: false,
            },
          }}
          UIOptions={{
            // Hide top toolbar tools (hand, lock, etc.)
            tools: { image: false },
            // Hide all canvas action buttons we don't need
            canvasActions: {
              export: false,
              loadScene: false,
              saveToActiveFile: false,
              toggleTheme: false,
              saveAsImage: false,
            },
          }}
          // Hides the default welcome screen that shows huge icons
          renderTopRightUI={() => null}
        />
      </div>
    </div>
  );
}