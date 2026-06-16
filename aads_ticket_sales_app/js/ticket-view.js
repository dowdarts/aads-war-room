
const cfg = window.AADS_CONFIG;
const supabaseClient = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

const ticketCard = document.getElementById("ticketCard");
const printBtn = document.getElementById("printTicket");
const emailBtn = document.getElementById("emailTicket");

/*
  IMPORTANT:
  This file DOES NOT create new ticket numbers.
  It reads the exact issued ticket from Supabase using ticket_code.
  The printed ticket number, displayed ticket code, and QR code all come from that same ticket record.

  Source of truth:
  - tickets.ticket_code
  - tickets.qr_payload

  QR code content:
  - Uses tickets.qr_payload when present.
  - Falls back to tickets.ticket_code only if qr_payload is blank.
*/

function siteBase() {
  const fallback = window.location.origin + window.location.pathname.replace(/ticket\.html$/, "");
  return (cfg.SITE_URL || fallback).replace(/\/$/, "");
}

function ticketUrl(code) {
  return `${siteBase()}/ticket.html?code=${encodeURIComponent(code)}`;
}

function parseIssuedNumber(ticketCode, ticketType) {
  if (ticketType === "VIP") {
    const match = ticketCode.match(/-([0-9]{3})$/);
    return match ? Number(match[1]) : null;
  }

  const match = ticketCode.match(/GA-([0-9]{3})$/);
  return match ? Number(match[1]) : null;
}

function ticketNumberLabel(t) {
  const issuedNumber = parseIssuedNumber(t.ticket_code, t.ticket_type);

  if (!issuedNumber) {
    return t.ticket_code;
  }

  if (t.ticket_type === "VIP") {
    return `TICKET ${String(issuedNumber).padStart(2, "0")}/36`;
  }

  return `TICKET ${String(issuedNumber).padStart(2, "0")}/64`;
}

function stubTypeLabel(t) {
  const issuedNumber = parseIssuedNumber(t.ticket_code, t.ticket_type);

  if (t.ticket_type === "VIP") {
    return "VIP TABLE ENTRY";
  }

  return issuedNumber ? `GA ${String(issuedNumber).padStart(3, "0")}` : "GENERAL ADMISSION";
}

function leftRibbon(t) {
  return t.ticket_type === "VIP" ? "VIP TABLE" : "GENERAL ADMISSION";
}

function mainDetailLabel(t) {
  return t.ticket_type === "VIP" ? "Reserved For" : "Admit One";
}

function mainDetailLine(t) {
  if (t.ticket_type === "VIP") {
    return `Table ${t.table_number} · Seat ${t.seat_number} of 6`;
  }

  return "General Admission";
}

function stubMain(t) {
  return t.ticket_type === "VIP" ? `TABLE ${t.table_number}` : "GENERAL";
}

function stubSeat(t) {
  return t.ticket_type === "VIP" ? `SEAT ${t.seat_number} OF 6` : "ADMISSION";
}

function sponsorBlock(t) {
  const group = String(t.ticket_group || "").toLowerCase();

  if (group.includes("cgc")) {
    return "CGCDarts<br>VIP Table";
  }

  if (group.includes("pharmachoice") || group.includes("pharma")) {
    return "Amherst<br>PharmaChoice";
  }

  return t.ticket_type === "VIP" ? "AADS<br>VIP Table" : "Amherst<br>PharmaChoice";
}

async function loadTicket() {
  const codeFromUrl = new URLSearchParams(window.location.search).get("code");

  if (!codeFromUrl) {
    ticketCard.textContent = "Missing ticket code.";
    return;
  }

  const { data: t, error } = await supabaseClient
    .from("tickets")
    .select("*")
    .eq("ticket_code", codeFromUrl)
    .single();

  if (error || !t) {
    ticketCard.textContent = error?.message || "Ticket not found.";
    return;
  }

  const holderName = t.ticket_holder_name || "Ticket Holder";
  const qrPayload = t.qr_payload || t.ticket_code;
  const isPaid = t.payment_status === "PAID";

  ticketCard.innerHTML = `
    <div class="ticket-left">
      <div class="ticket-ribbon">${leftRibbon(t)}</div>
      <div class="toc-mark">TOC</div>
      <div class="toc-sub">Tournament<br>of Champions</div>
      <div class="series-mark">Atlantic<br><span>Amateur Darts</span>Series</div>
    </div>

    <div class="ticket-main">
      <div class="ticket-eyebrow">Atlantic Amateur Darts Series</div>
      <div class="ticket-title">Tournament<br>of Champions</div>

      <div class="info-panel">
        <div class="info-label">${mainDetailLabel(t)}</div>
        <div class="ticket-holder">${holderName}</div>

        <div class="info-label">${t.ticket_type === "VIP" ? "Table" : "Admission"}</div>
        <div class="ticket-detail-line">${mainDetailLine(t)}</div>
      </div>

      <div class="event-grid">
        <div class="event-box">
          <span class="info-label">Date</span><br>
          Saturday<br>
          <strong>July 25, 2026</strong><br>
          <strong>Doors Open 8 AM</strong>
        </div>

        <div class="event-box">
          <span class="info-label">Location</span><br>
          Club d'Age d'Or<br>
          <strong>Scoudouc, NB</strong>
        </div>

        <div class="event-box">
          <span class="info-label">Admission</span><br>
          ${t.ticket_type === "VIP" ? "Admit One<br><strong>VIP Guest</strong>" : "General<br><strong>Admission</strong>"}
        </div>
      </div>
    </div>

    <div class="ticket-stub">
      <div class="stub-number">${ticketNumberLabel(t)}</div>
      <div class="stub-type">${stubTypeLabel(t)}</div>
      <div class="stub-sponsor">${sponsorBlock(t)}</div>
      <div class="stub-main">${stubMain(t)}</div>
      <div class="stub-seat">${stubSeat(t)}</div>
      <div class="qr-wrap"><canvas id="qrcode"></canvas></div>
      <div class="ticket-code">${t.ticket_code}</div>
      ${qrPayload !== t.ticket_code ? `<div class="ticket-code">QR: ${qrPayload}</div>` : ""}
      ${isPaid ? "" : `<div class="payment-warning">PENDING PAYMENT</div>`}
    </div>
  `;

  QRCode.toCanvas(document.getElementById("qrcode"), qrPayload, {
    width: 160,
    margin: 1,
    color: {
      dark: "#000000",
      light: "#ffffff"
    }
  });

  emailBtn.onclick = () => {
    const email = t.purchaser_email || "";
    const subject = encodeURIComponent("Your AADS Tournament of Champions Ticket");
    const body = encodeURIComponent(
      `Here is your AADS Tournament of Champions ticket link:\n\n${ticketUrl(t.ticket_code)}\n\nAttendee: ${holderName}\nTicket: ${t.ticket_code}\nQR Code Payload: ${qrPayload}\n\nPlease bring this ticket to the event. Doors open at 8 AM.`
    );

    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };
}

printBtn.addEventListener("click", () => window.print());
loadTicket();
