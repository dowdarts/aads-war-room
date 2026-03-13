# Cue Light Quick Reference

## Navigation

Find the cue light controls in the main navigation bar:
- **🎬 Stage Display** - Opens the full-screen cue light display
- **🎙️ Booth Control** - Opens the commentary booth control panel

## Booth Controls

### GO Button (Green)
- Illuminates stage with bright green light
- Used to signal "ready" or "on air"
- Light glows with green halo effect

### STAND BY Button (Red)
- Illuminates stage with bright red light
- Flashes/pulses at 0.5 second intervals
- Used to alert/warn about upcoming changes

### OFF Button (Grey)
- Dims the stage light
- Returns light to dark/idle state
- Used when broadcast has ended

## Stage Display View

- **Full-screen circle:** The cue light that responds to booth commands
- **Status text:** Current status (GO, STAND BY, or OFF)
- **Real-time:** Updates automatically across all open windows

## Setup Checklist

Before first use, ensure:

- [ ] Supabase project created
- [ ] `cue` table created in Supabase
- [ ] Real-time subscriptions enabled
- [ ] `.env.local` configured with Supabase credentials
- [ ] `npm install @supabase/supabase-js` executed
- [ ] Development server running (`npm run dev`)

## Quick Start

### For Testing Locally

1. Open two browser windows showing the same app
2. In one window, go to **Stage Display** tab
3. In the other window, go to **Booth Control** tab
4. Click buttons in booth and watch stage light change

### For Broadcast Setup

1. Set up stage display on broadcast monitor/TV
2. Set up booth control on commentary workstation or tablet
3. Ensure both connected to same network
4. Test latency (aim for <200ms)

## Keyboard Shortcuts (Optional)

You can enhance the booth with keyboard controls. Try adding:
- **G** = GO
- **S** = STAND BY
- **O** = OFF

Currently not implemented but can be added to CueController.jsx

## Troubleshooting

**Stage display not updating?**
- Check both windows have Supabase configured
- Verify real-time is enabled in Supabase dashboard
- Check browser console for errors

**Booth buttons slow to respond?**
- Check your internet connection
- Try refreshing the page
- Check Supabase dashboard for issues

**Getting errors?**
- Check `.env.local` file exists
- Verify Supabase keys are correct
- Run `npm install` in case dependencies missing

## Tips & Tricks

1. **Full-screen stage:** Press F11 on stage display for true full-screen
2. **Multiple monitors:** Stretch the stage window across the broadcast monitor
3. **Remote access:** Deploy to GitHub Pages and access both booth and stage remotely
4. **Mobile booth:** Use the booth interface on a tablet for mobility
5. **Backup channel:** Test both HTTP and HTTPS connectivity

## Support Resources

- **Supabase Docs:** https://supabase.com/docs
- **Real-time Guide:** https://supabase.com/docs/guides/realtime
- **Status Monitor:** Check Supabase dashboard during issues
- **Browser Console:** Press F12 to see debug messages

---

**Version:** 1.0  
**Last Updated:** 2026-03-12
