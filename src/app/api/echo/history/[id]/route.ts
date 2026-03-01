import { NextResponse } from 'next/server';
import { echoProviderRequest } from '@/lib/services/echo';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'mp3';

    if (format === 'wav') {
      const res = await echoProviderRequest('/history/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history_item_ids: [id], output_format: 'wav' }),
      });
      const blob = await res.blob();
      return new NextResponse(blob, {
        headers: {
          'Content-Type': 'audio/wav',
          'Content-Disposition': `attachment; filename="tts_${id}.wav"`,
        },
      });
    }

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
