import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const VAPID_PUBLIC = 'BN5VjE0Ct9ULD8vKkDojHlHI_4nBR8JNEGT9_lDFSL4KTKk41a39gGFTBBC_w-XULbnxt0txBXBUDNpt3PcvXMI';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@flick.app';

if (VAPID_PRIVATE) {
  try { webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE); } catch (e) { console.error('vapid setup failed', e); }
}

type Body = {
  user_ids: string[];
  title: string;
  body?: string;
  url?: string;
  kind?: string;
  dedupe_id?: string;
  data?: Record<string, unknown>;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (!VAPID_PRIVATE) {
      return new Response(JSON.stringify({ error: 'VAPID not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const input = (await req.json()) as Body;
    if (!input?.user_ids?.length || !input.title) {
      return new Response(JSON.stringify({ error: 'user_ids and title required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: subs, error } = await admin.from('push_subscriptions').select('id,endpoint,p256dh,auth').in('user_id', input.user_ids);
    if (error) throw error;

    const payload = JSON.stringify({
      title: input.title,
      body: input.body ?? '',
      url: input.url ?? '/',
      kind: input.kind ?? null,
      tag: input.dedupe_id ?? input.kind ?? 'flick',
      data: input.data ?? {},
    });

    const stale: string[] = [];
    let sent = 0;
    await Promise.all((subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } } as never, payload, { TTL: 60 });
        sent++;
      } catch (e: unknown) {
        const code = (e as { statusCode?: number })?.statusCode;
        if (code === 400 || code === 403 || code === 404 || code === 410) stale.push(s.id);
        else console.warn('push send failed', code, (e as Error).message);
      }
    }));
    if (stale.length) await admin.from('push_subscriptions').delete().in('id', stale);
    return new Response(JSON.stringify({ ok: true, sent, removed: stale.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});