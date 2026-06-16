# AADS Interview Assistant — Full Technical & Functional Documentation

## Purpose

The AADS Interview Assistant is a live match-tracking tool used by **Denis** (the on-air interviewer) during the **AADS Tournament of Champions (TOC)** darts event. As Denis watches each match in real time, he logs notable moments leg by leg. Once a match is over, the app uses everything it has collected to automatically generate four relevant interview questions for him to ask the winning player immediately after the match.

The goal is to make Denis's post-match interviews specific, data-driven, and connected to what actually happened in the match — not generic darts questions.

---

## Two-App System

### 1. Interview Admin (`interview-admin.html`)
Used by **Matthew (admin)** before and during the event.

- PIN-protected (admin PIN: 40783)
- Add players (name + province)
- Build the match schedule (Player A vs Player B, in order)
- Advance or rewind the "current match" pointer so Denis's app auto-loads the right match
- Import the full schedule via CSV upload or paste

### 2. Interview Assistant (`interview.html`)
Used by **Denis** live during each match.

- No PIN required
- Loads current match automatically from the database
- Denis logs events as they happen, leg by leg
- After match ends → generates 4 interview questions
- Questions have swap variants Denis can cycle through if one doesn't fit

---

## Database (Supabase)

All match data is stored in the `app_settings` table under the key `interview_event`.

### Data structure stored in Supabase:

```json
{
  "players": [
    { "id": "p1", "name": "Tom Holden", "province": "NS" },
    { "id": "p2", "name": "Rob Sibbick", "province": "NB" },
    { "id": "p3", "name": "Kyle Gray", "province": "NB" },
    { "id": "p4", "name": "Drake Berry", "province": "NS" },
    { "id": "p5", "name": "Tyler Cyr", "province": "NB" },
    { "id": "p6", "name": "Dee Cormier", "province": "NB" }
  ],
  "schedule": [
    { "id": "m1", "playerA": "p1", "playerB": "p2" },
    { "id": "m2", "playerA": "p3", "playerB": "p4" },
    ...
    { "id": "m19", "playerA": "p13", "playerB": "p14" }
  ],
  "current_match": 0
}
```

The `current_match` value is the index (0-based) into the schedule array. Matthew advances this as the day progresses so Denis's app always shows the right match without Denis having to navigate manually.

---

## TOC 2026 Match Format

| Stage | Format |
|---|---|
| Round Robin (Matches 1–15) | Best of 7 legs — first to 4 |
| 4th Place Tiebreak (Match 16) | Best of 3 legs — first to 2 |
| Semifinals (Matches 17–18) | Best of 11 legs — first to 6 |
| Championship Final (Match 19) | Best of 17 legs — first to 9 |

The app currently uses a fixed "first to 4" target for all matches. This would need to be updated per match format for playoffs.

---

## Denis's Live Workflow

### Step-by-step flow during a match:

1. Denis opens `interview.html` on his phone/tablet
2. The current match loads automatically (e.g. "Tom Holden vs Rob Sibbick")
3. **During each leg:**
   - Denis taps the player who did something notable (blue/orange player button)
   - Denis taps the action button that describes what happened
   - The event is logged instantly to the current leg
   - Denis can delete any entry with ✕ if he made a mistake
4. **When a leg ends:**
   - Denis taps the name of the player who won that leg
   - The leg is recorded with all its events, the score updates, and the next leg begins
5. **This repeats** until one player wins 4 legs (round robin)
6. The logger closes, a "Tom Holden wins 4–2!" banner appears
7. Denis taps **Generate Interview Questions**
8. Four questions appear, each with a ↻ swap button to cycle to an alternate version
9. Denis reads the questions during the interview

---

## Action Buttons Denis Can Log

| Button | Input Required | How It Logs |
|---|---|---|
| 180 | None | `180` |
| High Finish | None | `High Finish` |
| Big Finish | Number (checkout) | `Big Finish 146` |
| Bullseye Out | None | `Bullseye Out` |
| Low Dart Leg | Number (darts used) | `15-Dart Leg` |
| Missed Doubles | None | `Missed Doubles` |
| Max Response | None | `Max Response` |
| Comeback | None | `Comeback` |
| Clutch Shot | Text (describe shot) | `Clutch Shot — Double 16 to hold` |
| Bad Visit | None | `Bad Visit` |

**Prompting actions** (Big Finish, Low Dart Leg, Clutch Shot) show an inline input field when tapped. Denis types the detail and hits Enter.

---

## In-Memory Match Log Structure

The leg data is stored in JavaScript memory (not currently saved to the database). After all legs are played, the full match log looks like this:

```js
legs = [
  {
    events: [
      { player: 'A', playerName: 'Tom Holden', action: '180' },
      { player: 'B', playerName: 'Rob Sibbick', action: 'Missed Doubles' }
    ],
    winner: 'A'
  },
  {
    events: [
      { player: 'B', playerName: 'Rob Sibbick', action: 'Big Finish 146' }
    ],
    winner: 'B'
  },
  {
    events: [
      { player: 'A', playerName: 'Tom Holden', action: 'Clutch Shot — Double 16 to hold' },
      { player: 'A', playerName: 'Tom Holden', action: '180' }
    ],
    winner: 'A'
  }
  // ... continues until one player wins 4 legs
]

scoreA = 4  // Tom
scoreB = 2  // Rob
matchWinner = 'A'
```

