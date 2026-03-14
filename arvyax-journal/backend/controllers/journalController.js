const { GoogleGenerativeAI } = require("@google/generative-ai");
const crypto = require("crypto");
const NodeCache = require("node-cache");
const { getDb } = require("../db");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const analysisCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

function hashText(text) {
  return crypto
    .createHash("sha256")
    .update(text.trim().toLowerCase())
    .digest("hex");
}

const PROMPT = (text) =>
  `You are an emotion-analysis assistant. Analyze this journal entry and respond ONLY with a raw JSON object — no markdown fences, no explanation, nothing else.

Return exactly this structure:
{
  "emotion": "<single primary emotion word>",
  "keywords": ["<word>", "<word>", "<word>"],
  "summary": "<one sentence about the user's mental state>"
}

Journal entry:
"${text}"`;

async function runAnalysis(text) {
  const key = hashText(text);
  const cached = analysisCache.get(key);
  if (cached) {
    console.log("[Cache] HIT");
    return { ...cached, fromCache: true };
  }

  const result = await model.generateContent(PROMPT(text));
  const raw = result.response.text().trim();
  const clean = raw
    .replace(/^```json\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const parsed = JSON.parse(clean);
  analysisCache.set(key, parsed);
  return parsed;
}

async function createEntry(req, res, next) {
  try {
    const { userId, ambience, text } = req.body;
    if (!userId || !ambience || !text)
      return res
        .status(400)
        .json({ error: "userId, ambience, and text are required." });

    const { lastInsertRowid } = getDb()
      .prepare(
        "INSERT INTO journal_entries (userId, ambience, text) VALUES (?, ?, ?)",
      )
      .run(userId, ambience, text);

    res.status(201).json({
      id: lastInsertRowid,
      userId,
      ambience,
      text,
      analyzed: false,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

function getEntries(req, res, next) {
  try {
    const rows = getDb()
      .prepare(
        "SELECT * FROM journal_entries WHERE userId = ? ORDER BY createdAt DESC",
      )
      .all(req.params.userId);

    res.json(
      rows.map((r) => ({
        ...r,
        keywords: r.keywords ? JSON.parse(r.keywords) : [],
        analyzed: Boolean(r.analyzed),
      })),
    );
  } catch (err) {
    next(err);
  }
}

async function analyzeText(req, res, next) {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "text is required." });

    const result = await runAnalysis(text);
    res.json(result);
  } catch (err) {
    // Log the exact error to your console so you don't have to guess
    console.error("❌ Analysis Error:", err.message);

    // Handle JSON parsing failures
    if (err instanceof SyntaxError) {
      return res
        .status(502)
        .json({ error: "LLM returned malformed JSON.", details: err.message });
    }

    // Handle Gemini API Quota issues
    if (err.message && err.message.includes("429")) {
      return res
        .status(429)
        .json({ error: "AI quota exceeded. Please wait a moment." });
    }

    // Handle invalid/missing API keys
    if (err.message && err.message.includes("API key not valid")) {
      return res
        .status(401)
        .json({ error: "Invalid Gemini API Key in .env file." });
    }

    // Pass anything else to the generic 500 handler
    next(err);
  }
}
async function analyzeStream(req, res, next) {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "text is required." });

    const key = hashText(text);
    const cached = analysisCache.get(key);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const send = (event, data) =>
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    if (cached) {
      send("chunk", { text: JSON.stringify(cached) });
      send("done", { fromCache: true });
      return res.end();
    }

    const streamResult = await model.generateContentStream(PROMPT(text));
    let fullText = "";

    for await (const chunk of streamResult.stream) {
      const token = chunk.text();
      fullText += token;
      send("chunk", { text: token });
    }

    try {
      const clean = fullText
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      const parsed = JSON.parse(clean);
      analysisCache.set(key, parsed);
      send("done", { result: parsed });
    } catch {
      send("done", { raw: fullText });
    }
    res.end();
  } catch (err) {
    next(err);
  }
}

async function analyzeAndSaveEntry(req, res, next) {
  try {
    const { entryId } = req.params;
    const db = getDb();
    const entry = db
      .prepare("SELECT * FROM journal_entries WHERE id = ?")
      .get(entryId);
    if (!entry) return res.status(404).json({ error: "Entry not found." });

    const result = await runAnalysis(entry.text);
    db.prepare(
      `UPDATE journal_entries SET emotion=?, keywords=?, summary=?, analyzed=1 WHERE id=?`,
    ).run(
      result.emotion,
      JSON.stringify(result.keywords),
      result.summary,
      entryId,
    );

    res.json({ id: Number(entryId), ...result });
  } catch (err) {
    if (err instanceof SyntaxError)
      return res.status(502).json({ error: "LLM returned malformed JSON." });
    next(err);
  }
}

function getInsights(req, res, next) {
  try {
    const { userId } = req.params;
    const db = getDb();

    const { count: totalEntries } = db
      .prepare("SELECT COUNT(*) as count FROM journal_entries WHERE userId=?")
      .get(userId);
    const topEmotionRow = db
      .prepare(
        `SELECT emotion, COUNT(*) as cnt FROM journal_entries WHERE userId=? AND emotion IS NOT NULL GROUP BY emotion ORDER BY cnt DESC LIMIT 1`,
      )
      .get(userId);
    const topAmbienceRow = db
      .prepare(
        `SELECT ambience, COUNT(*) as cnt FROM journal_entries WHERE userId=? GROUP BY ambience ORDER BY cnt DESC LIMIT 1`,
      )
      .get(userId);
    const recentRows = db
      .prepare(
        `SELECT keywords FROM journal_entries WHERE userId=? AND keywords IS NOT NULL ORDER BY createdAt DESC LIMIT 5`,
      )
      .all(userId);

    const seen = new Set();
    const recentKeywords = [];
    for (const row of recentRows)
      for (const kw of JSON.parse(row.keywords))
        if (!seen.has(kw)) {
          seen.add(kw);
          recentKeywords.push(kw);
        }

    res.json({
      totalEntries,
      topEmotion: topEmotionRow?.emotion ?? null,
      mostUsedAmbience: topAmbienceRow?.ambience ?? null,
      recentKeywords: recentKeywords.slice(0, 10),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createEntry,
  getEntries,
  analyzeText,
  analyzeStream,
  analyzeAndSaveEntry,
  getInsights,
};
