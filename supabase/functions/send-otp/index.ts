import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

function normalizePhone(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.startsWith('255')) return digits;
  if (digits.startsWith('0')) return '255' + digits.slice(1);
  if (digits.length === 9) return '255' + digits;
  return digits;
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Every representation of the same number that may be stored on a profile.
function phoneVariants(raw: string): string[] {
  const digits = (raw || '').replace(/\D/g, '');
  const nine = digits.startsWith('255') ? digits.slice(3) : digits.startsWith('0') ? digits.slice(1) : digits;
  return [...new Set([digits, nine, '0' + nine, '255' + nine, '+255' + nine])].filter(Boolean);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { phone, purpose } = await req.json();
    if (!phone || typeof phone !== 'string') {
      return new Response(JSON.stringify({ error: 'Phone is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const normalized = normalizePhone(phone);
    if (normalized.length < 12) {
      return new Response(JSON.stringify({ error: 'Invalid phone number' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const otp = generateOTP();
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Password reset OTPs may only go to a phone number that exists on a profile.
    if (purpose === 'reset') {
      const { data: match, error: lookupErr } = await supabase
        .from('profiles')
        .select('id')
        .in('phone', phoneVariants(phone))
        .limit(1)
        .maybeSingle();
      if (lookupErr) throw lookupErr;
      if (!match) {
        return new Response(
          JSON.stringify({ error: 'This phone number is not registered. Use the number in your membership details.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    const { error: insertErr } = await supabase.from('otp_codes').insert({
      phone: normalized, otp, verified: false,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });
    if (insertErr) throw insertErr;

    const username = Deno.env.get('NEXTSMS_USERNAME')!;
    const password = Deno.env.get('NEXTSMS_PASSWORD')!;
    const senderId = Deno.env.get('NEXTSMS_SENDER_ID')!;
    const auth = btoa(`${username}:${password}`);

    const smsRes = await fetch('https://messaging-service.co.tz/api/sms/v1/text/single', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        from: senderId,
        to: normalized,
        text: `Your TUCASA STUM verification code is ${otp}. It expires in 5 minutes.`,
      }),
    });

    const smsBody = await smsRes.text();
    console.log('NextSMS response:', smsRes.status, smsBody);
    if (!smsRes.ok) {
      console.error('NextSMS error:', smsRes.status, smsBody);
      return new Response(JSON.stringify({ error: 'Failed to send SMS', details: smsBody }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, phone: normalized }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('send-otp error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
