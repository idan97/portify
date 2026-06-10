// Vercel serverless proxy for the one-time "Import from Base44" feature.
// The browser can't call app.base44.com directly (CORS), so this forwards
// entity reads using the api_key the user supplies in the Import screen.
// Nothing is stored server-side.

const ALLOWED_ENTITIES = new Set([
  'AssetClass',
  'Instrument',
  'Holding',
  'ManualAsset',
  'ManualAssetValue',
]);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { appId, entity } = req.query;
  const apiKey = req.headers['api_key'];

  if (!appId || !entity || !apiKey) {
    res.status(400).json({ error: 'appId, entity and api_key header are required' });
    return;
  }
  if (!/^[a-zA-Z0-9]+$/.test(appId) || !ALLOWED_ENTITIES.has(entity)) {
    res.status(400).json({ error: 'Invalid appId or entity' });
    return;
  }
  if (apiKey.length > 200 || !/^[\x20-\x7E]+$/.test(apiKey)) {
    res.status(400).json({ error: 'Invalid api_key format' });
    return;
  }

  try {
    const upstream = await fetch(
      `https://app.base44.com/api/apps/${appId}/entities/${entity}`,
      { headers: { api_key: apiKey, 'Content-Type': 'application/json' } }
    );
    const body = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.send(body);
  } catch (error) {
    res.status(502).json({ error: `Failed to reach Base44: ${error.message}` });
  }
}
