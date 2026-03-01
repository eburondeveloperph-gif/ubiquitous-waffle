import { NextResponse } from 'next/server';
import { generateTTS } from '@/lib/services/echo';

export async function POST(req: Request) {
  try {
    const { voiceId, text, modelId, outputFormat } = await req.json();
    const blob = await generateTTS(voiceId, text, modelId, outputFormat);
    return new Response(blob, {
      headers: { 'Content-Type': 'audio/mpeg' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
