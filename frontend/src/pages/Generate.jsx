import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Excalidraw } from "@excalidraw/excalidraw";

export default function Generate() {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState("idle"); // idle | streaming | done | error
  const [diagrams, setDiagrams] = useState([]);
  const [hasContent, setHasContent] = useState(false);
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
        viewBackgroundColor: "#0A0A0F",
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
      }
    } catch (e) {
      console.error("Failed to load diagram:", e);
    }
  }

  function handleLogout() {
    localStorage.clear();
    navigate("/login");
  }

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        background: "var(--bg)",
        overflow: "hidden",
      }}
    >
      {/* ── Left Sidebar ── */}
      <div
        style={{
          width: "280px",
          flexShrink: 0,
          borderRight: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          background: "var(--surface)",
        }}
      >
        {/* Header */}
        <div style={{ padding: "20px", borderBottom: "1px solid var(--border)" }}>
          <span className="mono" style={{ color: "var(--accent)", fontSize: "12px" }}>
            $ ai-diagram-studio
          </span>
          <p style={{ color: "var(--muted)", fontSize: "12px", marginTop: "4px" }}>
            {user.email}
          </p>
        </div>

        {/* Prompt input */}
        <div style={{ padding: "20px", borderBottom: "1px solid var(--border)" }}>
          <label
            className="mono"
            style={{
              fontSize: "11px",
              color: "var(--muted)",
              display: "block",
              marginBottom: "8px",
            }}
          >
            DESCRIBE YOUR DIAGRAM
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A microservices architecture with API gateway, auth service, and PostgreSQL..."
            rows={5}
            style={{
              width: "100%",
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: "var(--text)",
              padding: "12px",
              fontSize: "13px",
              fontFamily: "JetBrains Mono, monospace",
              outline: "none",
              resize: "none",
              lineHeight: "1.6",
              boxSizing: "border-box",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate();
            }}
          />

          <button
            onClick={handleGenerate}
            disabled={status === "streaming" || !prompt.trim()}
            style={{
              width: "100%",
              marginTop: "10px",
              background: status === "streaming" ? "var(--border)" : "var(--accent)",
              color: "#0A0A0F",
              padding: "11px",
              fontSize: "13px",
              fontWeight: "600",
              fontFamily: "Space Grotesk",
              border: "none",
              cursor: status === "streaming" ? "not-allowed" : "pointer",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => {
              if (status !== "streaming") e.target.style.background = "var(--accent-dim)";
            }}
            onMouseLeave={(e) => {
              if (status !== "streaming") e.target.style.background = "var(--accent)";
            }}
          >
            {status === "streaming" ? "⟳ Generating..." : "⌘ Generate →"}
          </button>

          {/* Status line */}
          {status === "streaming" && (
            <p className="mono" style={{ color: "var(--accent)", fontSize: "11px", marginTop: "8px" }}>
              ▸ streaming from AI...
            </p>
          )}
          {status === "error" && (
            <p className="mono" style={{ color: "#FF5F5F", fontSize: "11px", marginTop: "8px" }}>
              ✗ generation failed — try again
            </p>
          )}
          {status === "done" && (
            <p className="mono" style={{ color: "var(--accent)", fontSize: "11px", marginTop: "8px" }}>
              ✓ saved to github
            </p>
          )}
        </div>

        {/* Diagram history */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
          <label
            className="mono"
            style={{
              fontSize: "11px",
              color: "var(--muted)",
              display: "block",
              marginBottom: "12px",
            }}
          >
            HISTORY ({diagrams.length})
          </label>

          {diagrams.length === 0 && (
            <p style={{ color: "var(--muted)", fontSize: "12px" }}>No diagrams yet.</p>
          )}

          {diagrams.map((d) => (
            <div
              key={d.id}
              onClick={() => loadDiagram(d)}
              style={{
                padding: "10px 12px",
                marginBottom: "6px",
                border: "1px solid var(--border)",
                cursor: "pointer",
                transition: "border-color 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            >
              <p style={{ fontSize: "12px", color: "var(--text)", marginBottom: "4px" }}>
                {d.title}
              </p>
              <p className="mono" style={{ fontSize: "10px", color: "var(--muted)" }}>
                {new Date(d.created_at).toLocaleDateString()}
                {d.llm_model === "cache" && " · ⚡ cached"}
              </p>
            </div>
          ))}
        </div>

        {/* Logout */}
        <div style={{ padding: "16px", borderTop: "1px solid var(--border)" }}>
          <button
            onClick={handleLogout}
            style={{
              width: "100%",
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--muted)",
              padding: "9px",
              fontSize: "12px",
              fontFamily: "Space Grotesk",
              cursor: "pointer",
              transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.target.style.borderColor = "#FF5F5F";
              e.target.style.color = "#FF5F5F";
            }}
            onMouseLeave={(e) => {
              e.target.style.borderColor = "var(--border)";
              e.target.style.color = "var(--muted)";
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* ── Right — Excalidraw canvas ── */}
      {/*
        CRITICAL: The wrapper must be position:relative with explicit width+height.
        Excalidraw reads the parent's bounding rect on mount to size its canvas.
        flex:1 alone can give 0-height in some browsers — add height:100% to be safe.
      */}
      <div style={{ flex: 1, position: "relative", height: "100vh", overflow: "hidden" }}>

        {/* Empty state overlay — pointer-events:none so it never blocks the canvas */}
        {!hasContent && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2,
              pointerEvents: "none",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <p className="mono" style={{ color: "var(--muted)", fontSize: "13px" }}>
                describe a system → hit generate
              </p>
              <p
                className="mono"
                style={{ color: "var(--border)", fontSize: "11px", marginTop: "8px" }}
              >
                ⌘ + Enter to generate
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
              viewBackgroundColor: "#0A0A0F",
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