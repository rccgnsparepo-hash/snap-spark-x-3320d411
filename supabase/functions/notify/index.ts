import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

type Body = {
  kind: 'post' | 'message' | 'story' | 'comment' | 'like';
  title?: string;
  message?: string;
  url?: string;
  actor?: { id?: string; handle?: string; display_name?: string };
  data?: Record<string, unknown>;
};

const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID');
const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY');
const NOTIFY_WEBHOOK_URL = Deno.env.get('NOTIFY_WEBHOOK_URL');

const defaultTitle = (k: Body['kind'], who: string) => {
  switch (k) {
    case 'post': return `${who} just flicked`;
    case 'message': return `${who} sent a message`;
    case 'story': return `${who} posted a story`;
    case 'comment': return `${who} commented`;
    case 'like': return `${who} liked your flick`;
  }
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = (await req.json()) as Body;
    const who = body.actor?.display_name || body.actor?.handle || 'Someone';
    const title = body.title ?? defaultTitle(body.kind, who);
    const message = body.message ?? '';
    const payload = { kind: body.kind, title, message, url: body.url ?? null, actor: body.actor ?? null, data: body.data ?? {}, at: new Date().toISOString() };
    const tasks: Promise<unknown>[] = [];
    if (NOTIFY_WEBHOOK_URL) {
      tasks.push(fetch(NOTIFY_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then((r) => r.text()).catch((e) => ({ err: String(e) })));
    }
    if (ONESIGNAL_APP_ID && ONESIGNAL_REST_API_KEY) {
      tasks.push(fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Basic ${ONESIGNAL_REST_API_KEY}` },
        body: JSON.stringify({
          app_id: ONESIGNAL_APP_ID,
          included_segments: ['All'],
          headings: { en: title },
          contents: { en: message || title },
          url: body.url ?? undefined,
          data: payload,
        }),
      }).then((r) => r.text()).catch((e) => ({ err: String(e) })));
    }
    const results = await Promise.all(tasks);
    return new Response(JSON.stringify({ ok: true, sent: results.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
  }
});