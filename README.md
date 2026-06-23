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

---

# How to Use AADS War Room

This site has three audiences: **Players**, **Staff**, and **Matthew (Master Admin)**. Everything below describes what's actually live on the site today.

## For Players

**Where to go:** the **Players Portal** (`players-portal.html`) — its own shareable URL, or click "Players Dashboard" from the main site's sign-in choice screen.

- **Sign in** with your name and a 4-digit personal PIN. If you've never signed in before, you can create your own PIN on the spot — there's no pre-registration step.
- Once signed in you get four tabs:
  - **Events** — every tournament you're entered in.
  - **Full Schedule** — the complete match schedule for your event, with status badges (Up Next, Live Now, Waiting, Done, Scheduled).
  - **My Matches** — just your matches and opponents.
  - **Acknowledgement** — opens the sign-in kiosk to complete your media release / policy waiver.
- **Notifications**: turn these on to get pushed alerts when your event starts, when you're called to the stage, and when the cue light goes green for your match.
- You can "Add to Home Screen" on your phone so it behaves like an app.

**You don't need an account at all** to browse the public stats pages on the main site — anyone can open these without signing in:
- **Province Standings** — top players ranked by 3-dart average, grouped by province.
- **Province Score** — a 0–100 composite ranking per province.
- **Player Wiki** — searchable player bios, stats, and "get to know them" Q&A.
- **Player Standings** — full sortable leaderboard (3DA, wins, checkouts, 180s, etc.).
- **H2H Match-Up** — head-to-head stats between any two players.

## For Staff

**Where to go:** the **Staff Login** page (`staff-portal.html`) — its own shareable URL, or the "Staff Login" tile from the main site's sign-in choice screen. Signing in here signs you into every staff tool below automatically (they all share the same session), and it works whether you got there directly or through the main wiki.

- **Sign in** with your staff code (the PIN Matthew gave you).
- You'll land on a tile grid of tools — but you'll only see the tools Matthew has switched on for your account. If you see none, ask Matthew to grant you access in Manage Staff.
- **Sign Out** any time from the same page; this also signs you out of every other staff tool on this device.

**What each tool tile does:**

| Tool | What it's for |
|---|---|
| 🎙️ **Denis Interview Assistant** | Logs live match events as they happen and auto-generates post-match interview questions, with a 3-minute on-air timer. |
| 🎤 **Commentator** | Quick-reference player spotlights, stats, and talking points for live broadcast commentary; also has head-to-head prep. |
| 📷 **QR Scanner** | Door check-in — scan a guest's ticket QR, confirm payment, and issue the right wristband (VIP/GA). Has its own 4-digit gate. |
| ✅ **Ticket Check-in** | Live master list of who's checked in, with real-time counts and search — works alongside the QR Scanner. |
| 📋 **Interview Admin** | Loads the player roster/match schedule (CSV) that powers Denis, and points Denis at the current match. PIN-gated. |
| 🎟️ **Ticket Sales** | Snapshot of VIP/GA sales and check-in progress, with links into the ticket admin tools. PIN-gated. |
| 👕 **Shirt Admin** | Confirms e-transfer payments on shirt orders, finalizes batches for the supplier, opens/closes the storefront, exports orders to CSV. PIN-gated. |
| 🧾 **Shirt Order** | The customer-facing shirt order form (color/size/style/name) — open this on someone's behalf if they're ordering in person. |
| 👕 **Merch Store** | Gallery of pre-designed event/player shirts that link out to MaxCorners for purchase — a promo page, not a checkout. |
| 📋 **Policy Docs** | Read-only library of AADS rulebooks, handbooks, and legal/liability docs, plus signed waivers from the Acknowledgement kiosk. |
| 🚦 **Cue Light & Schedule** | Pick a role on this device: **Controller** (broadcast START/WAIT/OFF to the stage, manage the schedule, mark matches done) or **Display** (the big colored light + schedule players and the audience see). Works offline once installed. |
| 💬 **Staff Chat** | Direct messages between staff — see who's online, send text/photos, get unread badges. Also pops up as a floating button across staff tools. |

A few tools (Interview Admin, Ticket Sales, Shirt Admin, QR Scanner) ask for an extra numeric code on top of your staff sign-in — that's intentional, ask Matthew if you need it.

## For Matthew (Master Admin)

Everything Staff have, plus:

- **Master sign-in** unlocks every tool tile automatically — no per-tool permissions needed.
- **Manage Staff** (in the Staff Dashboard, click the 👥 tile): add new staff accounts, edit names/PINs, pause or remove accounts, and check/uncheck exactly which tool tiles each person can see.
  - **Copy Login Link** — copies the `staff-portal.html` URL to your clipboard so you can text/Slack it to staff directly.
  - **Open Registration Page** — sends a link to `staff-register.html` so a new hire can pick their own name + PIN instead of you typing it in for them.
- **Staff Activity Log** — see who opened which tool and when.
- **Data Manager** (`?tab=data` on the main site, behind its own separate admin PIN — not the staff code):
  - Upload live event result JSON files and override player data for the session.
  - Import a fresh player CSV from the Google Form, or export the current player database back to CSV.
  - Edit any individual player's profile (bio, province, stats overrides) and force a province assignment when auto-detection gets it wrong.
  - Flip the payment/donation QR on or off, watch scan counts, approve incoming e-transfer donations, and configure the live fundraiser goal bar for OBS overlays.
- **Policy Docs** — same library staff see; this is also where signed Acknowledgement waivers end up for your records.

### Quick links to share

| Audience | Link |
|---|---|
| Players | `players-portal.html` |
| Staff | `staff-portal.html` (or use the **Copy Login Link** button in Manage Staff) |
| New staff registration | `staff-register.html` |
| Full admin dashboard (master only) | `index.html?tab=staff` |
