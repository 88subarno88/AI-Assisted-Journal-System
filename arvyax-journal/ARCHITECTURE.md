# Architecture Notes

## 1. How would you scale this to 100k users?

Right now the app uses SQLite which is fine for development, but it won't
handle that many concurrent users well. The first thing I'd do is migrate
to PostgreSQL since it supports proper concurrent connections. I'd also add
PgBouncer for connection pooling so the DB doesn't get overwhelmed.

For the API layer, I'd containerize everything with Docker and deploy it on
something like Kubernetes so we can horizontally scale the Express servers
behind a load balancer. The tricky part is the LLM calls — they're slow and
would block everything. So I'd move analysis to a background job queue using
BullMQ + Redis. The POST request would return a job ID immediately (202
Accepted) and the frontend would poll for the result. This way the API stays
fast even when Gemini is slow.

## 2. How would you reduce LLM cost?

A few things I'd try:

- Clean up the text before sending it — remove unnecessary words to reduce
  token count
- For very short journal entries (under 100 words), use a smaller/cheaper
  model since they don't need the full power of a large one
- Cache analysis results so the same text never gets sent to the LLM twice
  (already done in this project)
- Use batch processing APIs where available — they're usually cheaper for
  non-urgent tasks
- Set a strict max_tokens limit on the output so we never accidentally get
  a huge response

## 3. How would you cache repeated analysis?

Currently I'm using node-cache in memory, keyed by a SHA-256 hash of the
journal text. This works fine for a single server but breaks if you scale
to multiple instances since each server has its own cache.

At scale I'd replace this with Redis as a shared cache:

- Key: `analysis:{sha256(text)}`
- TTL: 24 hours (or even longer since journal text never changes)
- The pattern is simple: check Redis first → if miss, call LLM → store
  result in Redis for next time

This way all server instances share the same cache and we avoid duplicate
LLM calls completely.

## 4. How would you protect sensitive journal data?

Journal entries are personal and sensitive so this matters a lot:

- **Encryption at rest**: Use AES-256-GCM to encrypt the journal text
  column before storing it. Keys would be managed through something like
  AWS KMS so they're never hardcoded.
- **Encryption in transit**: Always HTTPS, never HTTP. TLS 1.3 minimum.
  Also make sure journal text never appears in server logs.
- **Access control**: Use JWT tokens for authentication. The userId should
  come from the verified token, not from the request body — otherwise
  anyone could read anyone else's entries just by changing the userId.
- **LLM privacy**: Before sending text to Gemini, strip out any obvious
  personal information like names, phone numbers, emails etc. Also use
  Gemini's zero data retention option if available.
- **Audit logs**: Keep a separate append-only log of who accessed which
  user's data and when. This helps with debugging and also with compliance
  if needed later.
