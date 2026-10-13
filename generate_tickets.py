"""
AADS Tournament of Champions 2026 — Ticket Generator
Run: python generate_tickets.py

Queries toc_tickets for PAID/COMP tickets not yet generated,
creates a PDF ticket for each, then marks them generated in Supabase.

Dependencies:
    pip install supabase pillow reportlab qrcode python-dotenv
"""

import os
import sys
import json
import qrcode
from datetime import datetime
from io import BytesIO
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client
from PIL import Image, ImageDraw, ImageFont
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader

load_dotenv()

# ── Config ──
SUPABASE_URL     = os.getenv("SUPABASE_URL", "https://gygwhznblajojwveikhg.supabase.co")
SUPABASE_KEY     = os.getenv("SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5Z3doem5ibGFqb2p3dmVpa2hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjU5NzgsImV4cCI6MjA4ODk0MTk3OH0.BI9KlRsCxAvNnFHCGq6hjXfdsaNgo7afY4Xa5uxwjak")
OUTPUT_DIR       = Path("./generated_tickets")
VIP_PAID_CAP     = 24   # Tables 3–6 only; COMP skipped
GA_CAP           = 64

EVENT_NAME       = "AADS Tournament of Champions"
EVENT_SUBTITLE   = "Presented by Amherst PharmaChoice"
EVENT_DATE       = "Saturday, July 25, 2026"
EVENT_VENUE      = "Club d'Age d'Or, Scoudouc, NB"

# Ticket dimensions (landscape credit-card aspect, printed at 600 dpi)
TW, TH = 1800, 900   # pixels
BG      = (5, 5, 5)
GOLD    = (245, 197, 24)
WHITE   = (245, 245, 245)
MUTED   = (120, 120, 120)
ORANGE  = (255, 122, 0)
PURPLE  = (120, 80, 200)


def get_font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    """Try to load a system font, fall back to default."""
    font_names = ["arialbd.ttf", "Arial Bold.ttf"] if bold else ["arial.ttf", "Arial.ttf"]
    for name in font_names:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def make_qr(data: str, size: int = 280) -> Image.Image:
    qr = qrcode.QRCode(version=3, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=8, border=2)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    return img.resize((size, size), Image.LANCZOS)


def draw_ticket(ticket: dict) -> Image.Image:
    img = Image.new("RGB", (TW, TH), BG)
    draw = ImageDraw.Draw(img)

    is_vip  = ticket["ticket_type"] == "VIP"
    is_comp = ticket["payment_status"] == "COMP"
    accent  = PURPLE if is_comp else (GOLD if is_vip else ORANGE)

    # Left gold bar
    draw.rectangle([(0, 0), (12, TH)], fill=accent)

    # ── Left column ──
    lx = 48

    # Event name
    draw.text((lx, 48), EVENT_NAME.upper(), font=get_font(44, bold=True), fill=GOLD)
    draw.text((lx, 105), EVENT_SUBTITLE, font=get_font(22), fill=MUTED)

    # Divider
    draw.line([(lx, 145), (TW - 360, 145)], fill="#2a2a2a", width=1)

    # Type label
    if is_vip:
        type_label = "VIP TABLE" if not is_comp else "VIP COMP"
        detail     = f"Table {ticket['table_number']} · Seat {ticket['seat_number']}"
    else:
        type_label = "GENERAL ADMISSION"
        detail     = ""

    draw.text((lx, 162), type_label, font=get_font(52, bold=True), fill=accent)
    if detail:
        draw.text((lx, 228), detail, font=get_font(34), fill=WHITE)

    # Holder name
    holder = ticket.get("ticket_holder_name") or ticket.get("purchaser_name") or ""
    if holder:
        draw.text((lx, 295), holder.upper(), font=get_font(40, bold=True), fill=WHITE)

    # Event date + venue
    draw.text((lx, 365), f"📅  {EVENT_DATE}", font=get_font(28), fill=MUTED)
    draw.text((lx, 408), f"📍  {EVENT_VENUE}",  font=get_font(28), fill=MUTED)

    # Ticket number + count display
    ticket_num = ticket.get("ticket_number") or ""
    if is_vip:
        # Calculate position within VIP paid block (13–36)
        try:
            num_int = int(ticket_num.replace("VIP-", ""))
            display = f"TICKET {num_int - 12:02d} / 24 · {ticket_num}"
        except Exception:
            display = ticket_num
    else:
        try:
            num_int = int(ticket_num.replace("GA-", ""))
            display = f"TICKET {num_int:03d} / 64 · {ticket_num}"
        except Exception:
            display = ticket_num

    draw.text((lx, 490), display, font=get_font(28, bold=True), fill=MUTED)

    # Ticket code (small)
    draw.text((lx, TH - 64), ticket["ticket_code"], font=get_font(20), fill="#333")

    # ── Right column: QR + bracelet ──
    qr_img   = make_qr(ticket["ticket_code"], size=300)
    qr_x     = TW - 340
    qr_y     = (TH - 300) // 2
    img.paste(qr_img, (qr_x, qr_y))

    # Bracelet label under QR
    bracelet_text = "🟠 VIP WRISTBAND" if is_vip else "⚪ GA WRISTBAND"
    draw.text((qr_x, qr_y + 308), bracelet_text, font=get_font(20), fill=MUTED)

    # Vertical separator
    draw.line([(TW - 360, 30), (TW - 360, TH - 30)], fill="#2a2a2a", width=1)

    return img


