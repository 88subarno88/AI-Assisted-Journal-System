# AI-ASSISTED-JOURNAL-SYSTEM

A journaling app built for ArvyaX's nature immersion sessions (forest, ocean,
mountain). After each session, users can write a journal entry and the app uses
Google Gemini to analyze the emotion and give insights over time.

## What I used

- **Backend** — Node.js + Express
- **Database** — SQLite via better-sqlite3
- **LLM** — Google Gemini 2.5 Flash (free tier, no credit card needed)
- **Frontend** — React + Vite

## Folder structure
```
arvyax-journal/
├── assests/
│   ├── first_page.png             # screenshot of write tab
│   ├── second_page.png            # screenshot of entries tab
│   └── third_page.png             # screenshot of insights tab
│
├── backend/
│   ├── controllers/
│   │   └── journalController.js   # all business logic + LLM calls
│   ├── routes/
│   │   └── journal.js             # route definitions + rate limiting
│   ├── db.js                      # SQLite setup and init
│   ├── server.js                  # Express app entry point
│   ├── .env.example               # copy this to .env and add your key
│   ├── Dockerfile
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx                # main UI component
│   │   ├── index.css              # all styles
│   │   └── main.jsx               # React entry point
│   ├── index.html
│   ├── vite.config.js             # proxy /api → backend
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml
├── README.md(main readme)
└── ARCHITECTURE.md
```

## Getting started

You'll need Node.js v18 or higher installed.

### 1. Get a free Gemini API key

Go to https://aistudio.google.com/app/apikey and create a key. It's free and
doesn't need billing enabled.

### 2. Set up the backend
```bash
cd backend
cp .env.example .env
# Open .env and paste your Gemini API key
npm install
npm run dev
```

You should see `[Server] Running on http://localhost:3001` if everything worked.

### 3. Set up the frontend

Open a second terminal:
```bash
cd frontend
npm install
npm run dev
```

Then open http://localhost:5173 in your browser.

## API endpoints

| Method | Endpoint                        | What it does                        |
|--------|---------------------------------|-------------------------------------|
| POST   | /api/journal                    | Save a new journal entry            |
| GET    | /api/journal/:userId            | Get all entries for a user          |
| POST   | /api/journal/analyze            | Analyze text without saving         |
| POST   | /api/journal/analyze/stream     | Same but streams the response live  |
| POST   | /api/journal/analyze/:entryId   | Analyze a saved entry and store it  |
| GET    | /api/journal/insights/:userId   | Get emotion insights for a user     |
| GET    | /health                         | Check if the server is running      |

## Running with Docker

If you have Docker installed you can run both services with one command:
```bash
GEMINI_API_KEY=your_key_here docker-compose up --build
```

Then open http://localhost:5173 as usual.

## Notes

- Analysis results are cached by default so the same text won't hit the
  API twice
- Rate limiting is enabled on write and analyze endpoints
- The database file (journal.db) is created automatically on first run
- the main readme.md and architecture.md inside the arvyax-journal/ folder , see them for better explanation
