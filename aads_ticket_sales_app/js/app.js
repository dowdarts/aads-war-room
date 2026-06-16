const cfg = window.AADS_CONFIG;
const supabaseClient = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

const form = document.getElementById("ticketForm");
const ticketType = document.getElementById("ticketType");
const quantity = document.getElementById("quantity");
const quantityWrap = document.getElementById("quantityWrap");
const attendeeFields = document.getElementById("attendeeFields");
const orderSummary = document.getElementById("orderSummary");
const result = document.getElementById("result");

function ticketCount() {
  if (ticketType.value === "VIP_TABLE") return 6;
  return Math.max(1, Math.min(10, Number(quantity.value || 1)));
}

function renderAttendees() {
  if (ticketType.value === "VIP_TABLE") {
    quantityWrap.style.display = "none";
    quantity.value = 1;
  } else {
    quantityWrap.style.display = "";
  }

  const count = ticketCount();
  attendeeFields.innerHTML = "";

  for (let i = 1; i <= count; i++) {
    const row = document.createElement("div");
    row.className = "attendee-row";
    row.innerHTML = `
      <strong>${ticketType.value === "VIP_TABLE" ? "Seat" : "Ticket"} ${i}</strong>
      <input name="attendee_${i}" required placeholder="Attendee full name" />
    `;
    attendeeFields.appendChild(row);
  }

  const total = ticketType.value === "VIP_TABLE" ? cfg.VIP_TABLE_PRICE : count * cfg.GA_PRICE;
  orderSummary.textContent = `Total: $${total.toFixed(2)} · ${count} ticket${count === 1 ? "" : "s"}`;
}

ticketType.addEventListener("change", renderAttendees);
quantity.addEventListener("input", renderAttendees);
renderAttendees();

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  result.className = "result";
  result.textContent = "Reserving tickets...";

  const data = new FormData(form);
  const count = ticketCount();
  const attendee_names = [];

  for (let i = 1; i <= count; i++) {
    const name = String(data.get(`attendee_${i}`) || "").trim();
    if (!name) {
      result.className = "result error";
      result.textContent = `Missing attendee name for ticket ${i}.`;
      return;
    }
    attendee_names.push(name);
  }

  const payload = {
    p_purchaser_name: String(data.get("purchaser_name")).trim(),
    p_purchaser_email: String(data.get("purchaser_email")).trim(),
    p_purchaser_phone: String(data.get("purchaser_phone") || "").trim(),
    p_ticket_type: ticketType.value,
    p_attendee_names: attendee_names
  };

  const rpcName = ticketType.value === "VIP_TABLE" ? "reserve_vip_table" : "reserve_ga_tickets";
  const { data: rpcData, error } = await supabaseClient.rpc(rpcName, payload);

  if (error) {
    result.className = "result error";
    result.textContent = error.message;
    return;
  }

  result.className = "result success";
  result.textContent =
    "Tickets reserved successfully.\n\n" +
    "Order ID: " + rpcData.order_id + "\n" +
    "Status: PENDING PAYMENT\n\n" +
    "Tickets:\n" +
    rpcData.tickets.map(t => `- ${t.ticket_code} · ${t.ticket_holder_name}`).join("\n") +
    "\n\nSend payment by e-transfer. Tickets become valid after payment is confirmed.";
});
