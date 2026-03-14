import { useState, useEffect, useCallback } from "react";

const API = "/api/journal";
const AMBIENCES = ["forest", "ocean", "mountain"];

const AMBIENCE_META = {
  forest: { icon: "🌲", color: "#4a7c59" },
  ocean: { icon: "🌊", color: "#2e7da1" },
  mountain: { icon: "⛰️", color: "#7a6652" },
};

export default function App() {
  const [userId, setUserId] = useState("user_001");
  const [tab, setTab] = useState("write");
  const [ambience, setAmbience] = useState("forest");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [entries, setEntries] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [analyzingId, setAnalyzingId] = useState(null);
  const [insights, setInsights] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [streaming, setStreaming] = useState(false);

  const fetchEntries = useCallback(async () => {
    setLoadingEntries(true);
    try {
      setEntries(await (await fetch(`${API}/${userId}`)).json());
    } catch {
      setEntries([]);
    } finally {
      setLoadingEntries(false);
    }
  }, [userId]);

  const fetchInsights = useCallback(async () => {
    setLoadingInsights(true);
    try {
      setInsights(await (await fetch(`${API}/insights/${userId}`)).json());
    } catch {
      setInsights(null);
    } finally {
      setLoadingInsights(false);
    }
  }, [userId]);

  useEffect(() => {
    if (tab === "entries") fetchEntries();
    if (tab === "insights") fetchInsights();
  }, [tab, fetchEntries, fetchInsights]);

  async function handleSave() {
    if (!text.trim()) return;
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ambience, text }),
      });
      setSaveMsg(res.ok ? "saved" : "error");
      if (res.ok) setText("");
    } catch {
      setSaveMsg("error");
    } finally {
      setSaving(false);
    }
  }

  async function handleStreamAnalyze() {
    if (!text.trim()) return;
    setStreamText("");
    setStreaming(true);
    try {
      const res = await fetch(`${API}/analyze/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          if (line.startsWith("data:")) {
            try {
              const p = JSON.parse(line.slice(5).trim());
              if (p.text !== undefined) setStreamText((prev) => prev + p.text);
            } catch {
              /* skip */
            }
          }
        }
      }
    } catch (err) {
      setStreamText("Error: " + err.message);
    } finally {
      setStreaming(false);
    }
  }

  async function handleAnalyze(entryId) {
    setAnalyzingId(entryId);
    try {
      if ((await fetch(`${API}/analyze/${entryId}`, { method: "POST" })).ok)
        await fetchEntries();
    } finally {
      setAnalyzingId(null);
    }
  }

  function parseStreamResult() {
    if (!streamText) return null;
    try {
      return JSON.parse(
        streamText
          .trim()
          .replace(/^```json\s*/i, "")
          .replace(/```\s*$/i, "")
          .trim(),
      );
    } catch {
      return null;
    }
  }
  const streamResult = parseStreamResult();

  return (
    <div className="root">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-leaf">🌿</span>
          <div>
            <div className="brand-name">ArvyaX</div>
            <div className="brand-sub">Nature Journal</div>
          </div>
        </div>

        <div className="user-section">
          <div className="user-label">Journaling as</div>
          <input
            className="user-input"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="user_001"
          />
        </div>

        <nav className="sidenav">
          {[
            { id: "write", icon: "✏️", label: "Write" },
            { id: "entries", icon: "📖", label: "Entries" },
            { id: "insights", icon: "✨", label: "Insights" },
          ].map((t) => (
            <button
              key={t.id}
              className={`nav-item ${tab === t.id ? "nav-active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              <span className="nav-icon">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          "Every walk in nature is a step toward healing."
        </div>
      </aside>

      {/* Main content */}
      <main className="main">
        {/* ── WRITE TAB ── */}
        {tab === "write" && (
          <div className="content-area">
            <div className="page-header">
              <h1 className="page-title">Today's Entry</h1>
              <p className="page-sub">Capture your thoughts from the session</p>
            </div>

            <div className="card">
              <div className="ambience-picker">
                {AMBIENCES.map((a) => (
                  <button
                    key={a}
                    className={`ambience-chip ${ambience === a ? "ambience-active" : ""}`}
                    style={
                      ambience === a
                        ? {
                            background: AMBIENCE_META[a].color,
                            color: "#fff",
                            borderColor: AMBIENCE_META[a].color,
                          }
                        : {}
                    }
                    onClick={() => setAmbience(a)}
                  >
                    {AMBIENCE_META[a].icon}{" "}
                    {a.charAt(0).toUpperCase() + a.slice(1)}
                  </button>
                ))}
              </div>

              <textarea
                className="journal-textarea"
                rows={7}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Write freely about your session. What did you feel, hear, see?"
              />

              <div className="char-count">{text.length} characters</div>

              <div className="action-row">
                <button
                  className="btn btn-save"
                  onClick={handleSave}
                  disabled={saving || !text.trim()}
                >
                  {saving ? "Saving…" : "Save Entry"}
                </button>
                <button
                  className="btn btn-analyze"
                  onClick={handleStreamAnalyze}
                  disabled={streaming || !text.trim()}
                >
                  {streaming ? "Analyzing…" : "✦ Analyze Live"}
                </button>
              </div>

              {saveMsg === "saved" && (
                <div className="toast toast-success">
                  Entry saved successfully!
                </div>
              )}
              {saveMsg === "error" && (
                <div className="toast toast-error">
                  Something went wrong. Try again.
                </div>
              )}
            </div>

            {/* Stream result */}
            {(streaming || streamText) && (
              <div className="stream-card">
                <div className="stream-header">
                  <span
                    className={`stream-dot ${streaming ? "dot-live" : "dot-done"}`}
                  />
                  <span>
                    {streaming ? "Reading your emotions…" : "Analysis complete"}
                  </span>
                </div>
                {streamResult ? (
                  <div className="result-grid">
                    <div className="result-item">
                      <div className="result-label">Emotion</div>
                      <div className="result-value emotion-value">
                        {streamResult.emotion}
                      </div>
                    </div>
                    <div className="result-item result-wide">
                      <div className="result-label">Summary</div>
                      <div className="result-value">{streamResult.summary}</div>
                    </div>
                    <div className="result-item result-wide">
                      <div className="result-label">Keywords</div>
                      <div className="keywords-row">
                        {(streamResult.keywords || []).map((k) => (
                          <span key={k} className="keyword-tag">
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <pre className="stream-raw">
                    {streamText}
                    <span className={streaming ? "cursor" : ""} />
                  </pre>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── ENTRIES TAB ── */}
        {tab === "entries" && (
          <div className="content-area">
            <div className="page-header">
              <h1 className="page-title">Journal Entries</h1>
              <p className="page-sub">Your nature session reflections</p>
            </div>

            <button className="btn btn-outline" onClick={fetchEntries}>
              ↻ Refresh
            </button>

            {loadingEntries && (
              <div className="loading-state">Loading entries…</div>
            )}
            {!loadingEntries && entries.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">📓</div>
                <p>No entries yet. Start writing!</p>
              </div>
            )}

            <div className="entries-list">
              {entries.map((e) => {
                const meta = AMBIENCE_META[e.ambience] || AMBIENCE_META.forest;
                return (
                  <div
                    key={e.id}
                    className="entry-card"
                    style={{ "--accent": meta.color }}
                  >
                    <div className="entry-top">
                      <span
                        className="entry-badge"
                        style={{
                          background: meta.color + "18",
                          color: meta.color,
                        }}
                      >
                        {meta.icon} {e.ambience}
                      </span>
                      <span className="entry-date">
                        {new Date(e.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <p className="entry-text">{e.text}</p>

                    {e.analyzed ? (
                      <div className="entry-analysis">
                        <div className="analysis-row">
                          <span className="analysis-emotion">{e.emotion}</span>
                          <span className="analysis-summary">{e.summary}</span>
                        </div>
                        <div className="keywords-row">
                          {(e.keywords || []).map((k) => (
                            <span key={k} className="keyword-tag">
                              {k}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <button
                        className="btn btn-sm"
                        onClick={() => handleAnalyze(e.id)}
                        disabled={analyzingId === e.id}
                        style={{ "--btn-color": meta.color }}
                      >
                        {analyzingId === e.id
                          ? "Analyzing…"
                          : "Analyze this entry"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── INSIGHTS TAB ── */}
        {tab === "insights" && (
          <div className="content-area">
            <div className="page-header">
              <h1 className="page-title">Your Insights</h1>
              <p className="page-sub">Patterns from your nature sessions</p>
            </div>

            <button className="btn btn-outline" onClick={fetchInsights}>
              ↻ Refresh
            </button>

            {loadingInsights && (
              <div className="loading-state">Loading insights…</div>
            )}

            {insights && (
              <>
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-number">{insights.totalEntries}</div>
                    <div className="stat-label">Total Sessions</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-number capitalize">
                      {insights.topEmotion ?? "—"}
                    </div>
                    <div className="stat-label">Top Emotion</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-number">
                      {insights.mostUsedAmbience
                        ? AMBIENCE_META[insights.mostUsedAmbience]?.icon
                        : "—"}{" "}
                      {insights.mostUsedAmbience ?? ""}
                    </div>
                    <div className="stat-label">Favourite Ambience</div>
                  </div>
                </div>

                <div className="keywords-card">
                  <div className="keywords-card-title">Recent Keywords</div>
                  <div className="keywords-row big-keywords">
                    {insights.recentKeywords.length ? (
                      insights.recentKeywords.map((k) => (
                        <span key={k} className="keyword-tag">
                          {k}
                        </span>
                      ))
                    ) : (
                      <span className="empty-text">No keywords yet</span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
