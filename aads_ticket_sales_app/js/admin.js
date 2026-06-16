const cfg = window.AADS_CONFIG;
const supabaseClient = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

const email = document.getElementById("email");
const sendMagicLink = document.getElementById("sendMagicLink");
const loadAdmin = document.getElementById("loadAdmin");
const adminResult = document.getElementById("adminResult");

sendMagicLink.addEventListener("click", async () => {
  const { error } = await supabaseClient.auth.signInWithOtp({
    email: email.value.trim()
  });

  adminResult.className = error ? "result error" : "result success";
  adminResult.textContent = error ? error.message : "Check your email for the login link.";
});

loadAdmin.addEventListener("click", async () => {
  adminResult.textContent = "Loading...";

  const [{ data: tickets, error: ticketError }, { data: orders, error: orderError }] = await Promise.all([
    supabaseClient.from("tickets").select("ticket_type,sold_status,payment_status,checked_in").limit(500),
    supabaseClient.from("orders").select("id,purchaser_name,purchaser_email,total_amount,order_status,payment_status,created_at").order("created_at", { ascending: false }).limit(20)
  ]);

  if (ticketError || orderError) {
    adminResult.className = "result error";
    adminResult.textContent = (ticketError || orderError).message;
    return;
  }

  const counts = tickets.reduce((acc, t) => {
    const key = `${t.ticket_type}_${t.sold_status}_${t.payment_status}_${t.checked_in ? "IN" : "OUT"}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  adminResult.className = "result";
  adminResult.textContent =
    "Ticket Counts:\n" +
    JSON.stringify(counts, null, 2) +
    "\n\nRecent Orders:\n" +
    orders.map(o => `${o.created_at} · ${o.purchaser_name} · $${o.total_amount} · ${o.payment_status} · ${o.order_status}`).join("\n");
});
