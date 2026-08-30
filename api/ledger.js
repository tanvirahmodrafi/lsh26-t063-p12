// GET  /api/ledger?id=<ledgerId>          -> { state } | { state: null }
// PUT  /api/ledger  { id, state }         -> { ok: true }
// Persists each browser's ledger as one JSONB row in Neon Postgres (HTTP SQL API, no driver).

async function sql(query, params) {
  const cs = process.env.DATABASE_URL;
  if (!cs) throw new Error("DATABASE_URL not configured");
  const host = new URL(cs).hostname;
  const r = await fetch(`https://${host}/sql`, {
    method: "POST",
    headers: { "Neon-Connection-String": cs, "Content-Type": "application/json" },
    body: JSON.stringify({ query, params }),
  });
  if (!r.ok) throw new Error(`db: HTTP ${r.status} ${await r.text()}`);
  return r.json();
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  try {
    if (req.method === "GET") {
      const id = String(req.query.id || "").slice(0, 64);
      if (!id) { res.status(400).json({ error: "id required" }); return; }
      const d = await sql("SELECT state FROM ledgers WHERE id = $1", [id]);
      res.status(200).json({ state: d.rows[0]?.state ?? null });
      return;
    }
    if (req.method === "PUT" || req.method === "POST") {
      const { id, state } = req.body || {};
      if (!id || typeof state !== "object" || state === null) {
        res.status(400).json({ error: "id and state required" });
        return;
      }
      await sql(
        "INSERT INTO ledgers (id, state, updated_at) VALUES ($1, $2, now()) " +
        "ON CONFLICT (id) DO UPDATE SET state = $2, updated_at = now()",
        [String(id).slice(0, 64), JSON.stringify(state)]
      );
      res.status(200).json({ ok: true });
      return;
    }
    res.status(405).json({ error: "GET or PUT only" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
