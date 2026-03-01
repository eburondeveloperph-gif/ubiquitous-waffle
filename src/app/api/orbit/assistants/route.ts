import { NextResponse } from 'next/server';
import { fetchAssistants } from '@/lib/services/orbit';

export async function GET() {
  try {
    const list = await fetchAssistants();
    return NextResponse.json(Array.isArray(list) ? list : []);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[orbit/assistants]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
