"use client";

import { useState } from "react";
import {
  Phone,
  Copy,
  AudioWaveform,
  Mic,
  Volume2,
  Users,
  PhoneCall,
  Zap,
  BookOpen,
  Terminal,
  Key,
  Play,
} from "lucide-react";

const INBOUND_CALL_NUMBER = "+1 (844) 418 2027";

interface DocsPaneProps {
  apiBaseUrl: string;
  onCopyFeedback: (msg: string) => void;
}

type DocTab = "documentation" | "api-reference";

type Param = { name: string; type: string; required?: boolean };

const ENDPOINTS = [
  {
    id: "tts",
    category: "TTS",
    title: "Text to Speech",
    method: "POST",
    path: "/echo/tts",
    fullPath: "/api/echo/tts",
    desc: "Converts text to natural speech. Returns an audio blob (MP3, WAV, or PCM).",
    params: [
      { name: "voiceId", type: "string", required: true },
      { name: "text", type: "string", required: true },
      { name: "modelId", type: "string", required: true },
      { name: "outputFormat", type: "string", required: true },
    ] as Param[],
    responseStatus: "200 OK",
    responseExample: { type: "audio/mpeg", blob: "..." },
    examples: {
      curl: (base: string) => `curl -X POST "${base}/echo/tts" \\
  -H "Content-Type: application/json" \\
  -d '{"voiceId":"EXAVITQu4vr4xnSDxMaL","text":"Hello world","modelId":"echo_flash_v2.5","outputFormat":"mp3_44100_128"}' \\
  --output audio.mp3`,
      js: (base: string) => `const res = await fetch("${base}/echo/tts", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    voiceId: "EXAVITQu4vr4xnSDxMaL",
    text: "Hello world",
    modelId: "echo_flash_v2.5",
    outputFormat: "mp3_44100_128"
  })
});
const blob = await res.blob();`,
      py: (base: string) => `import requests
r = requests.post("${base}/echo/tts", json={
    "voiceId": "EXAVITQu4vr4xnSDxMaL",
    "text": "Hello world",
    "modelId": "echo_flash_v2.5",
    "outputFormat": "mp3_44100_128"
})
with open("audio.mp3", "wb") as f:
    f.write(r.content)`,
    },
  },
  {
    id: "stt",
    category: "Speech",
    title: "Speech to Text",
    method: "POST",
    path: "/echo/stt",
    fullPath: "/api/echo/stt",
    desc: "Transcribes audio to text. Send as multipart form data with a file field.",
    params: [{ name: "file", type: "File (multipart)", required: true }] as Param[],
    responseStatus: "200 OK",
    responseExample: { text: "Hello world" },
    examples: {
      curl: (base: string) => `curl -X POST "${base}/echo/stt" -F "file=@audio.mp3"`,
      js: (base: string) => `const fd = new FormData();
fd.append("file", audioFile);
const res = await fetch("${base}/echo/stt", { method: "POST", body: fd });`,
      py: (base: string) => `r = requests.post("${base}/echo/stt", files={"file": open("audio.mp3", "rb")})`,
    },
  },
  {
    id: "clone",
    category: "Voice",
    title: "Voice Cloning",
    method: "POST",
    path: "/echo/clone",
    fullPath: "/api/echo/clone",
    desc: "Creates a custom voice from audio samples. Send name and files as multipart form data.",
    params: [
      { name: "name", type: "string", required: true },
      { name: "files", type: "File[]", required: true },
    ] as Param[],
    responseStatus: "200 OK",
    responseExample: { voice_id: "..." },
    examples: {
      curl: (base: string) => `curl -X POST "${base}/echo/clone" \\
  -F "name=My Voice" -F "files=@sample1.mp3" -F "files=@sample2.mp3"`,
      js: (base: string) => `const fd = new FormData();
fd.append("name", "My Voice");
fd.append("files", file1);
fd.append("files", file2);
await fetch("${base}/echo/clone", { method: "POST", body: fd });`,
      py: (base: string) => `r = requests.post("${base}/echo/clone", files=[("files", open("s.mp3", "rb"))], data={"name": "My Voice"})`,
    },
  },
  {
    id: "assistants",
    category: "Agents",
    title: "List Assistants",
    method: "GET",
    path: "/orbit/assistants",
    fullPath: "/api/orbit/assistants",
    desc: "Returns all configured voice agents.",
    params: null,
    responseStatus: "200 OK",
    responseExample: { assistants: [{ id: "asst_xxx", name: "..." }] },
    examples: {
      curl: (base: string) => `curl "${base}/orbit/assistants"`,
      js: (base: string) => `const res = await fetch("${base}/orbit/assistants");`,
      py: (base: string) => `r = requests.get("${base}/orbit/assistants")`,
    },
  },
  {
    id: "call",
    category: "Calls",
    title: "Create Call",
    method: "POST",
    path: "/orbit/call",
    fullPath: "/api/orbit/call",
    desc: "Initiates an outbound phone call to the specified customer number.",
    params: [
      { name: "assistantId", type: "string", required: true },
      { name: "customerNumber", type: "string (E.164)", required: true },
    ] as Param[],
    responseStatus: "201 Created",
    responseExample: { id: "call_xxx", status: "ringing" },
    examples: {
      curl: (base: string) => `curl -X POST "${base}/orbit/call" \\
  -H "Content-Type: application/json" \\
  -d '{"assistantId":"asst_xxx","customerNumber":"+15551234567"}'`,
      js: (base: string) => `await fetch("${base}/orbit/call", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ assistantId: "asst_xxx", customerNumber: "+15551234567" })
});`,
      py: (base: string) => `requests.post("${base}/orbit/call", json={"assistantId":"asst_xxx","customerNumber":"+15551234567"})`,
    },
  },
  {
    id: "calls",
    category: "Calls",
    title: "List Calls",
    method: "GET",
    path: "/orbit/calls",
    fullPath: "/api/orbit/calls",
    desc: "Returns call history. Supports limit, assistantId, and phoneNumberId query parameters.",
    params: null,
    responseStatus: "200 OK",
    responseExample: { calls: [{ id: "call_xxx", type: "outboundPhoneCall" }] },
    examples: {
      curl: (base: string) => `curl "${base}/orbit/calls?limit=100"`,
      js: (base: string) => `const res = await fetch("${base}/orbit/calls?limit=100");`,
      py: (base: string) => `r = requests.get("${base}/orbit/calls", params={"limit": 100})`,
    },
  },
] as const;

