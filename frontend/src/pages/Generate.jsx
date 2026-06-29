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
    if (!token) {
      navigate("/login");
      return;
    }
    fetchDiagrams();
  }, []);

  async function fetchDiagrams() {
    if (token === "demo-token") {
      const demoData = localStorage.getItem("demo-diagrams");
      setDiagrams(demoData ? JSON.parse(demoData) : []);
      return;
    }

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

  // Helper helpers for creating mock elements in Demo mode
  function createRect(id, x, y, width, height, label, strokeColor = "#ffffff") {
    const rect = {
      id,
      type: "rectangle",
      x,
      y,
      width,
      height,
      strokeColor,
      backgroundColor: "transparent",
      fillStyle: "hachure",
      strokeWidth: 1.5,
      strokeStyle: "solid",
      roughness: 1,
      opacity: 100,
      angle: 0,
      isDeleted: false,
    };
    
    if (!label) return [rect];

    const textId = `${id}-text`;
    const text = {
      id: textId,
      type: "text",
      x: x + 10,
      y: y + (height - 36) / 2,
      width: width - 20,
      height: 36,
      strokeColor: "#ffffff",
      backgroundColor: "transparent",
      fillStyle: "hachure",
      strokeWidth: 1,
      strokeStyle: "solid",
      roughness: 0,
      opacity: 100,
      angle: 0,
      isDeleted: false,
      text: label,
      fontSize: 14,
      fontFamily: 3, // monospace
      textAlign: "center",
      verticalAlign: "middle",
    };
    
    return [rect, text];
  }

  function createArrow(id, startX, startY, endX, endY, label = "") {
    const arrow = {
      id,
      type: "arrow",
      x: startX,
      y: startY,
      width: Math.abs(endX - startX),
      height: Math.abs(endY - startY),
      strokeColor: "#888888",
      backgroundColor: "transparent",
      fillStyle: "hachure",
      strokeWidth: 1.5,
      strokeStyle: "solid",
      roughness: 1,
      opacity: 100,
      angle: 0,
      isDeleted: false,
      points: [[0, 0], [endX - startX, endY - startY]],
    };
    if (!label) return [arrow];
    
    const text = {
      id: `${id}-text`,
      type: "text",
      x: startX + (endX - startX) / 2 - 80,
      y: startY + (endY - startY) / 2 - 10,
      width: 160,
      height: 20,
      strokeColor: "#888888",
      backgroundColor: "transparent",
      fillStyle: "hachure",
      strokeWidth: 1,
      strokeStyle: "solid",
      roughness: 0,
      opacity: 100,
      angle: 0,
      isDeleted: false,
      text: label,
      fontSize: 11,
      fontFamily: 3, // monospace
      textAlign: "center",
      verticalAlign: "middle",
    };
    return [arrow, text];
  }

  function generateMockDiagramElements(promptText) {
    let els = [];
    const accentColor = "#CBFF2F";
    const blueColor = "#61dafb";
    const greenColor = "#39d353";
    const purpleColor = "#a371f7";
    
    // User box
    els.push(...createRect("el-user", 100, 200, 100, 100, "User", "#ffffff"));
    
    // React Frontend
    els.push(...createRect("el-frontend", 300, 200, 160, 100, "React Frontend\n(Vite)", blueColor));
    
    // FastAPI Backend
    els.push(...createRect("el-backend", 580, 200, 160, 100, "FastAPI Backend", greenColor));
    
    // Database (Postgres)
    els.push(...createRect("el-db", 580, 50, 160, 80, "Database\n(PostgreSQL)", purpleColor));
    
    // LLM Service
    els.push(...createRect("el-llm", 580, 370, 160, 80, "LLM Service\n(OpenAI / Groq)", accentColor));
    
    // Excalidraw Canvas
    els.push(...createRect("el-canvas", 300, 370, 160, 80, "Excalidraw Canvas", "#ffffff"));

    // User -> Frontend
    els.push(...createArrow("arr-u-f", 200, 250, 300, 250));
    // Frontend -> Backend
    els.push(...createArrow("arr-f-b", 460, 250, 580, 250, "/api/v1/diagrams/stream\n(SSE)"));
    // Frontend -> Excalidraw
    els.push(...createArrow("arr-f-c", 380, 300, 380, 370, "Render"));
    // Backend -> DB
    els.push(...createArrow("arr-b-db", 660, 200, 660, 130));
    // Backend -> LLM
    els.push(...createArrow("arr-b-llm", 660, 300, 660, 370));
    // Backend -> Excalidraw
    els.push(...createArrow("arr-b-c", 580, 270, 460, 370, "Stream JSON"));

    return els;
  }

  function handleGenerate() {
    if (!prompt.trim() || status === "streaming") return;
    setStatus("streaming");

    // Demo Mode Handler
    if (token === "demo-token") {
      setTimeout(() => {
        const mockElements = generateMockDiagramElements(prompt);
        const api = excalidrawAPIRef.current;
        if (api) {
          applyElements(api, mockElements);
        } else {
          pendingRef.current = mockElements;
          setHasContent(true);
        }
        
        const newDiagram = {
          id: "demo-" + Date.now(),
          title: prompt,
          created_at: new Date().toISOString(),
          excalidraw_data: { elements: mockElements },
          llm_model: "cached"
        };
        
        const currentDemoList = localStorage.getItem("demo-diagrams");
        const parsedList = currentDemoList ? JSON.parse(currentDemoList) : [];
        const updatedList = [newDiagram, ...parsedList];
        
        localStorage.setItem("demo-diagrams", JSON.stringify(updatedList));
        setDiagrams(updatedList);
        setActiveDiagramId(newDiagram.id);
        setStatus("done");
      }, 2000);
      return;
    }

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
    <div style={{ display: "flex", height: "100vh", background: "#06060B", overflow: "hidden" }}>

      {/* ── Left Sidebar ── */}
      <div className="sidebar" style={{ background: "#0A0A0E", borderRight: "1px solid #1C1C2E" }}>

        {/* Brand header */}
        <div style={{ padding: "24px 20px 16px" }}>
          <h1 className="mono" style={{
            color: "var(--accent)",
            fontSize: "18px",
            fontWeight: "700",
            letterSpacing: "-0.02em",
            marginBottom: "6px"
          }}>
            $ ai-diagram-studio
          </h1>
          <p className="mono" style={{
            color: "var(--text-secondary)",
            fontSize: "12px",
            opacity: 0.8
          }}>
            {user.email || "demo@studio.ai"}
          </p>
        </div>

        <hr className="divider" style={{ borderTop: "1px solid #1C1C2E", margin: "0 20px" }} />

        {/* Prompt input section */}
        <div style={{ padding: "20px" }}>
          <label className="field-label" style={{ fontSize: "11px", letterSpacing: "0.05em", color: "var(--text-secondary)", marginBottom: "8px" }}>
            Describe your diagram
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Create a system architecture diagram for an AI Diagram Studio app. Show React frontend talking to FastAPI backend with SSE streaming and Excalidraw rendering."
            rows={5}
            className="textarea-field"
            style={{
              borderColor: "var(--accent)",
              background: "#0D0D12",
              color: "#ffffff",
              fontSize: "13px",
              fontFamily: "var(--font-mono, monospace)",
              lineHeight: "1.6",
              borderRadius: "4px"
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate();
            }}
          />

          <button
            onClick={handleGenerate}
            disabled={status === "streaming" || !prompt.trim()}
            className="btn-primary"
            style={{
              marginTop: "14px",
              background: "var(--accent)",
              color: "#000000",
              fontWeight: "600",
              borderRadius: "4px",
              padding: "10px",
              fontSize: "14px",
              letterSpacing: "0.02em",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            {status === "streaming" ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                Generating
                <span className="loading-dots"><span></span><span></span><span></span></span>
              </span>
            ) : (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                <span style={{ fontSize: "14px", lineHeight: "1" }}>▷</span> Generate
              </span>
            )}
          </button>

          {/* Status indicators */}
          {status === "streaming" && (
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              marginTop: "16px",
              padding: "4px 0"
            }} className="animate-fade-in">
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--accent)", fontSize: "12px", fontFamily: "var(--font-mono, monospace)" }}>
                <span className="status-dot streaming" style={{ width: "8px", height: "8px" }}></span>
                Streaming diagram...
              </div>
              <div style={{ color: "var(--text-secondary)", fontSize: "11px", paddingLeft: "16px" }}>
                Receiving data from model...
              </div>
            </div>
          )}
          {status === "error" && (
            <div style={{
              marginTop: "16px",
              color: "var(--error)",
              fontSize: "12px",
              fontFamily: "var(--font-mono, monospace)",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }} className="animate-fade-in">
              <span className="status-dot error"></span>
              generation failed — try again
            </div>
          )}
          {status === "done" && (
            <div style={{
              marginTop: "16px",
              color: "var(--success)",
              fontSize: "12px",
              fontFamily: "var(--font-mono, monospace)",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }} className="animate-fade-in">
              <span className="status-dot done"></span>
              diagram generated ✓
            </div>
          )}
        </div>

        <hr className="divider" style={{ borderTop: "1px solid #1C1C2E", margin: "0 20px" }} />

        {/* Diagram history */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 12px" }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 8px",
            marginBottom: "12px",
          }}>
            <label className="field-label" style={{ margin: 0, fontSize: "11px", letterSpacing: "0.05em", color: "var(--text-secondary)" }}>
              Your Diagrams
            </label>
          </div>

          {diagrams.length === 0 && (
            <div style={{
              padding: "40px 16px",
              textAlign: "center",
            }}>
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
              className={`history-item ${activeDiagramId === d.id ? "active" : ""}`}
              style={{
                borderRadius: "4px"
              }}
            >
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", width: "100%" }}>
                {/* File Icon */}
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginTop: "2px", flexShrink: 0, opacity: 0.7 }}>
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: "13px",
                    color: activeDiagramId === d.id ? "var(--text)" : "var(--text-secondary)",
                    fontWeight: "500",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    margin: 0
                  }}>
                    {d.title}
                  </p>
                  <p className="mono" style={{ fontSize: "10px", color: "var(--muted)", marginTop: "4px", margin: 0 }}>
                    {formatDate(d.created_at)}
                  </p>
                </div>

                <span style={{ color: "var(--muted)", fontSize: "12px", alignSelf: "center", paddingRight: "4px" }}>&gt;</span>
              </div>
            </div>
          ))}
        </div>

        {/* Logout */}
        <div style={{ padding: "16px 20px", borderTop: "1px solid #1C1C2E" }}>
          <button
            onClick={handleLogout}
            className="btn-ghost"
            style={{
              border: "1px solid var(--accent)",
              color: "var(--accent)",
              borderRadius: "4px",
              padding: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              fontSize: "13px",
              fontWeight: "500",
              background: "transparent"
            }}
          >
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
      <div className="excalidraw-wrapper">

        {/* Empty state overlay — pointer-events:none so it never blocks the canvas */}
        {!hasContent && (
          <div className="empty-state" style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "40px 20px",
            zIndex: 3,
            pointerEvents: "none",
          }}>
            {/* Faded background diagram (User -> React -> FastAPI -> Postgres/LLM) */}
            <div style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              maxWidth: "900px",
              opacity: 0.12,
            }}>
              <svg width="100%" height="100%" viewBox="0 0 900 500" fill="none" stroke="currentColor" strokeWidth="1.5">
                {/* Node: User */}
                <rect x="50" y="160" width="110" height="110" rx="8" stroke="var(--text)" />
                <circle cx="105" cy="205" r="16" stroke="var(--text)" />
                <path d="M85 245c0-12 8-16 20-16s20 4 20 16" stroke="var(--text)" />
                <text x="105" y="255" fill="var(--text)" fontSize="13" textAnchor="middle" fontFamily="Space Grotesk, sans-serif">User</text>

                {/* Arrow: User -> Frontend */}
                <path d="M160 215h70" stroke="var(--text)" markerEnd="url(#arrow)" />

                {/* Node: React Frontend */}
                <rect x="230" y="160" width="160" height="110" rx="8" stroke="var(--text)" />
                <text x="310" y="195" fill="var(--text)" fontSize="13" fontWeight="bold" textAnchor="middle" fontFamily="Space Grotesk, sans-serif">React Frontend</text>
                <text x="310" y="215" fill="var(--text)" fontSize="11" textAnchor="middle" fontFamily="JetBrains Mono, monospace">(Vite)</text>
                {/* React logo shape */}
                <ellipse cx="310" cy="242" rx="15" ry="6" stroke="var(--text)" transform="rotate(30 310 242)" />
                <ellipse cx="310" cy="242" rx="15" ry="6" stroke="var(--text)" transform="rotate(90 310 242)" />
                <ellipse cx="310" cy="242" rx="15" ry="6" stroke="var(--text)" transform="rotate(150 310 242)" />
                <circle cx="310" cy="242" r="2" fill="var(--text)" />

                {/* Arrow: Frontend -> Backend */}
                <path d="M390 215h190" stroke="var(--text)" markerEnd="url(#arrow)" />
                <text x="485" y="198" fill="var(--text)" fontSize="10" textAnchor="middle" fontFamily="JetBrains Mono, monospace">/api/v1/diagrams/stream</text>
                <text x="485" y="212" fill="var(--text)" fontSize="9" textAnchor="middle" fontFamily="JetBrains Mono, monospace">(SSE)</text>

                {/* Node: FastAPI Backend */}
                <rect x="580" y="160" width="160" height="110" rx="8" stroke="var(--text)" />
                <text x="660" y="195" fill="var(--text)" fontSize="13" fontWeight="bold" textAnchor="middle" fontFamily="Space Grotesk, sans-serif">FastAPI Backend</text>
                {/* FastAPI lightning bolt logo */}
                <path d="M655 215l10 15h-8l5 15-12-18h8z" stroke="var(--text)" fill="var(--text)" />

                {/* Arrow: Backend -> DB */}
                <path d="M660 160v-60" stroke="var(--text)" markerEnd="url(#arrow)" markerStart="url(#arrow-start)" />

                {/* Node: Database (Postgres) */}
                <rect x="580" y="20" width="160" height="80" rx="8" stroke="var(--text)" />
                {/* DB cylinder lines */}
                <ellipse cx="660" cy="45" rx="20" ry="6" stroke="var(--text)" />
                <path d="M640 45v15c0 3 9 6 20 6s20-3 20-6V45" stroke="var(--text)" />
                <path d="M640 60v15c0 3 9 6 20 6s20-3 20-6V60" stroke="var(--text)" />
                <text x="660" y="90" fill="var(--text)" fontSize="11" textAnchor="middle" fontFamily="Space Grotesk, sans-serif">Database (Postgres)</text>

                {/* Arrow: Backend -> LLM */}
                <path d="M660 270v90" stroke="var(--text)" strokeDasharray="4 4" markerEnd="url(#arrow)" />

                {/* Node: LLM Service */}
                <rect x="580" y="360" width="160" height="80" rx="8" stroke="var(--text)" />
                <text x="660" y="395" fill="var(--text)" fontSize="13" fontWeight="bold" textAnchor="middle" fontFamily="Space Grotesk, sans-serif">LLM Service</text>
                <text x="660" y="415" fill="var(--text)" fontSize="10" textAnchor="middle" fontFamily="Space Grotesk, sans-serif">(OpenAI / Groq)</text>

                {/* Arrow: Backend -> Excalidraw */}
                <path d="M620 270v90h-180" stroke="var(--text)" strokeDasharray="4 4" markerEnd="url(#arrow)" />
                <text x="530" y="348" fill="var(--text)" fontSize="10" textAnchor="middle" fontFamily="JetBrains Mono, monospace">Stream JSON Chunks</text>

                {/* Arrow: Frontend -> Excalidraw */}
                <path d="M310 270v90" stroke="var(--text)" strokeDasharray="4 4" markerEnd="url(#arrow)" />
                <text x="345" y="315" fill="var(--text)" fontSize="11" textAnchor="middle" fontFamily="Space Grotesk, sans-serif">Render</text>

                {/* Node: Excalidraw Canvas */}
                <rect x="230" y="360" width="160" height="80" rx="8" stroke="var(--text)" />
                <text x="310" y="395" fill="var(--text)" fontSize="13" fontWeight="bold" textAnchor="middle" fontFamily="Space Grotesk, sans-serif">Excalidraw Canvas</text>

                {/* SVG Marker Definitions */}
                <defs>
                  <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M0 0l10 5-10 5z" fill="var(--text)" />
                  </marker>
                  <marker id="arrow-start" viewBox="0 0 10 10" refX="4" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M10 0L0 5l10 5z" fill="var(--text)" />
                  </marker>
                </defs>
              </svg>
            </div>

            {/* Bottom instruction block */}
            <div style={{
              background: "rgba(6, 6, 11, 0.95)",
              border: "1.5px dashed var(--accent)",
              borderRadius: "4px",
              padding: "16px 24px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              width: "100%",
              maxWidth: "680px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
              marginBottom: "12px"
            }}>
              <span style={{ fontSize: "18px", color: "var(--accent)" }}>💡</span>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <p style={{ color: "var(--text)", fontSize: "13px", fontWeight: "500", margin: 0, fontFamily: "Space Grotesk, sans-serif" }}>
                  Start by describing your diagram on the left and click Generate.
                </p>
                <p style={{ color: "var(--text-secondary)", fontSize: "11px", margin: 0, opacity: 0.8, fontFamily: "var(--font-mono, monospace)" }}>
                  Your diagram will appear here.
                </p>
              </div>
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
              isLoading: false,
            },
          }}
          UIOptions={{
            welcomeScreen: false,
            canvasActions: {
              export: false,
              loadScene: false,
              saveToActiveFile: false,
              toggleTheme: false,
              saveAsImage: false,
            },
          }}
          renderTopRightUI={() => null}
        />
      </div>
    </div>
  );
}