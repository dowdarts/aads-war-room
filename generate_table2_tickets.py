"""
One-off: regenerate the 6 VIP Table 2 ticket images as JPGs (matching the
existing print_file naming) since the original images still show
"CGCdarts" branding left over from before Corey/Cecil's tables were
merged into Table 1. Reuses the exact same draw_ticket() layout as
generate_tickets.py, but fetches over plain HTTP (the `supabase` python
package is broken in this environment) and outputs JPEG instead of PDF.

Run: python generate_table2_tickets.py
Output: ./generated_tickets/VIP_007.jpg ... VIP_012.jpg
"""

import json
import urllib.request
from pathlib import Path
import qrcode
from PIL import Image, ImageDraw, ImageFont

SUPABASE_URL = "https://gygwhznblajojwveikhg.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5Z3doem5ibGFqb2p3dmVpa2hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjU5NzgsImV4cCI6MjA4ODk0MTk3OH0.BI9KlRsCxAvNnFHCGq6hjXfdsaNgo7afY4Xa5uxwjak"
OUTPUT_DIR = Path("./generated_tickets")

EVENT_NAME = "AADS Tournament of Champions"
EVENT_SUBTITLE = "Presented by Amherst PharmaChoice"
EVENT_DATE = "Saturday, July 25, 2026"
EVENT_VENUE = "Club d'Age d'Or, Scoudouc, NB"

TW, TH = 1800, 900
BG = (5, 5, 5)
GOLD = (245, 197, 24)
WHITE = (245, 245, 245)
MUTED = (120, 120, 120)
ORANGE = (255, 122, 0)
PURPLE = (120, 80, 200)


def fetch_table2_tickets():
    url = f"{SUPABASE_URL}/rest/v1/toc_tickets?table_number=eq.2&select=*&order=seat_number.asc"
    req = urllib.request.Request(url, headers={
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    })
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def get_font(size: int, bold: bool = False):
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


def make_qr(data: str, size: int = 300) -> Image.Image:
    qr = qrcode.QRCode(version=3, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=8, border=2)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    return img.resize((size, size), Image.LANCZOS)


def draw_ticket(ticket: dict) -> Image.Image:
    img = Image.new("RGB", (TW, TH), BG)
    draw = ImageDraw.Draw(img)

    is_vip = ticket["ticket_type"] == "VIP"
    is_comp = ticket["payment_status"] == "COMP"
    accent = PURPLE if is_comp else (GOLD if is_vip else ORANGE)

    draw.rectangle([(0, 0), (12, TH)], fill=accent)
    lx = 48

    draw.text((lx, 48), EVENT_NAME.upper(), font=get_font(44, bold=True), fill=GOLD)
    draw.text((lx, 105), EVENT_SUBTITLE, font=get_font(22), fill=MUTED)
    draw.line([(lx, 145), (TW - 360, 145)], fill="#2a2a2a", width=1)

    type_label = "VIP TABLE" if not is_comp else "VIP COMP"
    detail = f"Table {ticket['table_number']} · Seat {ticket['seat_number']}"

    draw.text((lx, 162), type_label, font=get_font(52, bold=True), fill=accent)
    draw.text((lx, 228), detail, font=get_font(34), fill=WHITE)

    holder = ticket.get("ticket_holder_name") or ticket.get("purchaser_name") or ""
    if holder:
        draw.text((lx, 295), holder.upper(), font=get_font(40, bold=True), fill=WHITE)

    draw.text((lx, 365), f"Date: {EVENT_DATE}", font=get_font(28), fill=MUTED)
    draw.text((lx, 408), f"Venue: {EVENT_VENUE}", font=get_font(28), fill=MUTED)

    ticket_num = ticket.get("ticket_number") or ""
    try:
        num_int = int(ticket_num.replace("VIP-", ""))
        display = f"TICKET {num_int:02d} / 36 · {ticket_num}"
    except Exception:
        display = ticket_num
    draw.text((lx, 490), display, font=get_font(28, bold=True), fill=MUTED)
    draw.text((lx, TH - 64), ticket["ticket_code"], font=get_font(20), fill="#333")

    qr_img = make_qr(ticket["ticket_code"], size=300)
    qr_x = TW - 340
    qr_y = (TH - 300) // 2
    img.paste(qr_img, (qr_x, qr_y))

    bracelet_text = "VIP WRISTBAND"
    draw.text((qr_x, qr_y + 308), bracelet_text, font=get_font(20), fill=MUTED)
    draw.line([(TW - 360, 30), (TW - 360, TH - 30)], fill="#2a2a2a", width=1)

    return img


def main():
    OUTPUT_DIR.mkdir(exist_ok=True)
    tickets = fetch_table2_tickets()
    print(f"Fetched {len(tickets)} Table 2 tickets.")
    for ticket in tickets:
        filename = ticket["print_file"] or f"{ticket['ticket_number'].replace('-', '_')}.jpg"
        out_path = OUTPUT_DIR / filename
        img = draw_ticket(ticket)
        img.save(out_path, format="JPEG", quality=92)
        print(f"  -> {filename}  (seat {ticket['seat_number']}: {ticket.get('ticket_holder_name')})")
    print(f"\nDone. Files in: {OUTPUT_DIR.resolve()}")


if __name__ == "__main__":
    main()
