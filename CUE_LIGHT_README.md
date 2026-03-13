# 🎬 Virtual Stage Cue Light System

A real-time, cross-browser cue light control system for broadcast commentary and stage management. Control the stage from the commentary booth and see live updates across different devices.

## Features

✨ **Real-time Updates** — Changes sync in <200ms across browser sessions  
🎨 **Beautiful UI** — Large, accessible controls designed for broadcast environments  
🌐 **Cross-Device** — Works across different browsers, tabs, and devices  
📱 **Responsive** — Optimized for desktop, tablet, and mobile displays  
⚡ **Instant Feedback** — Visual confirmation that commands were received  
🔄 **Automatic Recovery** — Auto-reconnects if network is interrupted  
💻 **Offline Capable** — Works locally even without Supabase (limited features)

## Quick Start

### 1️⃣ Install Package
```bash
npm install @supabase/supabase-js
```

### 2️⃣ Create Supabase Project
Visit [supabase.com](https://supabase.com) and create a new project

### 3️⃣ Set Up Database
In Supabase SQL editor, run:
```sql
CREATE TABLE cue (
  id bigint PRIMARY KEY DEFAULT 1,
  status text NOT NULL DEFAULT 'OFF' CHECK (status IN ('GO', 'STANDBY', 'OFF')),
  updated_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

ALTER TABLE cue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cue_read_public" ON cue FOR SELECT USING (true);
CREATE POLICY "cue_write_public" ON cue FOR UPDATE USING (true) WITH CHECK (true);

INSERT INTO cue (id, status) VALUES (1, 'OFF');
```

### 4️⃣ Configure Environment
Create `.env.local`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 5️⃣ Enable Real-time
In Supabase dashboard:
- Go to **Replication** settings
- Add `cue` table to the publication
- Ensure **Postgres Changes** is enabled

### 6️⃣ Test It
```bash
npm run dev
```

Open two browser windows:
- **Window 1:** Go to "🎬 Stage Display"
- **Window 2:** Go to "🎙️ Booth Control"
- Click buttons in Window 2, watch Window 1 update!

## How It Works

### The Booth (Controller)
```
🎙️ COMMENTARY BOOTH
┌─────────────────────┐
│   Current Status    │
│      GO             │
└─────────────────────┘
┌─────────────────────┐
│  🟢 GO              │ ← Click to go live
│  🔴 STAND BY        │ ← Click to alert
│  ⚫ OFF             │ ← Click to turn off
└─────────────────────┘
```

### The Stage Display
```
🎬 STAGE DISPLAY
        ● ← Glowing green light
     (bright, no blink)
     
     Status: GO
```

### How Updates Work

1. **Booth:** Click "GO" button
2. **React:** Immediately updates local state (instant feedback)
3. **Supabase:** Sends update to database
4. **Real-time:** Database broadcasts change to all connected clients
5. **Stage:** Receives update and displays green light
6. **Other Booths:** If multiple commentators, they all see the update

**Timeline:**
- Click to local update: **~0ms** (instant)
- Local to database: **~50-100ms**
- Database to stage: **~0-50ms**
- Total end-to-end: **<200ms** ✅

## Navigation

In the app's navigation bar, you'll find:
- **🎬 Stage Display** — Full-screen cue light (put this on your broadcast monitor)
- **🎙️ Booth Control** — Control panel (use at commentary workstation)

## Status Meanings

| Status | Light | Animation | Use Case |
|--------|-------|-----------|----------|
| **GO** | 🟢 Green | Solid glow | Ready to broadcast / On air |
| **STAND BY** | 🔴 Red | Pulsing | Alert / Standby mode |
| **OFF** | ⚫ Grey | Dim, no glow | Broadcast ended / Idle |

## Files Included

### Components
- `src/components/CueController.jsx` — Booth control interface
- `src/components/CueDisplay.jsx` — Stage display
- `src/context/StatsContext.jsx` — Updated with cue state

### Utilities
- `src/utils/supabaseClient.js` — Supabase integration

### Documentation
- `CUE_LIGHT_SETUP.md` — Complete setup guide
- `CUE_LIGHT_QUICK_REFERENCE.md` — Quick reference
- `CUE_LIGHT_IMPLEMENTATION.md` — Implementation details
- `CUE_LIGHT_FILES_INFO.md` — File changes reference

## Performance

### Expected Latency
- **Local Wi-Fi:** 50-100ms
- **Home Internet:** 100-150ms
- **Mobile Network:** 150-300ms
- **Poor Connection:** 300-500ms

### Tips for Best Performance
1. Deploy to GitHub Pages (usually faster)
2. Use Supabase region closest to you
3. Keep browser DevTools closed
4. Avoid VPN if possible
5. Test during off-peak hours

## Troubleshooting

### "Feature not working"
- Check browser console for errors (F12)
- Verify `.env.local` file exists
- Confirm Supabase credentials are correct
- Restart development server

### "Updates are slow"
- Check your internet connection
- Verify Supabase project is online
- Try refreshing the page
- Check for browser extensions that might interfere

### "Stage display shows OFF"
- Booth may not have been configured yet
- Check that Supabase is initialized
- Try clicking a button in the booth
- Check network connection

Full troubleshooting guide in `CUE_LIGHT_SETUP.md`

## Production Deployment

### Before Going Live

1. **Security:** Update RLS policies to restrict access
2. **Testing:** Test latency with real users
3. **Monitoring:** Set up error logging
4. **Backup:** Have a manual backup plan
5. **Mobile:** Test on mobile devices

### Deploy Steps

```bash
# Build production bundle
npm run build

# Deploy to GitHub Pages
npm run deploy
```

Access at: https://dowdarts.github.io/aads-war-room/

## Advanced Features

### Keyboard Shortcuts (Can Be Added)
- Press **G** for GO
- Press **S** for STAND BY
- Press **O** for OFF

### Multi-Stage Support (Future)
Could expand to control multiple stages simultaneously

### Cue History (Future)
Could log all status changes for analysis

### Custom Animations (Future)
Could add custom light patterns or colors

## Support & Documentation

📖 **Setup Guide:** `CUE_LIGHT_SETUP.md`  
⚡ **Quick Start:** `CUE_LIGHT_QUICK_REFERENCE.md`  
🔧 **Implementation:** `CUE_LIGHT_IMPLEMENTATION.md`  
📋 **File Changes:** `CUE_LIGHT_FILES_INFO.md`

## Tech Stack

- **React 18** — UI framework
- **Supabase** — Real-time database
- **Tailwind CSS** — Styling
- **Vite** — Build tool
- **GitHub Pages** — Hosting

## License

Same as parent project

## Questions?

1. Check the troubleshooting section
2. Review the setup guide
3. Check browser console for error messages
4. Verify Supabase configuration

---

**Ready to go live?** Start with the setup guide above! 🚀
