# AADSDartsIntel

A dark-themed (orange/black) React + Vite dashboard for live darts commentary.

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Create your API key file (never committed to git):
   ```
   cp .env.example .env.local
   ```
   Then open `.env.local` and paste your Google AI Studio API key.

3. Start the dev server:
   ```
   npm run dev
   ```

## Getting a Gemini API key

1. Go to [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Create a new API key
3. Paste it into `.env.local` as `VITE_GEMINI_API_KEY=your_key_here`

## Data

- Player profiles: `src/data/players.csv` (Google Form export)
- Event results: `src/data/events/*.json` (drop new event files here)
- Runtime uploads available in the **Data Manager** tab
