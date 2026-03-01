import { NextResponse } from 'next/server';
import { echoProviderRequest } from '@/lib/services/echo';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const res = await echoProviderRequest(`/history/${id}/audio`);
    const blob = await res.blob();
    
    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'audio/mpeg',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
