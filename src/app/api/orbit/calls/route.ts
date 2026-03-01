import { NextResponse } from 'next/server';
import { fetchCalls } from '@/lib/services/orbit';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit');
    const assistantId = searchParams.get('assistantId') ?? undefined;
    const params: { limit?: number; assistantId?: string } = {};
    if (limit != null && limit !== '') params.limit = Number(limit);
    if (assistantId) params.assistantId = assistantId;
    const calls = await fetchCalls(Object.keys(params).length > 0 ? params : undefined);
    return NextResponse.json(calls);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