const CATEGORIES = [...new Set(ENDPOINTS.map((e) => e.category))];

export default function DocsPane({ apiBaseUrl, onCopyFeedback }: DocsPaneProps) {
  const [docTab, setDocTab] = useState<DocTab>("documentation");
  const [selectedId, setSelectedId] = useState<string>("tts");
  const [codeTab, setCodeTab] = useState<Record<string, "curl" | "js" | "py">>({});

  const selected = ENDPOINTS.find((e) => e.id === selectedId) ?? ENDPOINTS[0];
  const currentCodeTab = (codeTab[selected.id] ?? "curl") as "curl" | "js" | "py";

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    onCopyFeedback("Copied!");
  };

  return (
    <div className="docs-v2">
      {/* Top nav tabs */}
      <nav className="docs-nav">
        <button
          type="button"
          className={`docs-nav-tab ${docTab === "documentation" ? "active" : ""}`}
          onClick={() => setDocTab("documentation")}
        >
          Documentation
        </button>
        <button
          type="button"
          className={`docs-nav-tab ${docTab === "api-reference" ? "active" : ""}`}
          onClick={() => setDocTab("api-reference")}
        >
          API Reference
        </button>
      </nav>

      {docTab === "documentation" && (
        <div className="docs-doc-content">
          <header className="docs-hero">
            <h1 className="docs-hero-title">Voice AI Platform</h1>
            <p className="docs-hero-subtitle">
              Build voice experiences with Text-to-Speech, Speech-to-Text, Voice Cloning, and AI-powered phone agents.
            </p>
          </header>

          <section className="docs-section">
            <h2 className="docs-section-title">Key Capabilities</h2>
            <div className="docs-card-grid docs-card-grid-3">
              <div className="docs-card">
                <div className="docs-card-icon">
                  <AudioWaveform size={24} className="text-lime" />
                </div>
                <h3 className="docs-card-title">Text-to-Speech</h3>
                <p className="docs-card-desc">Generate lifelike speech from text with multiple voices and models.</p>
              </div>
              <div className="docs-card">
                <div className="docs-card-icon">
                  <Mic size={24} className="text-lime" />
                </div>
                <h3 className="docs-card-title">Speech-to-Text</h3>
                <p className="docs-card-desc">Transcribe audio to text with high accuracy.</p>
              </div>
              <div className="docs-card">
                <div className="docs-card-icon">
                  <Volume2 size={24} className="text-lime" />
                </div>
                <h3 className="docs-card-title">Voice Cloning</h3>
                <p className="docs-card-desc">Create custom voices from samples.</p>
              </div>
              <div className="docs-card">
                <div className="docs-card-icon">
                  <Users size={24} className="text-lime" />
                </div>
                <h3 className="docs-card-title">AI Agents</h3>
                <p className="docs-card-desc">Create and deploy voice AI assistants.</p>
              </div>
              <div className="docs-card">
                <div className="docs-card-icon">
                  <PhoneCall size={24} className="text-lime" />
                </div>
                <h3 className="docs-card-title">Phone Integration</h3>
                <p className="docs-card-desc">Inbound and outbound phone calls.</p>
              </div>
              <div className="docs-card">
                <div className="docs-card-icon">
                  <Zap size={24} className="text-lime" />
                </div>
                <h3 className="docs-card-title">Real-time</h3>
                <p className="docs-card-desc">Sub-600ms response times with live transcription.</p>
              </div>
            </div>
          </section>

          <section className="docs-section">
            <h2 className="docs-section-title">Test Inbound Call</h2>
            <p className="docs-section-desc">Dial this number from your phone to test the configured inbound line.</p>
            <div className="docs-call-card">
              <div className="docs-call-card-inner">
                <Phone size={32} className="text-lime docs-call-icon" />
                <div className="docs-call-number">{INBOUND_CALL_NUMBER}</div>
                <div className="docs-call-actions">
                  <a href={`tel:${INBOUND_CALL_NUMBER.replace(/\s/g, "")}`} className="btn primary docs-call-btn">
                    <Phone size={18} />
                    Call now
                  </a>
                  <button
                    type="button"
                    className="btn docs-call-btn"
                    onClick={() => copyToClipboard(INBOUND_CALL_NUMBER.replace(/\s/g, ""))}
                  >
                    <Copy size={18} />
                    Copy number
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="docs-section">
            <h2 className="docs-section-title">Quick Start</h2>
            <p className="docs-section-desc">
              Base URL: <code className="docs-inline-code">{apiBaseUrl}</code>
            </p>
            <div className="docs-quick-start">
              <div className="docs-quick-step">
                <span className="docs-quick-num">1</span>
                <div>
                  <strong>Configure environment</strong> — Set your provider keys in .env (see Configuration below)
                </div>
              </div>
              <div className="docs-quick-step">
                <span className="docs-quick-num">2</span>
                <div>
                  <strong>Generate speech</strong> — POST to <code className="docs-inline-code">/echo/tts</code> with voiceId, text, modelId
                </div>
              </div>
              <div className="docs-quick-step">
                <span className="docs-quick-num">3</span>
                <div>
                  <strong>Create agents</strong> — Use the dashboard or API, then place calls via <code className="docs-inline-code">/orbit/call</code>
                </div>
              </div>
            </div>
          </section>

          <section className="docs-section">
            <h2 className="docs-section-title">Popular Use Cases</h2>
            <div className="docs-card-grid docs-card-grid-2">
              <div className="docs-card docs-card-compact">
                <BookOpen size={20} className="text-lime" />
                <div>
                  <h3 className="docs-card-title">Customer Support</h3>
                  <p className="docs-card-desc">Automate inbound support with agents that escalate when needed.</p>
                </div>
              </div>
              <div className="docs-card docs-card-compact">
                <PhoneCall size={20} className="text-lime" />
                <div>
                  <h3 className="docs-card-title">Sales & Lead Qualification</h3>
                  <p className="docs-card-desc">Make outbound calls, qualify leads, and schedule appointments.</p>
                </div>
              </div>
              <div className="docs-card docs-card-compact">
                <Terminal size={20} className="text-lime" />
                <div>
                  <h3 className="docs-card-title">IVR & Routing</h3>
                  <p className="docs-card-desc">Replace traditional IVR with natural language routing.</p>
                </div>
              </div>
              <div className="docs-card docs-card-compact">
                <Volume2 size={20} className="text-lime" />
                <div>
                  <h3 className="docs-card-title">Voice Content</h3>
                  <p className="docs-card-desc">Generate audiobooks, podcasts, and localized content.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="docs-section docs-section-last">
            <h2 className="docs-section-title">Configuration</h2>
            <div className="docs-config-grid">
              <div className="docs-config-item">
                <Key size={18} className="text-lime" />
                <div>
                  <code className="docs-inline-code">TTS_PROVIDER_KEY</code>
                  <p className="docs-config-desc">TTS/STT provider API key</p>
                </div>
              </div>
              <div className="docs-config-item">
                <Key size={18} className="text-lime" />
                <div>
                  <code className="docs-inline-code">ORBIT_SECRET</code>
                  <p className="docs-config-desc">API key for voice agents and calls</p>
                </div>
              </div>
              <div className="docs-config-item">
                <Key size={18} className="text-lime" />
                <div>
                  <code className="docs-inline-code">PHONE_NUMBER_ID</code>
                  <p className="docs-config-desc">Phone number ID for outbound calls</p>
                </div>
              </div>
              <div className="docs-config-item">
                <Key size={18} className="text-lime" />
                <div>
                  <code className="docs-inline-code">NEXT_PUBLIC_ORBIT_TOKEN</code>
                  <p className="docs-config-desc">Client-side public key for web calls</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {docTab === "api-reference" && (
        <div className="docs-api-wrapper">
          <div className="docs-base-bar">
            <span className="docs-base-label">Base URL</span>
            <code className="docs-base-url">{apiBaseUrl}</code>
            <button
              type="button"
              className="docs-base-copy"
              onClick={() => copyToClipboard(apiBaseUrl)}
              title="Copy base URL"
            >
              <Copy size={14} />
            </button>
          </div>
          <div className="docs-api-layout">
          <aside className="docs-sidebar">
            {CATEGORIES.map((cat) => (
              <div key={cat} className="docs-sidebar-group">
                <div className="docs-sidebar-group-title">{cat}</div>
                {ENDPOINTS.filter((e) => e.category === cat).map((ep) => (
                  <button
                    key={ep.id}
                    type="button"
                    className={`docs-sidebar-item ${selectedId === ep.id ? "active" : ""}`}
                    onClick={() => setSelectedId(ep.id)}
                  >
                    <span className={`docs-method-badge docs-method-${ep.method.toLowerCase()}`}>{ep.method}</span>
                    <span className="docs-sidebar-label">{ep.title}</span>
                  </button>
                ))}
              </div>
            ))}
          </aside>

          {/* Main content */}
          <main className="docs-api-main">
            <div className="docs-endpoint-header">
              <div className="docs-endpoint-title-row">
                <h1 className="docs-endpoint-title">{selected.title}</h1>
                <span className={`docs-method-badge docs-method-${selected.method.toLowerCase()}`}>{selected.method}</span>
              </div>
              <code className="docs-endpoint-url">{apiBaseUrl}{selected.path}</code>
            </div>

            <section className="docs-api-section">
              <h3 className="docs-api-section-title">Authentication</h3>
              <p className="docs-api-section-desc">
                Include your API key in the <code className="docs-code-inline">Authorization</code> header as a Bearer token.
                Retrieve your key from the dashboard.
              </p>
              <div className="docs-auth-example">
                <code>Authorization: Bearer YOUR_API_KEY</code>
              </div>
            </section>

            {selected.params && selected.params.length > 0 && (
              <section className="docs-api-section">
                <h3 className="docs-api-section-title">Request</h3>
                <p className="docs-api-section-desc">{selected.desc}</p>
                <div className="docs-params-table">
                  <div className="docs-params-header">
                    <span>Parameter</span>
                    <span>Type</span>
                    <span>Required</span>
                  </div>
                  {selected.params.map((p) => (
                    <div key={p.name} className="docs-param-row">
                      <code className="docs-param-name">{p.name}</code>
                      <span className="docs-param-type">{p.type}</span>
                      <span className={`docs-param-badge ${p.required ? "required" : "optional"}`}>
                        {p.required ? "Required" : "Optional"}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div className="docs-code-response-row">
              <div className="docs-code-block">
                <div className="docs-code-header">
                  <span className="docs-code-method">{selected.method} {selected.path}</span>
                  <div className="docs-code-actions">
                    <select
                      value={currentCodeTab}
                      onChange={(e) => setCodeTab((p) => ({ ...p, [selected.id]: e.target.value as "curl" | "js" | "py" }))}
                      className="docs-code-select"
                      title="Code language"
                      aria-label="Code language"
                    >
                      <option value="curl">cURL</option>
                      <option value="js">JavaScript</option>
                      <option value="py">Python</option>
                    </select>
                    <button type="button" className="docs-code-copy" onClick={() => copyToClipboard(selected.examples[currentCodeTab](apiBaseUrl))} title="Copy">
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
                <pre className="docs-code-pre">{selected.examples[currentCodeTab](apiBaseUrl)}</pre>
                <button type="button" className="docs-try-btn">
                  <Play size={14} />
                  Try it
                </button>
              </div>

              <div className="docs-response-block">
                <div className="docs-response-header">
                  <span className="docs-response-status">{selected.responseStatus}</span>
                  <button type="button" className="docs-code-copy" onClick={() => copyToClipboard(JSON.stringify(selected.responseExample, null, 2))} title="Copy">
                    <Copy size={14} />
                  </button>
                </div>
                <pre className="docs-response-pre">{JSON.stringify(selected.responseExample, null, 2)}</pre>
              </div>
            </div>
          </main>
          </div>
        </div>
      )}
    </div>
  );
}