---

## Current Question Generation Logic

When Denis taps **Generate Interview Questions**, the app analyses the in-memory match log and generates 4 questions (each with 2 swap variants):

### Slot 1 — Win Type / Opener
Determines the tone of the first question based on the final score:
- **Dominant** (opponent won 0 or 1 legs): "That was a dominant performance, 4–1..."
- **Comeback** (winner was down 0–2 or worse at some point): "You were behind at one point and came back..."
- **Close** (went to 4–3 or loser won 3): "That went right to the wire at 4–3..."
- **Standard**: Generic opening about the result

### Slot 2 — Notable Action
Picks the most significant action from the match and asks about it:
- Multiple 180s → asks about scoring power
- Single 180 → asks if it gave them a boost
- High Finish / Bullseye Out → asks about finishing under pressure
- Low Dart Leg → asks about efficiency
- Clutch Shot → asks about handling pressure
- Max Response → asks about mental reply to opponent's big scores
- Opponent missed doubles → asks how to take advantage
- Fallback → asks about game plan

### Slot 3 — Key Moment / Leg
Finds the leg with the most logged events and asks about it specifically:
- If the winner won that leg: "Leg 3 had a lot going on — 180, Missed Doubles. Talk me through that leg."
- If the loser won that leg: "After leg 3, how did you mentally reset?"
- Fallback: "Which leg do you feel was the most important?"

### Slot 4 — Context / Closer
Always one of:
- "Where does this win leave you in the round robin and what are you targeting from here?"
- "Thank you — any final words for the AADS fans watching today?"

---

## What the App Currently Does NOT Know (Gaps)

These are data points that exist in some form but are not yet used in question generation:

### 1. Specific numbers/descriptions from prompts
The checkout number ("146"), the dart count ("15"), and the clutch shot description ("Double 16 to hold") are logged and displayed in the leg history — but the question generator does not yet reference them directly. Questions say "a Big Finish" instead of "that 146 finish."

### 2. Previous match results from earlier in the day
Each match starts fresh. If Tom beat Rob 4–1 in Match 1 and is now in Match 7 vs Dee, the app does not know about the earlier result. There is no persistent match-result storage — match log data lives only in JavaScript memory and is lost when navigating to the next match.

### 3. Tournament standings / points
The round robin awards 2 points per win, 0 per loss. The app knows the schedule but does not track cumulative points or current standings as the day progresses.

### 4. Who the winner faces next
The schedule is stored in its entirety. The app could calculate "Tom's next match is Match 13 vs Kyle Gray" but currently does not use this for questions.

### 5. Head-to-head history between these two players
There is no historical data. The app only knows what happens in the match Denis is currently watching.

### 6. Which leg a specific notable event happened in
The question generator looks at all events across all legs but does not reference which leg number an event occurred in (e.g. "that 180 in leg 5 was the turning point").

### 7. Consecutive leg winning streaks
The app knows who won each leg in order but does not detect "Tom won 3 legs in a row to close out the match."

### 8. Playoff format differences
The semifinals are best of 11 (first to 6) and the final is best of 17 (first to 9). The app currently checks for ≥4 leg wins to end the match regardless of format.

---

## Files and Where They Live

| File | Location | Purpose |
|---|---|---|
| `interview.html` | `public/interview.html` | Denis's live match tool |
| `interview-admin.html` | `public/interview-admin.html` | Admin setup tool (Matthew) |
| Schedule CSV | Downloaded separately | Import format for admin |

---

## Tech Stack

- **Frontend**: Vanilla HTML, CSS, JavaScript (no frameworks)
- **Database**: Supabase (PostgreSQL) via REST API using `fetch()`
- **Auth**: None on the interview app; admin uses PIN 40783
- **Hosting**: GitHub Pages (production) / Vite dev server (local)
- **State**: All match-tracking data is in-memory JavaScript variables

---

## Supabase Table: `app_settings`

```sql
-- This table already exists. The interview data lives here:
key   = 'interview_event'
value = '{ ...JSON string with players, schedule, current_match ... }'
```

The interview admin PATCHes this row whenever Matthew saves changes. Denis's app GETs it on load (and could poll for real-time admin updates if desired).

---

## Known Improvement Opportunities

1. **Save completed match results to Supabase** so all match data is available for the rest of the day — enables cross-match questions
2. **Reference specific values in questions** (the actual checkout number, dart count, shot description)
3. **Tournament standings tracker** — calculate running points total, tell Denis what the win means for standings
4. **Next opponent awareness** — look up who the winner faces next from the schedule
5. **Streak detection** — identify consecutive leg wins and reference them in questions
6. **Leg-number specificity** — reference which leg a key event happened in
7. **Format-aware leg target** — semifinals need first-to-6, final needs first-to-9
8. **Real-time sync** — Matthew advances the current match pointer; Denis's app could poll Supabase every 30 seconds to auto-update without refreshing
9. **Question history** — log which questions Denis actually used per match
10. **Multiple notable events in one question** — combine e.g. "two 180s AND a high finish" into a single more specific question
