import { NextResponse } from 'next/server';
import { createAgent, createAssistantFromScratch, updateAssistant, toNova2Language } from '@/lib/services/orbit';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Update existing assistant when assistantId is provided
    if (body.assistantId && body.name && (body.systemPrompt ?? body.firstMessage)) {
      const voice = body.voice
        ? { provider: body.voice.provider || '11labs', voiceId: body.voice.voiceId }
        : undefined;
      const result = await updateAssistant(body.assistantId, {
        name: body.name,
        firstMessage: body.firstMessage || undefined,
        model: {
          messages: [
            { role: 'system', content: body.systemPrompt || 'You are a helpful AI assistant.' },
          ],
        },
        ...(voice && { voice: voice }),
        ...(body.language && {
          transcriber: { language: toNova2Language(body.language) },
        }),
      });
      return NextResponse.json(result);
    }
    // Create from scratch when assistantId is not provided
    if (!body.assistantId && body.name && (body.systemPrompt ?? body.firstMessage)) {
      const result = await createAssistantFromScratch({
        name: body.name,
        firstMessage: body.firstMessage || '',
        systemPrompt: body.systemPrompt || 'You are a helpful AI assistant.',
        language: body.language,
        voice: body.voice,
      });
      return NextResponse.json(result);
    }
    // Clone from existing assistant
    const result = await createAgent(body);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
