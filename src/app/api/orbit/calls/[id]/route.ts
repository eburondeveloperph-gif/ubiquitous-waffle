import { NextResponse } from 'next/server';
import { fetchCallById } from '@/lib/services/orbit';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Call ID required' }, { status: 400 });
    }
    const call = await fetchCallById(id);
    return NextResponse.json(call);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
