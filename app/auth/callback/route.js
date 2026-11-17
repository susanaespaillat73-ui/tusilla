import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

// Llega aquí desde el correo de confirmación o de cambio de contraseña.
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  let next = searchParams.get('next') || '/panel';
  if (!next.startsWith('/') || next.startsWith('//')) next = '/panel';

  if (code) {
    const supabase = supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/entrar?error=link`);
}
