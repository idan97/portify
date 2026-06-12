// Vercel serverless proxy for today's USD->ILS exchange rate.
// Mirrors api/base44.js. Frankfurter is a free, key-less, ECB-backed API.
// Returns { rate, date }. Kept server-side for consistency and to dodge any
// future CORS changes.

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const upstream = await fetch(
      "https://api.frankfurter.dev/v1/latest?from=USD&to=ILS",
    );
    if (!upstream.ok) {
      res
        .status(502)
        .json({ error: `Rate provider returned ${upstream.status}` });
      return;
    }
    const body = await upstream.json();
    const rate = body?.rates?.ILS;
    if (typeof rate !== "number") {
      res.status(502).json({ error: "Rate provider returned no ILS rate" });
      return;
    }
    // Cache at the edge for an hour; the rate only changes once a day.
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
    res.status(200).json({ rate, date: body.date });
  } catch (error) {
    res
      .status(502)
      .json({ error: `Failed to reach rate provider: ${error.message}` });
  }
}
