// Vercel Serverless Function: Supabase Keep-Alive Cron
// Periodically fetches 1 row from Supabase to prevent the free-tier database from pausing due to inactivity.

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Optional: If you configure CRON_SECRET in Vercel project environment variables,
  // Vercel automatically passes it in the Authorization header.
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized cron invocation' });
    }
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Keep-alive ping failed: Supabase URL or Anon Key is missing.');
    return res.status(500).json({
      error: 'Supabase credentials are not configured on the server. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in Vercel.'
    });
  }

  try {
    // Ping Supabase PostgREST endpoint (reads 1 row from profiles table)
    const response = await fetch(`${supabaseUrl}/rest/v1/profiles?select=id&limit=1`, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Supabase keep-alive returned error (${response.status}):`, errorText);
      return res.status(response.status).json({
        error: `Supabase returned status ${response.status}`,
        details: errorText
      });
    }

    const data = await response.json();

    return res.status(200).json({
      status: 'ok',
      message: 'Supabase keep-alive ping successful',
      rowsRetrieved: Array.isArray(data) ? data.length : 1,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Unexpected keep-alive error:', error);
    return res.status(500).json({
      error: 'Failed to communicate with Supabase',
      details: error.message
    });
  }
}
