const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const {
  createEntry,
  getEntries,
  analyzeText,
  analyzeStream,
  analyzeAndSaveEntry,
  getInsights,
} = require("../controllers/journalController");

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: "Too many write requests, slow down." },
});

const analyzeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many analysis requests, slow down." },
});

router.post("/analyze/stream", analyzeLimiter, analyzeStream);
router.post("/analyze/:entryId", analyzeLimiter, analyzeAndSaveEntry);
router.post("/analyze", analyzeLimiter, analyzeText);
router.get("/insights/:userId", getInsights);
router.post("/", writeLimiter, createEntry);
router.get("/:userId", getEntries);

module.exports = router;
