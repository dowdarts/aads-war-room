# Virtual Stage Cue Light System - Setup Guide

## Overview

The Virtual Stage Cue Light System allows a Commentary Booth (Controller) to control a Stage Display (CueDisplay) in real-time across different browser sessions hosted on GitHub Pages. The system uses Supabase real-time updates for cross-browser synchronization.

## Architecture

```
┌──────────────────────────┐         ┌──────────────────────────┐
│   Commentary Booth       │         │    Stage Display         │
│   (CueController)        │◄────►   │    (CueDisplay)          │
│   - GO button            │         │    - Cue Light UI        │
│   - STANDBY button       │   via   │    - Real-time updates   │
│   - OFF button           │ Supabase│    - Full-screen view    │
│                          │         │                          │
└──────────────────────────┘         └──────────────────────────┘
         ↓                                      ↓
         └──────────────────┬──────────────────┘
                            │
                   Supabase Real-time
                   Postgres Changes
                            │
                    ┌───────▼────────┐
                    │  Supabase DB   │
                    │  "cue" table   │
                    │  - id: 1       │
                    │  - status      │
                    │  - updated_at  │
                    └────────────────┘
```

## Setup Instructions

### 1. Create Supabase Project

1. Go to [Supabase](https://supabase.com) and create a new project
2. Note your project URL and API key (found in Settings > API)

### 2. Create the `cue` Table

In your Supabase project, go to the SQL Editor and run:

```sql
-- Create the cue table
CREATE TABLE cue (
  id bigint PRIMARY KEY DEFAULT 1,
  status text NOT NULL DEFAULT 'OFF' CHECK (status IN ('GO', 'STANDBY', 'OFF')),
  updated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE cue ENABLE ROW LEVEL SECURITY;

-- Public read policy
CREATE POLICY "cue_read_public" ON cue
  FOR SELECT USING (true);

-- Public write policy (in production, restrict this)
CREATE POLICY "cue_write_public" ON cue
  FOR UPDATE USING (true)
  WITH CHECK (true);

-- Insert initial row
INSERT INTO cue (id, status) VALUES (1, 'OFF');
```

### 3. Enable Real-time Subscriptions

1. Go to your project's **Replication** settings
2. Enable replication for the `cue` table by adding it to the publication
3. Ensure **Postgres Changes** is enabled

### 4. Configure Environment Variables

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Update `.env.local` with your Supabase credentials:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

3. Install the Supabase JavaScript client:
   ```bash
   npm install @supabase/supabase-js
   ```

### 5. Install Dependencies

```bash
npm install
```

### 6. Run Development Server

```bash
npm run dev
```

### 7. Access the Cue Light System

- **Commentary Booth:** Click "🎙️ Booth Control" in the navigation
- **Stage Display:** Click "🎬 Stage Display" in the navigation

Or navigate directly:
- Booth: Open the app and select the "Booth Control" tab
- Stage: Open the app in another window and select the "Stage Display" tab

## Usage

### For the Commentary Booth

1. Click the **GO** button to illuminate the stage with a bright green light
2. Click the **STAND BY** button to alert the stage with a pulsing red light
3. Click the **OFF** button to dim the stage light
4. The current status is displayed at the top of the booth interface

### For the Stage Display

1. Keep this view visible on your stage/broadcast monitor
2. The circular light will update automatically when the booth sends commands
3. The display updates in real-time across different browser sessions

## Real-time Update Flow

1. **User clicks button in booth** (e.g., "GO")
2. **CueController calls `updateCue('GO')`**
3. **updateCue() dispatches action to StatsContext**
4. **StatsContext updates local state immediately**
5. **supabaseClient.updateCueStatus() sends to Supabase**
6. **Database record updates (status = 'GO')**
7. **Supabase broadcasts change via Postgres Changes**
8. **All subscribed clients receive the update**
9. **StatsContext receives update via subscribeToCueChanges()**
10. **CueDisplay re-renders with new status**
11. **Stage display shows GO (bright green light)**

**Expected latency:** < 200ms

## File Structure

```
src/
├── components/
│   ├── CueController.jsx      # Commentary booth UI
│   ├── CueDisplay.jsx         # Stage display UI
│   └── ...                    # Other components
├── context/
│   └── StatsContext.jsx       # Updated with cue light state
├── utils/
│   └── supabaseClient.js      # Supabase initialization and helpers
└── ...
```

## Troubleshooting

### "Supabase credentials not configured"
- Ensure `.env.local` exists in the project root
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
- Restart the development server after adding env vars

### "Failed to subscribe to cue changes"
- Check that the `cue` table exists in your Supabase project
- Verify Replication is enabled for the `cue` table
- Check browser console for detailed error messages

### Updates not appearing on stage display
- Ensure both booth and stage are within the same Supabase project
- Check that real-time subscriptions are enabled
- Verify network connectivity (check browser Network tab)
- Check browser console for errors

### Cue light is slow to update
- Check your internet connection
- Verify Supabase project is in a region close to you
- Check Supabase dashboard for any ongoing issues

## Security Considerations

⚠️ **Warning:** The current setup uses public read/write policies for the cue table. In production, consider:

1. **Restrict write access** to authenticated users with the "admin" role
2. **Rate limit** updates to prevent spam
3. **Use RLS policies** to restrict booth access to specific users
4. **Add authentication** to the commentary booth interface

Example production RLS policy:

```sql
-- Only authenticated users with admin role can update
CREATE POLICY "cue_update_admin_only" ON cue
  FOR UPDATE USING (auth.jwt()->>'role' = 'admin');
```

## Development Notes

### Key Files Modified
- **[StatsContext.jsx](src/context/StatsContext.jsx)** - Added cue light state management
- **[CueController.jsx](src/components/CueController.jsx)** - New booth interface
- **[CueDisplay.jsx](src/components/CueDisplay.jsx)** - New stage display
- **[supabaseClient.js](src/utils/supabaseClient.js)** - Supabase integration
- **[App.jsx](src/App.jsx)** - Added routing for new components
- **[Nav.jsx](src/components/Nav.jsx)** - Added navigation links

### Dependencies Added
- `@supabase/supabase-js` - Supabase JavaScript client

### Browser Compatibility
- ✅ Chrome/Chromium
- ✅ Firefox
- ✅ Safari
- ✅ Edge

## Performance Tips

1. **Open in separate windows:** Use different browser windows for booth and stage for better usability
2. **Full-screen the stage:** Use F11 or fullscreen mode on the stage display
3. **Test latency:** Click "GO" in booth and note the time it takes to update on stage
4. **Monitor network:** Check browser DevTools Network tab for Supabase requests

## Future Enhancements

- [ ] Add multiple cue lights (per stage/channel)
- [ ] Store cue history for analytics
- [ ] Add countdown timer
- [ ] Add custom animations
- [ ] Mobile-responsive booth interface
- [ ] Cross-device sync confirmation
- [ ] Cue light presets
- [ ] Sound alerts for booth

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review browser console errors
3. Verify Supabase project settings
4. Check Supabase real-time dashboard