def save_as_pdf(pil_img: Image.Image, path: Path) -> None:
    """Embed the PIL image into a PDF page matching its pixel dimensions at 150 dpi."""
    dpi = 150
    w_pt = (pil_img.width  / dpi) * 72
    h_pt = (pil_img.height / dpi) * 72
    c = canvas.Canvas(str(path), pagesize=(w_pt, h_pt))
    buf = BytesIO()
    pil_img.save(buf, format="JPEG", quality=92)
    buf.seek(0)
    c.drawImage(ImageReader(buf), 0, 0, width=w_pt, height=h_pt)
    c.save()


def main() -> None:
    OUTPUT_DIR.mkdir(exist_ok=True)

    sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # ── Inventory check ──
    existing = sb.table("toc_tickets").select("ticket_type,payment_status,generated").execute().data
    vip_generated = sum(1 for t in existing if t["ticket_type"] == "VIP" and t.get("generated") and t["payment_status"] != "COMP")
    ga_generated  = sum(1 for t in existing if t["ticket_type"] == "GA"  and t.get("generated"))

    print(f"Already generated: {vip_generated} VIP (paid) · {ga_generated} GA")
    if vip_generated >= VIP_PAID_CAP and ga_generated >= GA_CAP:
        print("All caps reached — nothing to generate.")
        return

    # ── Fetch pending ──
    pending = (
        sb.table("toc_tickets")
        .select("*")
        .in_("payment_status", ["PAID", "COMP"])
        .eq("generated", False)
        .execute()
        .data
    )

    if not pending:
        print("No new confirmed tickets to generate.")
        return

    print(f"Found {len(pending)} ticket(s) to generate.")
    vip_count = ga_count = 0

    for ticket in pending:
        ttype = ticket["ticket_type"]
        code  = ticket["ticket_code"]

        # Cap enforcement
        if ttype == "VIP" and ticket["payment_status"] != "COMP":
            if vip_generated + vip_count >= VIP_PAID_CAP:
                print(f"  ⚠  VIP cap ({VIP_PAID_CAP}) reached — skipping {code}")
                continue
        if ttype == "GA":
            if ga_generated + ga_count >= GA_CAP:
                print(f"  ⚠  GA cap ({GA_CAP}) reached — skipping {code}")
                continue

        # Determine filename
        num = ticket.get("ticket_number") or code.split("-")[-1]
        if ttype == "VIP":
            filename = f"VIP_{num.replace('VIP-','').zfill(3)}.pdf"
        else:
            filename = f"GA_{num.replace('GA-','').zfill(3)}.pdf"
        out_path = OUTPUT_DIR / filename

        print(f"  → Generating {filename} for {ticket.get('ticket_holder_name') or 'guest'}…", end=" ")
        try:
            pil_img = draw_ticket(ticket)
            save_as_pdf(pil_img, out_path)
        except Exception as e:
            print(f"ERROR: {e}")
            continue

        # Mark generated in Supabase
        now_iso = datetime.utcnow().isoformat() + "Z"
        sb.table("toc_tickets").update({
            "generated": True,
            "generated_at": now_iso,
            "print_file": filename
        }).eq("ticket_code", code).execute()

        if ttype == "VIP" and ticket["payment_status"] != "COMP":
            vip_count += 1
        elif ttype == "GA":
            ga_count += 1

        print("done")

    print()
    print(f"Generated: {vip_count} VIP (paid) · {ga_count} GA")
    print(f"VIP remaining: {VIP_PAID_CAP - vip_generated - vip_count} / {VIP_PAID_CAP}")
    print(f"GA remaining:  {GA_CAP - ga_generated - ga_count} / {GA_CAP}")
    print(f"Output folder: {OUTPUT_DIR.resolve()}")


if __name__ == "__main__":
    main()
