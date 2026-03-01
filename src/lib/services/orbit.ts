// Server-side only: use VAPI Private API Key for fetching/creating assistants.
// Do not use the public key here (that goes in NEXT_PUBLIC_ORBIT_TOKEN for the client SDK).
const SECRET =
  process.env.VAPI_PRIVATE_API_KEY ||
  process.env.ORBIT_SECRET ||
  process.env.VAPI_API_KEY ||
  '';

function getOrbitSecret() {
  return SECRET.trim();
}

export async function orbitCoreRequest(method: string, endpoint: string, payload: unknown = null) {
  const orbitSecret = getOrbitSecret();
  if (!orbitSecret) {
    throw new Error(
      'Missing VAPI private API key. Set VAPI_PRIVATE_API_KEY or ORBIT_SECRET in .env.local (server-side only).'
    );
  }

  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${orbitSecret}`,
    },
  };

  if (payload) {
    options.headers = {
      ...options.headers,
      'Content-Type': 'application/json',
    };
    options.body = JSON.stringify(payload);
  }

  const res = await fetch(`https://api.vapi.ai${endpoint}`, options);
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || "Orbit core Request failed");
  }
  return res.json();
}

export async function fetchAssistants() {
  // Keep the dashboard usable when Orbit is not configured.
  if (!getOrbitSecret()) return [];
  const raw = await orbitCoreRequest('GET', '/assistant');
  // VAPI returns an array; normalize in case of paginated/wrapped response.
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object' && Array.isArray((raw as { assistants?: unknown[] }).assistants)) {
    return (raw as { assistants: unknown[] }).assistants;
  }
  if (raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown[] }).data)) {
    return (raw as { data: unknown[] }).data;
  }
  return [];
}

export async function createAgent(payload: unknown) {
  return orbitCoreRequest('POST', '/assistant', payload);
}

/**
 * Create a new assistant from scratch (full CreateAssistantDTO).
 * Used when user provides name, firstMessage, model.messages (system prompt), etc.
 */
export async function createAssistantFromScratch(params: {
  name: string;
  firstMessage: string;
  systemPrompt: string;
  language?: string;
}) {
  const { name, firstMessage, systemPrompt, language } = params;
  const payload = {
    name,
    firstMessage: firstMessage || undefined,
    firstMessageMode: 'assistant-speaks-first' as const,
    model: {
      provider: 'openai' as const,
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system' as const, content: systemPrompt || 'You are a helpful AI assistant.' },
      ],
    },
    voice: {
      provider: '11labs' as const,
      voiceId: 'EXAVITQu4vr4xnSDxMaL', // Sarah - default ElevenLabs voice
    },
    transcriber: {
      provider: 'deepgram' as const,
      model: 'nova-2',
      language: language === 'multilingual' ? 'multi' : (language || 'en'),
    },
  };
  return orbitCoreRequest('POST', '/assistant', payload);
}

/**
 * Create an outbound phone call via VAPI (VAPI calls the customer's number).
 * Requires VAPI_PHONE_NUMBER_ID in .env (phone number to call FROM).
 */
export async function createOutboundCall(params: {
  assistantId: string;
  customerNumber: string;
}) {
  const phoneNumberId = (process.env.VAPI_PHONE_NUMBER_ID || '').trim();
  if (!phoneNumberId) {
    throw new Error(
      'Missing VAPI_PHONE_NUMBER_ID. Add a VAPI phone number ID from dashboard.vapi.ai to .env.local for outbound calls.'
    );
  }
  const e164 = params.customerNumber.startsWith('+')
    ? params.customerNumber
    : params.customerNumber.length === 10
      ? `+1${params.customerNumber}`
      : `+${params.customerNumber}`;
  const payload = {
    assistantId: params.assistantId,
    phoneNumberId,
    customer: { number: e164 },
  };
  return orbitCoreRequest('POST', '/call', payload);
}
