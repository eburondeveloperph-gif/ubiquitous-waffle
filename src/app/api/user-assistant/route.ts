import { NextResponse } from 'next/server';
import { createSupabaseClientFromRequest } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const supabase = createSupabaseClientFromRequest(request);
  if (!supabase) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { data, error } = await supabase
      .from('user_assistants')
      .select('assistant_id')
      .eq('user_id', user.id)
      .single();
    if (error && error.code !== 'PGRST116') {
      console.error('[user-assistant]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ assistantId: data?.assistant_id ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = createSupabaseClientFromRequest(request);
  if (!supabase) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json();
    const assistantId = body?.assistantId;
    if (!assistantId || typeof assistantId !== 'string') {
      return NextResponse.json({ error: 'assistantId required' }, { status: 400 });
    }
    const { error } = await supabase
      .from('user_assistants')
      .upsert(
        { user_id: user.id, assistant_id: assistantId, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
    if (error) {
      console.error('[user-assistant]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ assistantId });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
