const cfg = window.AADS_CONFIG;
const supabaseClient = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

const startBtn = document.getElementById("startScanner");
const manualBtn = document.getElementById("manualCheckin");
const manualCode = document.getElementById("manualCode");
const scanResult = document.getElementById("scanResult");
const staffName = document.getElementById("staffName");

let scanner;

async function checkIn(ticketCode) {
  scanResult.className = "result";
  scanResult.textContent = "Checking ticket...";

  const { data, error } = await supabaseClient.rpc("check_in_ticket", {
    p_ticket_code: ticketCode.trim(),
    p_checked_in_by: staffName.value.trim() || "Door Staff"
  });

  if (error) {
    scanResult.className = "result error";
    scanResult.textContent = error.message;
    return;
  }

  scanResult.className = data.allowed ? "result success" : "result error";
  scanResult.textContent =
    `${data.allowed ? "VALID" : "STOP"}\n\n` +
    `Message: ${data.message}\n` +
    `Ticket: ${data.ticket_code || ticketCode}\n` +
    `Name: ${data.ticket_holder_name || "N/A"}\n` +
    `Type: ${data.ticket_type || "N/A"}\n` +
    `Table: ${data.table_number || ""}\n` +
    `Seat: ${data.seat_number || ""}`;
}

startBtn.addEventListener("click", async () => {
  if (scanner) return;
  scanner = new Html5Qrcode("reader");

  await scanner.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: 250 },
    async (decodedText) => {
      await scanner.pause(true);
      await checkIn(decodedText);
      setTimeout(() => scanner.resume(), 2500);
    }
  );
});

manualBtn.addEventListener("click", () => {
  if (!manualCode.value.trim()) return;
  checkIn(manualCode.value.trim());
});
