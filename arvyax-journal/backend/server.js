require("dotenv").config();
const express = require("express");
const cors = require("cors");

const { initDb } = require("./db");
const journalRoutes = require("./routes/journal");
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

initDb();

app.use("/api/journal", journalRoutes);
app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use((err, _req, res, _next) => {
  console.error("[Error]", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
});
