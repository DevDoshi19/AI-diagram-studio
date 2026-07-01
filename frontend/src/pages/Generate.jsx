import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { parseMermaidToExcalidraw } from "@excalidraw/mermaid-to-excalidraw";
import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import mermaid from "mermaid";

// Initialize Mermaid
mermaid.initialize({
  theme: "dark",
  themeVariables: {
    background: "#06060B",
    primaryColor: "#CBFF2F",
    primaryTextColor: "#E8E8F0",
    primaryBorderColor: "#1C1C2E",
    lineColor: "#55557A",
    secondaryColor: "#13131A",
    tertiaryColor: "#0A0A0E",
  },
  flowchart: {
    useMaxWidth: true,
    htmlLabels: true,
  },
});

export default function Generate() {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState("idle");
  const [diagrams, setDiagrams] = useState([]);
  const [hasContent, setHasContent] = useState(false);
  const [activeDiagramId, setActiveDiagramId] = useState(null);
  const [mermaidCode, setMermaidCode] = useState("");
  const [parseError, setParseError] = useState(null);
  const [showMermaidBox, setShowMermaidBox] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState("mermaid"); // "mermaid" | "excalidraw"
  const [mermaidSvg, setMermaidSvg] = useState("");

  const navigate = useNavigate();
  const excalidrawAPIRef = useRef(null);
  const pendingElementsRef = useRef(null);

  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  // ── Fetch history ──
  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }
    fetchDiagrams();
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
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

  // ── Render Mermaid SVG ──
  useEffect(() => {
    if (!mermaidCode.trim()) {
      setMermaidSvg("");
      return;
    }
    const renderMermaid = async () => {
      try {
        // Clean code (remove fences if any)
        let clean = mermaidCode;
        if (clean.includes("```mermaid")) {
          const match = clean.match(/```mermaid\n([\s\S]*?)\n```/);
          if (match) clean = match[1];
        } else if (clean.includes("```")) {
          const match = clean.match(/```([\s\S]*?)```/);
          if (match) clean = match[1];
        }
        clean = clean.trim();

        const { svg } = await mermaid.render("mermaid-diagram", clean);
        setMermaidSvg(svg);
      } catch (err) {
        console.error("Mermaid render error:", err);
        setMermaidSvg(`<div style="color: var(--error); padding: 20px;">Failed to render Mermaid: ${err.message}</div>`);
      }
    };
    renderMermaid();
  }, [mermaidCode]);

  // ── Excalidraw mount ──
  const onExcalidrawMount = useCallback((api) => {
    excalidrawAPIRef.current = api;
    if (pendingElementsRef.current) {
      applyElements(api, pendingElementsRef.current);
      pendingElementsRef.current = null;
    }
  }, []);

  // ── Apply elements ──
  const applyElements = useCallback((api, elements) => {
    if (!api) {
      pendingElementsRef.current = elements;
      return;
    }
    if (!elements || elements.length === 0) return;

    const sanitized = elements.map((el) => {
      if (el.type === "arrow" || el.type === "line") {
        return { ...el, points: el.points || [[0, 0], [0, 50]] };
      }
      return el;
    });

    api.updateScene({
      elements: sanitized,
      appState: { viewBackgroundColor: "#06060B" },
    });
    setHasContent(true);
    setParseError(null);

    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          api.scrollToContent(sanitized, { fitToContent: true });
        } catch (_) {}
      }, 150);
    });
  }, []);

  // ── Mermaid parser ──
  async function mermaidToElements(code) {
    try {
      const { elements } = await parseMermaidToExcalidraw(code);
      if (!elements || elements.length === 0) throw new Error("No elements");
      return convertToExcalidrawElements(elements);
    } catch (err) {
      let cleaned = code;
      if (cleaned.includes("```mermaid")) {
        const match = cleaned.match(/```mermaid\n([\s\S]*?)\n```/);
        if (match) cleaned = match[1];
      } else if (cleaned.includes("```")) {
        const match = cleaned.match(/```([\s\S]*?)```/);
        if (match) cleaned = match[1];
      }
      cleaned = cleaned.trim();
      if (cleaned !== code) return mermaidToElements(cleaned);
      throw err;
    }
  }

  // ── Render Mermaid → Excalidraw ──
  async function renderMermaid(code) {
    try {
      const elements = await mermaidToElements(code);
      const api = excalidrawAPIRef.current;
      if (api) applyElements(api, elements);
      else pendingElementsRef.current = elements;
      setStatus("done");
      setParseError(null);
      return elements;
    } catch (err) {
      console.error("Render error:", err);
      setParseError(err.message);
      setStatus("error");
    }
  }

  // ── Generate (POST) ──
  async function handleGenerate() {
    if (!prompt.trim() || status === "streaming") return;
    setStatus("streaming");
    setHasContent(false);
    setParseError(null);
    setMermaidCode("");
    setSaveMessage("");

    if (token === "demo-token") {
      // Demo mock (keep existing)
      const mockElements = generateMockDiagramElements(prompt);
      const api = excalidrawAPIRef.current;
      if (api) applyElements(api, mockElements);
      else pendingElementsRef.current = mockElements;
      const newDiagram = {
        id: "demo-" + Date.now(),
        title: prompt,
        created_at: new Date().toISOString(),
        excalidraw_data: { elements: mockElements },
        llm_model: "cached",
      };
      const current = JSON.parse(localStorage.getItem("demo-diagrams") || "[]");
      const updated = [newDiagram, ...current];
      localStorage.setItem("demo-diagrams", JSON.stringify(updated));
      setDiagrams(updated);
      setActiveDiagramId(newDiagram.id);
      setStatus("done");
      // Set mermaid code for preview? We don't have mermaid in demo, but we'll use mock elements in Excalidraw.
      return;
    }

    try {
      const res = await fetch("/api/v1/diagrams/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Generation failed");
      }
      const data = await res.json();
      const mermaid = data.excalidraw_data?.mermaid;
      if (!mermaid) throw new Error("No Mermaid code returned");
      setMermaidCode(mermaid);
      setActiveDiagramId(data.id);
      // Render to Excalidraw automatically
      await renderMermaid(mermaid);
      await fetchDiagrams();
      // Switch to Excalidraw tab after generation (optional)
      setActiveTab("excalidraw");
    } catch (err) {
      console.error(err);
      setParseError(err.message);
      setStatus("error");
    }
  }

  // ── Manual render (from Mermaid editor) ──
  async function handleManualRender() {
    if (!mermaidCode.trim()) return;
    await renderMermaid(mermaidCode);
    setActiveTab("excalidraw");
  }

  // ── Save current canvas ──
  async function handleSaveDiagram() {
    // ... (same as before)
    if (!activeDiagramId || token === "demo-token") {
      setSaveMessage("Cannot save demo diagram");
      return;
    }
    const api = excalidrawAPIRef.current;
    if (!api) {
      setSaveMessage("Excalidraw not ready");
      return;
    }
    const scene = api.getSceneElements();
    if (!scene || scene.length === 0) {
      setSaveMessage("No elements to save");
      return;
    }

    setIsSaving(true);
    setSaveMessage("");
    try {
      const res = await fetch(`/api/v1/diagrams/${activeDiagramId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          excalidraw_data: { elements: scene, mermaid: mermaidCode },
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setSaveMessage("✅ Diagram saved!");
      await fetchDiagrams();
    } catch (err) {
      console.error(err);
      setSaveMessage("❌ Save failed: " + err.message);
    } finally {
      setIsSaving(false);
    }
  }

  // ── Delete diagram ──
  async function handleDeleteDiagram(id) {
    // ... (same as before)
    if (token === "demo-token") {
      const updated = diagrams.filter((d) => d.id !== id);
      localStorage.setItem("demo-diagrams", JSON.stringify(updated));
      setDiagrams(updated);
      if (activeDiagramId === id) {
        setActiveDiagramId(null);
        setHasContent(false);
        const api = excalidrawAPIRef.current;
        if (api) api.updateScene({ elements: [] });
      }
      return;
    }
    try {
      const res = await fetch(`/api/v1/diagrams/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Delete failed");
      await fetchDiagrams();
      if (activeDiagramId === id) {
        setActiveDiagramId(null);
        setHasContent(false);
        const api = excalidrawAPIRef.current;
        if (api) api.updateScene({ elements: [] });
      }
    } catch (err) {
      console.error(err);
      alert("Could not delete diagram");
    }
  }

  // ── Load saved diagram ──
  function loadDiagram(d) {
    setActiveDiagramId(d.id);
    const data = d.excalidraw_data;
    let elements = data?.elements;
    if (elements && elements.length > 0) {
      const api = excalidrawAPIRef.current;
      if (api) applyElements(api, elements);
      else pendingElementsRef.current = elements;
      setHasContent(true);
      setMermaidCode(data?.mermaid || "");
      setActiveTab("excalidraw");
      return;
    }
    if (data?.mermaid) {
      setMermaidCode(data.mermaid);
      setActiveTab("mermaid");
      // Optionally render to Excalidraw too?
      renderMermaid(data.mermaid);
    }
  }

  // ── Mock generator ── (unchanged)
  function generateMockDiagramElements(promptText) {
    const rect = (id, x, y, w, h, label, color = "#ffffff") => ({
      id,
      type: "rectangle",
      x,
      y,
      width: w,
      height: h,
      angle: 0,
      strokeColor: color,
      backgroundColor: "transparent",
      fillStyle: "hachure",
      strokeWidth: 1.5,
      strokeStyle: "solid",
      roughness: 1,
      opacity: 100,
      seed: Math.floor(Math.random() * 1000000),
      version: 1,
      versionNonce: Math.floor(Math.random() * 1000000),
      isDeleted: false,
      boundElements: null,
      updated: Date.now(),
      link: null,
      locked: false,
      groupIds: [],
      frameId: null,
      roundness: null,
    });
    const textEl = (id, x, y, content, color = "#ffffff", size = 14) => ({
      id,
      type: "text",
      x,
      y,
      width: 200,
      height: 30,
      angle: 0,
      strokeColor: color,
      backgroundColor: "transparent",
      fillStyle: "hachure",
      strokeWidth: 1.5,
      strokeStyle: "solid",
      roughness: 1,
      opacity: 100,
      seed: Math.floor(Math.random() * 1000000),
      version: 1,
      versionNonce: Math.floor(Math.random() * 1000000),
      isDeleted: false,
      boundElements: null,
      updated: Date.now(),
      link: null,
      locked: false,
      groupIds: [],
      frameId: null,
      roundness: null,
      text: content,
      fontSize: size,
      fontFamily: 3,
      textAlign: "center",
      verticalAlign: "middle",
      baseline: 15,
      containerId: null,
      originalText: content,
    });
    const arrow = (id, startX, startY, endX, endY, label = "") => {
      const pts = [[0, 0], [endX - startX, endY - startY]];
      const a = {
        id,
        type: "arrow",
        x: startX,
        y: startY,
        width: Math.abs(endX - startX),
        height: Math.abs(endY - startY),
        angle: 0,
        strokeColor: "#888888",
        backgroundColor: "transparent",
        fillStyle: "hachure",
        strokeWidth: 1.5,
        strokeStyle: "solid",
        roughness: 1,
        opacity: 100,
        seed: Math.floor(Math.random() * 1000000),
        version: 1,
        versionNonce: Math.floor(Math.random() * 1000000),
        isDeleted: false,
        boundElements: null,
        updated: Date.now(),
        link: null,
        locked: false,
        groupIds: [],
        frameId: null,
        roundness: null,
        points: pts,
        lastCommittedPoint: null,
        startBinding: null,
        endBinding: null,
        startArrowhead: null,
        endArrowhead: "arrow",
      };
      if (!label) return [a];
      const t = textEl(`${id}-text`, startX + (endX - startX) / 2 - 80, startY + (endY - startY) / 2 - 10, label, "#888888", 11);
      return [a, t];
    };
    const accent = "#CBFF2F",
      blue = "#61dafb",
      green = "#39d353",
      purple = "#a371f7";
    let elements = [];
    elements.push(rect("user", 100, 200, 100, 100, "", "#ffffff"));
    elements.push(textEl("user-label", 150, 240, "User"));
    elements.push(rect("frontend", 300, 200, 160, 100, "", blue));
    elements.push(textEl("frontend-label", 380, 230, "React Frontend (Vite)", blue));
    elements.push(rect("backend", 580, 200, 160, 100, "", green));
    elements.push(textEl("backend-label", 660, 230, "FastAPI Backend", green));
    elements.push(rect("db", 580, 50, 160, 80, "", purple));
    elements.push(textEl("db-label", 660, 80, "PostgreSQL", purple));
    elements.push(rect("llm", 580, 370, 160, 80, "", accent));
    elements.push(textEl("llm-label", 660, 400, "LLM Service", accent));
    elements.push(rect("canvas", 300, 370, 160, 80, "", "#ffffff"));
    elements.push(textEl("canvas-label", 380, 400, "Excalidraw Canvas"));
    elements.push(...arrow("arr1", 200, 250, 300, 250));
    elements.push(...arrow("arr2", 460, 250, 580, 250, "/api/v1/stream"));
    elements.push(...arrow("arr3", 380, 300, 380, 370, "Render"));
    elements.push(...arrow("arr4", 660, 200, 660, 130));
    elements.push(...arrow("arr5", 660, 300, 660, 370));
    elements.push(...arrow("arr6", 580, 270, 460, 370, "Stream JSON"));
    return elements;
  }

  // ── Logout ──
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

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const toggleFullscreen = () => {
    const el = document.querySelector(".excalidraw-wrapper");
    if (!document.fullscreenElement) {
      el?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: "#06060B", overflow: "hidden" }}>
      {/* Mobile sidebar toggle */}
      <button
        onClick={toggleSidebar}
        className="sidebar-toggle-btn"
        style={{
          position: "fixed",
          top: "12px",
          left: "12px",
          zIndex: 100,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "4px",
          color: "var(--text)",
          padding: "6px 10px",
          cursor: "pointer",
          display: "none",
          fontSize: "18px",
        }}
      >
        {sidebarOpen ? "✕" : "☰"}
      </button>

      {/* ── LEFT SIDEBAR ── */}
      <div
        className={`sidebar ${sidebarOpen ? "open" : ""}`}
        style={{
          width: "280px",
          flexShrink: 0,
          background: "#0A0A0E",
          borderRight: "1px solid #1C1C2E",
          display: "flex",
          flexDirection: "column",
          transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
          position: "relative",
          zIndex: 10,
        }}
      >
        {/* ... sidebar content (prompt, status, mermaid box, history, logout) - same as before */}
        <div style={{ padding: "24px 20px 16px" }}>
          <h1 className="mono" style={{ color: "var(--accent)", fontSize: "18px", fontWeight: "700", letterSpacing: "-0.02em", marginBottom: "6px" }}>
            $ ai-diagram-studio
          </h1>
          <p className="mono" style={{ color: "var(--text-secondary)", fontSize: "12px", opacity: 0.8 }}>
            {user.email || "demo@studio.ai"}
          </p>
        </div>

        <hr className="divider" style={{ borderTop: "1px solid #1C1C2E", margin: "0 20px" }} />

        <div style={{ padding: "20px" }}>
          <label className="field-label" style={{ fontSize: "11px", letterSpacing: "0.05em", color: "var(--text-secondary)", marginBottom: "8px" }}>
            Describe your diagram
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Create a system architecture diagram..."
            rows={5}
            className="textarea-field"
            style={{
              borderColor: "var(--accent)",
              background: "#0D0D12",
              color: "#ffffff",
              fontSize: "13px",
              fontFamily: "var(--font-mono, monospace)",
              lineHeight: "1.6",
              borderRadius: "4px",
              width: "100%",
              resize: "none",
              outline: "none",
              padding: "12px 14px",
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
              justifyContent: "center",
              width: "100%",
              border: "none",
              cursor: "pointer",
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

          {status === "streaming" && (
            <div className="status-bar status-streaming" style={{ marginTop: "16px" }}>
              <span className="status-dot streaming"></span> Generating...
            </div>
          )}
          {status === "error" && (
            <div className="status-bar status-error" style={{ marginTop: "16px" }}>
              <span className="status-dot error"></span> {parseError || "Generation failed"}
            </div>
          )}
          {status === "done" && (
            <div className="status-bar status-done" style={{ marginTop: "16px" }}>
              <span className="status-dot done"></span> Diagram generated ✓
            </div>
          )}
        </div>

        <hr className="divider" style={{ borderTop: "1px solid #1C1C2E", margin: "0 20px" }} />

        {/* Mermaid editor (collapsible) */}
        <div style={{ padding: "0 20px 12px" }}>
          <button
            onClick={() => setShowMermaidBox(!showMermaidBox)}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-secondary)",
              fontSize: "11px",
              fontFamily: "var(--font-mono, monospace)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 0",
            }}
          >
            {showMermaidBox ? "▼" : "▶"} Mermaid Code Editor
          </button>
          {showMermaidBox && (
            <div style={{ marginTop: "8px" }}>
              <textarea
                value={mermaidCode}
                onChange={(e) => setMermaidCode(e.target.value)}
                rows={6}
                className="textarea-field"
                style={{
                  width: "100%",
                  background: "#0D0D12",
                  color: "#E8E8F0",
                  fontSize: "11px",
                  fontFamily: "monospace",
                  resize: "vertical",
                  borderRadius: "4px",
                  border: "1px solid var(--border)",
                  padding: "8px",
                }}
                placeholder="Mermaid code will appear here"
              />
              <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
                <button
                  onClick={handleManualRender}
                  className="btn-primary"
                  style={{
                    flex: 1,
                    background: "var(--accent)",
                    color: "#000",
                    border: "none",
                    padding: "6px 12px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  Render to Excalidraw
                </button>
                {activeDiagramId && token !== "demo-token" && (
                  <button
                    onClick={handleSaveDiagram}
                    disabled={isSaving}
                    style={{
                      flex: 1,
                      background: "var(--text-secondary)",
                      color: "#000",
                      border: "none",
                      padding: "6px 12px",
                      borderRadius: "4px",
                      fontSize: "12px",
                      cursor: "pointer",
                      opacity: isSaving ? 0.6 : 1,
                    }}
                  >
                    {isSaving ? "Saving..." : "💾 Save"}
                  </button>
                )}
              </div>
              {saveMessage && (
                <div style={{ marginTop: "6px", fontSize: "11px", color: saveMessage.includes("failed") ? "var(--error)" : "var(--success)" }}>
                  {saveMessage}
                </div>
              )}
            </div>
          )}
        </div>

        <hr className="divider" style={{ borderTop: "1px solid #1C1C2E", margin: "0 20px" }} />

        {/* History (same as before) */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 8px", marginBottom: "12px" }}>
            <label className="field-label" style={{ margin: 0, fontSize: "11px", letterSpacing: "0.05em", color: "var(--text-secondary)" }}>
              Your Diagrams
            </label>
            <span style={{ color: "var(--muted)", fontSize: "10px", fontFamily: "monospace" }}>{diagrams.length}</span>
          </div>
          {diagrams.length === 0 && (
            <div style={{ padding: "40px 16px", textAlign: "center" }}>
              <p style={{ color: "var(--muted)", fontSize: "12px", lineHeight: "1.6" }}>
                No diagrams yet.<br />
                <span style={{ fontSize: "11px" }}>Generate your first one above!</span>
              </p>
            </div>
          )}
          {diagrams.map((d, index) => {
            const colors = ["#CBFF2F", "#61dafb", "#ff6b6b", "#a371f7", "#ffd93d", "#6bcb77"];
            const color = colors[index % colors.length];
            return (
              <div
                key={d.id}
                onClick={() => loadDiagram(d)}
                className={`history-item ${activeDiagramId === d.id ? "active" : ""}`}
                style={{
                  padding: "12px 14px",
                  marginBottom: "6px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                  background: activeDiagramId === d.id ? `rgba(203, 255, 47, 0.06)` : "transparent",
                  border: `1px solid ${activeDiagramId === d.id ? color : "transparent"}`,
                  boxShadow: activeDiagramId === d.id ? `0 0 20px ${color}22` : "none",
                  transform: activeDiagramId === d.id ? "scale(1.02)" : "scale(1)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  className="hover-glow"
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: `radial-gradient(circle at 100% 50%, ${color}11, transparent 70%)`,
                    opacity: 0,
                    transition: "opacity 0.3s",
                    pointerEvents: "none",
                  }}
                />
                <div style={{ display: "flex", gap: "12px", alignItems: "center", width: "100%" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" style={{ flexShrink: 0, opacity: 0.8 }}>
                    <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" />
                    <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" />
                    <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" />
                    <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" />
                    <line x1="10" y1="6.5" x2="14" y2="6.5" stroke="currentColor" />
                    <line x1="6.5" y1="10" x2="6.5" y2="14" stroke="currentColor" />
                    <line x1="17.5" y1="10" x2="17.5" y2="14" stroke="currentColor" />
                    <line x1="10" y1="17.5" x2="14" y2="17.5" stroke="currentColor" />
                  </svg>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "13px", color: activeDiagramId === d.id ? "var(--text)" : "var(--text-secondary)", fontWeight: "500", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", margin: 0, letterSpacing: "-0.01em" }}>
                      {d.title}
                    </p>
                    <p className="mono" style={{ fontSize: "10px", color: "var(--muted)", margin: 0, marginTop: "2px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <span>{formatDate(d.created_at)}</span>
                      <span style={{ opacity: 0.3 }}>·</span>
                      <span>{d.llm_model || "ai"}</span>
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Delete this diagram?")) handleDeleteDiagram(d.id);
                    }}
                    className="delete-btn"
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--muted)",
                      cursor: "pointer",
                      padding: "4px",
                      borderRadius: "4px",
                      fontSize: "16px",
                      opacity: 0,
                      transition: "opacity 0.2s",
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                  <span style={{ color: "var(--muted)", fontSize: "12px", opacity: 0.4 }}>›</span>
                </div>
              </div>
            );
          })}
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
              background: "transparent",
              cursor: "pointer",
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

      {/* ── RIGHT PANEL (Tabbed: Mermaid | Excalidraw) ── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          background: "#06060B",
          height: "100vh",
          overflow: "hidden",
        }}
      >
        {/* Tab bar */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--border)",
            background: "var(--surface)",
            padding: "0 20px",
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => setActiveTab("mermaid")}
            style={{
              padding: "12px 20px",
              background: "none",
              border: "none",
              color: activeTab === "mermaid" ? "var(--accent)" : "var(--text-secondary)",
              fontSize: "13px",
              fontWeight: activeTab === "mermaid" ? "600" : "400",
              fontFamily: "var(--font-mono, monospace)",
              cursor: "pointer",
              borderBottom: activeTab === "mermaid" ? "2px solid var(--accent)" : "2px solid transparent",
              transition: "all 0.2s",
            }}
          >
            📐 Mermaid Diagram
          </button>
          <button
            onClick={() => setActiveTab("excalidraw")}
            style={{
              padding: "12px 20px",
              background: "none",
              border: "none",
              color: activeTab === "excalidraw" ? "var(--accent)" : "var(--text-secondary)",
              fontSize: "13px",
              fontWeight: activeTab === "excalidraw" ? "600" : "400",
              fontFamily: "var(--font-mono, monospace)",
              cursor: "pointer",
              borderBottom: activeTab === "excalidraw" ? "2px solid var(--accent)" : "2px solid transparent",
              transition: "all 0.2s",
            }}
          >
            ✏️ Excalidraw Canvas
          </button>
          <div style={{ flex: 1 }} />
          {/* Fullscreen button */}
          <button
            onClick={toggleFullscreen}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-secondary)",
              padding: "12px 16px",
              cursor: "pointer",
              fontSize: "16px",
            }}
            title="Toggle Fullscreen"
          >
            ⛶
          </button>
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          {/* Mermaid Tab */}
          <div
            style={{
              display: activeTab === "mermaid" ? "block" : "none",
              height: "100%",
              overflow: "auto",
              padding: "20px",
              background: "#06060B",
            }}
          >
            {mermaidSvg ? (
              <div
                dangerouslySetInnerHTML={{ __html: mermaidSvg }}
                style={{
                  maxWidth: "100%",
                  background: "#06060B",
                  padding: "20px",
                  borderRadius: "4px",
                  border: "1px solid var(--border)",
                }}
              />
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  color: "var(--muted)",
                  fontSize: "14px",
                  fontFamily: "monospace",
                }}
              >
                {mermaidCode ? "Rendering Mermaid..." : "No Mermaid code yet. Generate a diagram to see it here."}
              </div>
            )}
          </div>

          {/* Excalidraw Tab */}
          <div
            className="excalidraw-wrapper"
            style={{
              display: activeTab === "excalidraw" ? "block" : "none",
              height: "100%",
              position: "relative",
            }}
          >
            {!hasContent && (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "40px 20px",
                  zIndex: 3,
                  pointerEvents: "none",
                }}
              >
                <div
                  style={{
                    background: "rgba(6, 6, 11, 0.95)",
                    border: "1.5px dashed var(--accent)",
                    borderRadius: "4px",
                    padding: "16px 24px",
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    maxWidth: "680px",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                  }}
                >
                  <span style={{ fontSize: "18px", color: "var(--accent)" }}>💡</span>
                  <div>
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
                appState: { viewBackgroundColor: "#06060B", isLoading: false },
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
      </div>

      {/* Responsive & Interaction Styles */}
      <style>{`
        @media (max-width: 768px) {
          .sidebar-toggle-btn {
            display: block !important;
          }
          .sidebar {
            position: fixed;
            top: 0;
            left: 0;
            bottom: 0;
            width: 280px !important;
            transform: translateX(-100%);
            transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            box-shadow: 2px 0 16px rgba(0,0,0,0.6);
            z-index: 20;
            background: #0A0A0E;
          }
          .sidebar.open {
            transform: translateX(0);
          }
          .sidebar-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.5);
            z-index: 15;
            display: none;
          }
          .sidebar-overlay.active {
            display: block;
          }
        }
        .history-item:hover .hover-glow {
          opacity: 1 !important;
        }
        .history-item:hover .delete-btn {
          opacity: 0.7 !important;
        }
        .history-item:hover .delete-btn:hover {
          opacity: 1 !important;
          color: var(--error);
        }
        /* Mermaid SVG styling */
        .excalidraw-wrapper .mermaid svg {
          max-width: 100%;
          height: auto;
        }
      `}</style>
      <div className={`sidebar-overlay ${sidebarOpen ? "active" : ""}`} onClick={toggleSidebar} />
    </div>
  );
}