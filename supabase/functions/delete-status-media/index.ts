import { serve } from 'https://deno.land/std@0.201.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.102.1';

const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');

const jsonHeaders = {
  'content-type': 'application/json',
};

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  const authorization = req.headers.get('authorization') || '';
  if (!SERVICE_ROLE_KEY || authorization !== `Bearer ${SERVICE_ROLE_KEY}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch (_err) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const mediaPaths = Array.isArray(body?.media_path)
    ? body.media_path
    : typeof body?.media_path === 'string'
    ? [body.media_path]
    : [];

  if (mediaPaths.length === 0) {
    return new Response(JSON.stringify({ error: 'media_path is required' }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  if (!SUPABASE_URL) {
    return new Response(JSON.stringify({ error: 'Missing SUPABASE_URL environment variable' }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const results = [];
  let hasError = false;

  for (const mediaPath of mediaPaths) {
    const { error, data } = await client.storage.from('status-media').remove([mediaPath]);
    results.push({ media_path: mediaPath, error: error?.message || null, data });
    if (error) hasError = true;
  }

  return new Response(JSON.stringify({ success: !hasError, results }), {
    status: hasError ? 500 : 200,
    headers: jsonHeaders,
  });
});
