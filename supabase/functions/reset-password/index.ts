import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

function normalizePhone(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.startsWith('255')) return digits;
  if (digits.startsWith('0')) return '255' + digits.slice(1);
  if (digits.length === 9) return '255' + digits;
  return digits;
}

// The app derives auth emails from the raw digits the user typed at signup,
// so try every common representation of the same number.
function emailCandidates(raw: string): string[] {
  const digits = (raw || '').replace(/\D/g, '');
  const nine = digits.startsWith('255') ? digits.slice(3) : digits.startsWith('0') ? digits.slice(1) : digits;
  const variants = new Set([digits, nine, '0' + nine, '255' + nine]);
  return [...variants].filter(Boolean).map((d) => `${d}@tucasa.local`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const { phone, otp, newPassword } = await req.json();
    if (!phone || !otp || !newPassword) return json({ error: 'Phone, OTP and new password are required' }, 400);
    if (String(newPassword).length < 6) return json({ error: 'Password must be at least 6 characters' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const normalized = normalizePhone(phone);
    const { data: row, error } = await supabase
      .from('otp_codes')
      .select('id, otp, expires_at')
      .eq('phone', normalized)
      .eq('verified', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!row) return json({ error: 'No OTP found. Request a new code.' }, 400);
    if (new Date(row.expires_at).getTime() < Date.now()) return json({ error: 'OTP has expired. Request a new code.' }, 400);
    if (String(row.otp) !== String(otp).trim()) return json({ error: 'Invalid OTP' }, 400);

    // Find the auth user for this phone number.
    const candidates = emailCandidates(phone);
    let userId: string | null = null;
    for (let page = 1; page <= 20 && !userId; page++) {
      const { data, error: listErr } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
      if (listErr) throw listErr;
      const found = data.users.find((u) => u.email && candidates.includes(u.email.toLowerCase()));
      if (found) userId = found.id;
      if (data.users.length < 200) break;
    }

    if (!userId) return json({ error: 'No account found for this phone number.' }, 404);

    const { error: updateErr } = await supabase.auth.admin.updateUserById(userId, { password: String(newPassword) });
    if (updateErr) throw updateErr;

    await supabase.from('otp_codes').update({ verified: true }).eq('id', row.id);

    return json({ success: true });
  } catch (err) {
    console.error('reset-password error:', err);
    return json({ error: (err as Error).message }, 500);
  }
});
