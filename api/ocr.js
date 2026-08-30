// POST { image: "data:image/...;base64,..." } -> { shop, date, amount_bdt, category, raw }
// Reads receipt fields via OpenRouter vision model. Key comes from OPENROUTER_API_KEY env var.

const MODELS = [
  "google/gemini-2.5-flash-lite",
  "google/gemini-2.5-flash",
];

const CATEGORIES = [
  "Clothing", "Education", "Entertainment", "Food", "Groceries",
  "Health", "Mobile", "Rent", "Transport", "Utilities",
];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    res.status(500).json({ error: "OPENROUTER_API_KEY not configured" });
    return;
  }
  const { image } = req.body || {};
  if (!image || !image.startsWith("data:image/")) {
    res.status(400).json({ error: "image must be a data URL" });
    return;
  }

  const prompt =
    `Read this receipt/bill photo. Extract exactly these fields and reply with ONLY a JSON object, no markdown:\n` +
    `{"shop": "<merchant/shop name>", "date": "<YYYY-MM-DD, the receipt date>", ` +
    `"amount_bdt": "<final total amount as a plain number string like 1234.50>", ` +
    `"category": "<best guess, one of: ${CATEGORIES.join(", ")}>"}\n` +
    `Amounts may be in Bangladeshi Taka. If a field is unreadable, use null for it.`;

  let lastErr = null;
  for (const model of MODELS) {
    try {
      const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: image } },
              ],
            },
          ],
          max_tokens: 300,
          temperature: 0,
        }),
      });
      if (!r.ok) {
        lastErr = `${model}: HTTP ${r.status} ${await r.text()}`;
        continue;
      }
      const data = await r.json();
      const text = data.choices?.[0]?.message?.content || "";
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) {
        lastErr = `${model}: no JSON in response`;
        continue;
      }
      const parsed = JSON.parse(match[0]);
      res.status(200).json({
        shop: parsed.shop ?? null,
        date: parsed.date ?? null,
        amount_bdt: parsed.amount_bdt != null ? String(parsed.amount_bdt) : null,
        category: CATEGORIES.includes(parsed.category) ? parsed.category : null,
        model,
        raw: text,
      });
      return;
    } catch (e) {
      lastErr = `${model}: ${e.message}`;
    }
  }
  res.status(502).json({ error: `OCR failed: ${lastErr}` });
}
