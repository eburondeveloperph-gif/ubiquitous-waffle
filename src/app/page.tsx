"use client";
// cspell:ignore supabase SUPABASE Bicolano Bhojpuri

import { useState, useEffect, useRef, useMemo, useCallback, useId } from "react";
import {
  AudioWaveform,
  Mic,
  Copy,
  Users,
  History,
  BookOpen,
  Settings as SettingsIcon,
  Sun,
  Moon,
  Download,
  Play,
  Key,
  Loader2,
  PhoneOff,
  Volume2,
  Phone,
  Upload,
  RefreshCw
} from "lucide-react";

import OrbitCore from "@vapi-ai/web";
import { Voice, UserTtsHistoryItem } from "@/lib/services/echo";
import { enhanceTextForTTS, normalizeForTTS, BREAK_TAG } from "@/lib/tts-enhancer";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";

// type Voice moved to echo.ts

const orbit = typeof window !== "undefined" ? new OrbitCore(process.env.NEXT_PUBLIC_ORBIT_TOKEN || "") : null;

const languageDialectMap: Record<string, string[]> = {
  "Filipino": ["Cebuano", "Tagalog", "Ilocano", "Bicolano"],
  "English": ["USA", "UK", "Australia", "Canada", "India", "Ireland"],
  "Spanish": ["Spain", "Mexico", "Argentina", "Colombia"],
  "French": ["France", "Canada", "Belgium"],
  "German": ["Germany", "Switzerland", "Austria"],
  "Hindi": ["Standard Hindi", "Bhojpuri", "Punjabi"],
  "Japanese": ["Tokyo", "Osaka", "Kyoto"],
  "Dutch": ["Belgium", "Netherlands"],
};

// Default sample agent (MorganCsr) for testing Orbit Web Call
const DEFAULT_SAMPLE_AGENT = {
  id: "019c51ea-8ce8-4962-9b83-70023ec0d6c2",
  name: "MorganCsr",
} as const;

// Inbound call number for testing
const INBOUND_CALL_NUMBER = "+1 (844) 418 2027";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("pane-tts");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState("");
  const [ttsText, setTtsText] = useState(
    "Okay, you are NOT going to believe this. You know how I've been totally stuck on that short story? Like, staring at the screen for HOURS, just... nothing? [frustrated sigh] I was seriously about to just trash the whole thing. But then! Last night, this one little phrase popped into my head. And it was like... the FLOODGATES opened! [happy gasp] It all just CLICKED. [laughs] I am so incredibly PUMPED. It went from feeling like a chore to feeling like... MAGIC."
  );
  const [ttsStatus, setTtsStatus] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnhancingExpression, setIsEnhancingExpression] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  const [callStatus, setCallStatus] = useState<"idle" | "loading" | "active">("idle");
  const [activeAgentId, setActiveAgentId] = useState("");
  const [transcript, setTranscript] = useState<{ text: string; role: "user" | "agent" }[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [callVolume, setCallVolume] = useState(0);
  const [showTestCallModal, setShowTestCallModal] = useState(false);
  const audioVizId = useId();
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register" | "forgot">("login");
  const [authStatus, setAuthStatus] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAuthProcessing, setIsAuthProcessing] = useState(false);

  const [history, setHistory] = useState<UserTtsHistoryItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const historyAudioRef = useRef<HTMLAudioElement>(null);
  const [historyAudioUrl, setHistoryAudioUrl] = useState<string | null>(null);
  const [playingHistoryId, setPlayingHistoryId] = useState<string | null>(null);
  const [downloadMenuId, setDownloadMenuId] = useState<string | null>(null);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!downloadMenuId) return;
    const handler = (e: MouseEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target as Node)) {
        setDownloadMenuId(null);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [downloadMenuId]);

  const [models, setModels] = useState<{ model_id: string; name: string; languages: { language_id: string; name: string }[] }[]>([]);

  useEffect(() => {
    const savedTheme = localStorage.getItem("echo-theme") as "dark" | "light" || "dark";
    setTheme(savedTheme);
    document.body.classList.toggle("light-mode", savedTheme === "light");

    if (!orbit) return;

    const onCallStart = () => setCallStatus("active");
    const onCallEnd = () => {
      setCallStatus("idle");
      setActiveAgentId("");
      setTranscript([]);
      setShowTestCallModal(false);
    };
    const onError = (e: unknown) => {
      console.error("Orbit Error:", e);
      setCallStatus("idle");
      setShowTestCallModal(false);
    };
    const onMessage = (message: { type: string; transcriptType?: string; transcript?: string; role?: "user" | "agent" }) => {
      if (message.type === "transcript" && message.transcriptType === "final" && message.transcript && message.role) {
        setTranscript(prev => [...prev, { text: message.transcript!, role: message.role! }]);
      }
      if (message.type === "speech-start") setIsSpeaking(true);
      if (message.type === "speech-end") setIsSpeaking(false);
    };
    const onVolumeLevel = (volume: number) => setCallVolume(volume);

    orbit.on("call-start", onCallStart);
    orbit.on("call-end", onCallEnd);
    orbit.on("error", onError);
    orbit.on("message", onMessage);
    orbit.on("volume-level", onVolumeLevel);

    return () => {
      orbit.off("call-start", onCallStart);
      orbit.off("call-end", onCallEnd);
      orbit.off("error", onError);
      orbit.off("message", onMessage);
      orbit.off("volume-level", onVolumeLevel);
    };
  }, []);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase.auth.getSession().then((response: any) => {
      const { data: { session } } = response;
      setUser(session?.user ?? null);
      setIsAuthLoading(false);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: any, session: any) => {
      setUser(session?.user ?? null);
    });

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return setAuthStatus("Email and password required.");
    setIsAuthProcessing(true);
    setAuthStatus("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthStatus(error.message);
    setIsAuthProcessing(false);
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) return setAuthStatus("Passwords do not match.");
    setIsAuthProcessing(true);
    setAuthStatus("");
    const response = await supabase.auth.signUp({
      email,
      password
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error, data } = response as { error: any; data: any };
    if (error) {
      setAuthStatus(error.message);
    } else if (data.user && data.user.email_confirmed_at) {
      setAuthStatus("Registration successful! You are now logged in.");
      // User is automatically logged in if email is confirmed
      setUser(data.user);
    } else {
      setAuthStatus("Registration successful! You can now log in.");
    }
    setIsAuthProcessing(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return setAuthStatus("Email required.");
    setIsAuthProcessing(true);
    setAuthStatus("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) setAuthStatus(error.message);
    else setAuthStatus("Reset link sent! Check your email.");
    setIsAuthProcessing(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("echo-theme", newTheme);
    document.body.classList.toggle("light-mode", newTheme === "light");
  };

  const fetchRealTimeHistory = useCallback(async () => {
    if (!user) {
      setHistory([]);
      return;
    }
    setIsHistoryLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setHistory([]);
        return;
      }
      const res = await fetch("/api/tts-history", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        console.warn("TTS history fetch failed:", res.status, errBody);
        setHistory([]);
        return;
      }
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch history:", err);
      setHistory([]);
    } finally {
      setIsHistoryLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === "pane-history") {
      fetchRealTimeHistory();
    }
  }, [activeTab, user, fetchRealTimeHistory]);

  const handleToggleCall = async (assistantId: string) => {
    if (callStatus === "active") {
      orbit?.stop();
      return;
    }
    const idToUse = assistantId || DEFAULT_SAMPLE_AGENT.id;
    setShowTestCallModal(true);
    setCallVolume(0);
    setTranscript([]);
    setActiveAgentId(idToUse);
    setCallStatus("loading");
    try {
      await orbit?.start(idToUse);
    } catch (err) {
      console.error("Failed to start call:", err);
      setCallStatus("idle");
      setActiveAgentId("");
      setShowTestCallModal(false);
    }
  };

  const navItems = [
    { id: "pane-tts", label: "Text to Speech", icon: <AudioWaveform size={18} />, desc: "Generate lifelike speech using Echo Engine" },
    { id: "pane-stt", label: "Speech To Text", icon: <Mic size={18} />, desc: "Transcribe audio to text effortlessly" },
    { id: "pane-clone", label: "Voice Cloning", icon: <Copy size={18} />, desc: "Instantly clone voices with full metadata tagging" },
    { id: "pane-agents", label: "Conversational", icon: <Users size={18} />, desc: "Create and connect to Interactive AI Agents via Orbit" },
    { id: "pane-history", label: "History", icon: <History size={18} />, desc: "View and play past synthesized audio" },
    { id: "pane-voices", label: "Voices", icon: <BookOpen size={18} />, desc: "Manage your EchoLabs voice library" },
    { id: "pane-settings", label: "Settings", icon: <SettingsIcon size={18} />, desc: "Configure default Echo models and format" },
  ];

  useEffect(() => {
    async function getVoices() {
      try {
        const res = await fetch("/api/echo/voices");
        const data = await res.json();
        if (Array.isArray(data)) {
          setVoices(data);
          if (data.length > 0) setSelectedVoice(data[0].voice_id);
        }
      } catch (error) {
        console.error("Failed to fetch voices:", error);
      }
    }
    async function getModels() {
      try {
        const res = await fetch("/api/echo/models");
        const data = await res.json();
        if (Array.isArray(data)) setModels(data);
      } catch (error) {
        console.error("Failed to fetch models:", error);
      }
    }
    getVoices();
    getModels();
  }, []);

  const [sttFile, setSttFile] = useState<File | null>(null);
  const [sttStatus, setSttStatus] = useState("");
  const [sttOutput, setSttOutput] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);

  const [cloneName, setCloneName] = useState("");
  const [cloneDesc, setCloneDesc] = useState("");
  const [cloneLanguage, setCloneLanguage] = useState("Filipino");
  const [cloneLocation, setCloneLocation] = useState("Cebuano");
  const [cloneGender, setCloneGender] = useState("Male");
  const [cloneAge, setCloneAge] = useState("Young");
  const [cloneConsent, setCloneConsent] = useState(false);
  const [cloneFiles, setCloneFiles] = useState<File[]>([]);
  const [cloneStatus, setCloneStatus] = useState("");
  const [isCloning, setIsCloning] = useState(false);

  useEffect(() => {
    if (languageDialectMap[cloneLanguage]) {
      setCloneLocation(languageDialectMap[cloneLanguage][0]);
    } else {
      setCloneLocation("General");
    }
  }, [cloneLanguage]);

  const handleAddExpression = async () => {
    if (!ttsText.trim()) return;
    setIsEnhancingExpression(true);
    setTtsStatus("");
    try {
      const res = await fetch("/api/tts-enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: ttsText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Enhance failed");
      if (typeof data.enhanced === "string") setTtsText(data.enhanced);
      setTtsStatus("Expression added.");
    } catch (err) {
      console.error(err);
      setTtsStatus("Error: " + (err instanceof Error ? err.message : "Could not add expression. Is Ollama running or OPENAI_API_KEY set?"));
    } finally {
      setIsEnhancingExpression(false);
    }
  };

  const handleGenerateTTS = async () => {
    if (!selectedVoice || !ttsText.trim()) {
      setTtsStatus("Select a voice and enter text.");
      return;
    }

    setIsGenerating(true);
    setTtsStatus("Synthesizing...");

    try {
      const res = await fetch("/api/echo/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voiceId: selectedVoice,
          text: ttsText,
          modelId: "echo_flash_v2.5",
          outputFormat: "mp3_44100_128"
        }),
      });

      if (!res.ok) throw new Error("Synthesis failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play();
      }
      setTtsStatus("Ready");

      // Save to user TTS history when logged in
      if (user) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          const formData = new FormData();
          formData.set("text", ttsText.trim());
          formData.set("voice_id", selectedVoice);
          formData.set("voice_name", voices.find(v => v.voice_id === selectedVoice)?.name ?? "Unknown");
          formData.set("audio", new File([blob], "tts.mp3", { type: "audio/mpeg" }));
          try {
            const saveRes = await fetch("/api/tts-history", {
              method: "POST",
              headers: { Authorization: `Bearer ${session.access_token}` },
              body: formData,
            });
            if (saveRes.ok) {
              const saved = await saveRes.json();
              setHistory(prev => [saved, ...prev]);
            }
          } catch {
            // Non-blocking: playback already succeeded
          }
        }
      }
    } catch (error) {
      console.error(error);
      setTtsStatus("Error: Generation failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTranscribe = async () => {
    if (!sttFile) return;

    setIsTranscribing(true);
    setSttStatus("Uploading & Transcribing...");

    try {
      const formData = new FormData();
      formData.append("file", sttFile);
      const res = await fetch("/api/echo/stt", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Transcription failed");
      }

      const data = await res.json();
      setSttOutput(data.text || JSON.stringify(data, null, 2));
      setSttStatus("Transcription Complete");
    } catch (error) {
      console.error(error);
      setSttOutput("Error: Transcription failed.");
      setSttStatus("Failed");
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleClone = async () => {
    if (!cloneName || cloneFiles.length === 0) {
      setCloneStatus("Name and files are required.");
      return;
    }
    if (!cloneConsent) {
      setCloneStatus("Please confirm the legal disclaimer.");
      return;
    }

    setIsCloning(true);
    setCloneStatus("Cloning...");

    try {
      const formData = new FormData();
      formData.append("name", cloneName);
      formData.append("description", cloneDesc);
      const labels = {
        language: cloneLanguage,
        accent: cloneLocation,
        gender: cloneGender,
        age: cloneAge,
        cloned: "true"
      };
      formData.append("labels", JSON.stringify(labels));
      cloneFiles.forEach(f => formData.append("files", f));

      const res = await fetch("/api/echo/clone", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Cloning failed");

      setCloneStatus("Voice cloned successfully!");
      setCloneName("");
      setCloneDesc("");
      setCloneFiles([]);
      setCloneConsent(false);
    } catch (error) {
      console.error(error);
      setCloneStatus("Error: Cloning failed.");
    } finally {
      setIsCloning(false);
    }
  };

  const handlePlayPreview = (url?: string) => {
    if (!url) return;
    if (currentAudio) currentAudio.pause();
    const audio = new Audio(url);
    audio.play();
    setCurrentAudio(audio);
  };

  const handlePlayHistory = async (id: string) => {
    if (currentAudio) currentAudio.pause();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setTtsStatus("Sign in to play history.");
      return;
    }
    setTtsStatus("Fetching audio...");
    try {
      const res = await fetch(`/api/tts-history/${id}/audio`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const msg = (errBody as { error?: string })?.error || res.statusText || "Failed to fetch history audio";
        throw new Error(`${msg} (${res.status})`);
      }
      const blob = await res.blob();
      if (historyAudioUrl) URL.revokeObjectURL(historyAudioUrl);
      const url = URL.createObjectURL(blob);
      setHistoryAudioUrl(url);
      setPlayingHistoryId(id);
      const el = historyAudioRef.current;
      if (el) {
        el.src = url;
        el.play();
      }
      setTtsStatus("Playing");
    } catch (err) {
      console.error(err);
      setTtsStatus("Error playing history");
    }
  };

  const handleDownloadHistory = async (id: string, text: string, format: "mp3" | "wav") => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setTtsStatus("Sign in to download.");
      return;
    }
    setTtsStatus("Preparing download...");
    try {
      const res = await fetch(`/api/tts-history/${id}/audio?format=${format}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const msg = (errBody as { error?: string })?.error || res.statusText || "Failed to fetch history audio";
        throw new Error(`${msg} (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const ext = format === "wav" ? "wav" : "mp3";
      const a = document.createElement("a");
      a.href = url;
      a.download = `EchoLabs_${text.substring(0, 20).replace(/[^a-z0-9]/gi, "_")}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setTtsStatus("");
    } catch (err) {
      console.error(err);
      setTtsStatus("Error downloading audio");
    }
  };

  const [agentBases, setAgentBases] = useState<{ id: string; name?: string }[]>([]);
  const [agentBasesError, setAgentBasesError] = useState<string | null>(null);
  const [isFetchingBases, setIsFetchingBases] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [agentStatus, setAgentStatus] = useState("");
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);

  // Create-from-scratch form (beside iPhone dialer)
  const [agentLanguage, setAgentLanguage] = useState("en");
  const [agentIntroSpiel, setAgentIntroSpiel] = useState("");
  const [agentSkillsPrompt, setAgentSkillsPrompt] = useState("");
  const [dialerNumber, setDialerNumber] = useState("");
  const [phonebookEntries, setPhonebookEntries] = useState<{ name: string; number: string }[]>([]);
  const [selectedDialerAgentId, setSelectedDialerAgentId] = useState("");
  const longPress0Ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPress0HandledRef = useRef(false);

  const handleDialKeyDown = (digit: string) => {
    if (digit !== "0") {
      setDialerNumber((n) => (n + digit).slice(0, 15));
      return;
    }
    longPress0HandledRef.current = false;
    longPress0Ref.current = setTimeout(() => {
      longPress0Ref.current = null;
      longPress0HandledRef.current = true;
      setDialerNumber((n) => (n + "+").slice(0, 15));
    }, 500);
  };

  const handleDialKeyUp = (digit: string) => {
    if (digit !== "0") return;
    if (longPress0Ref.current) {
      clearTimeout(longPress0Ref.current);
      longPress0Ref.current = null;
    }
    if (!longPress0HandledRef.current) {
      setDialerNumber((n) => (n + "0").slice(0, 15));
    }
    longPress0HandledRef.current = false;
  };

  const fetchAgentBases = async () => {
    setIsFetchingBases(true);
    setAgentBasesError(null);
    try {
      const res = await fetch("/api/orbit/assistants");
      const data = await res.json();
      if (!res.ok) {
        const msg = typeof data?.error === 'string' ? data.error : 'Failed to load agents';
        setAgentBasesError(msg);
        setAgentBases([]);
        return;
      }
      setAgentBases(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch bases:", error);
      setAgentBasesError("Could not load agents. Check your private API key (VAPI_PRIVATE_API_KEY).");
      setAgentBases([]);
    } finally {
      setIsFetchingBases(false);
    }
  };

  useEffect(() => {
    if (activeTab === "pane-agents") {
      fetchAgentBases();
    }
  }, [activeTab]);

  // Always include default sample agent first, then fetched agents (no duplicate id)
  const displayAgents = useMemo(() => {
    const seen = new Set<string>();
    const out: { id: string; name?: string }[] = [{ ...DEFAULT_SAMPLE_AGENT }];
    seen.add(DEFAULT_SAMPLE_AGENT.id);
    agentBases.forEach((a) => {
      if (!seen.has(a.id)) {
        seen.add(a.id);
        out.push(a);
      }
    });
    return out;
  }, [agentBases]);

  const [showUserProfile, setShowUserProfile] = useState(false);

  const handleCreateMyAgent = async () => {
    if (!newAgentName.trim()) {
      setAgentStatus("Agent name is required.");
      return;
    }
    setIsCreatingAgent(true);
    setAgentStatus("Creating agent in VAPI...");
    try {
      const res = await fetch("/api/orbit/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newAgentName.trim(),
          firstMessage: agentIntroSpiel.trim() || undefined,
          systemPrompt: agentSkillsPrompt.trim() || "You are a helpful AI assistant.",
          language: agentLanguage,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Agent creation failed");
      setAgentStatus("Agent created! Loading into dialer.");
      setSelectedDialerAgentId(data.id);
      setAgentBases((prev) => {
        const exists = prev.some((a) => a.id === data.id);
        if (exists) return prev;
        return [...prev, { id: data.id, name: data.name || newAgentName }];
      });
      fetchAgentBases();
    } catch (error) {
      console.error(error);
      setAgentStatus("Error: " + (error instanceof Error ? error.message : "Creation failed."));
    } finally {
      setIsCreatingAgent(false);
    }
  };

  const handleBulkPhonebookUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result);
      const lines = text.split(/\r?\n/).filter(Boolean);
      const entries: { name: string; number: string }[] = [];
      for (const line of lines) {
        const parts = line.split(/[,;\t]/).map((p) => p.trim());
        if (parts.length >= 2) {
          entries.push({ name: parts[0], number: parts[1].replace(/\D/g, "").slice(-10) });
        } else if (parts[0] && /^\d+$/.test(parts[0].replace(/\D/g, ""))) {
          entries.push({ name: "Unknown", number: parts[0].replace(/\D/g, "").slice(-10) });
        }
      }
      setPhonebookEntries((prev) => [...prev, ...entries]);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const activeItem = navItems.find((item) => item.id === activeTab);

  if (isAuthLoading) {
    return (
      <div className="app bg-black flex items-center justify-center">
        <Loader2 className="animate-spin text-lime" size={48} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-header text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://eburon.ai/icon-eburon.svg"
              alt="Eburon"
              className="mx-auto mb-4 rounded-xl logo-img-lg"
            />
            <h1>EchoLabs</h1>
            <p className="text-2xs text-faint uppercase tracking-widest">Premium Voice Synthesis</p>
          </div>

          <div className="auth-tabs">
            <div
              className={`auth-tab ${authMode === "login" ? "active" : ""}`}
              onClick={() => { setAuthMode("login"); setAuthStatus(""); }}
            >
              Login
            </div>
            <div
              className={`auth-tab ${authMode === "register" ? "active" : ""}`}
              onClick={() => { setAuthMode("register"); setAuthStatus(""); }}
            >
              Register
            </div>
          </div>

          <form onSubmit={authMode === "login" ? handleEmailSignIn : authMode === "register" ? handleEmailSignUp : handleResetPassword}>
            <div className="field">
              <label>Email Address</label>
              <input
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {authMode !== "forgot" && (
              <div className="field">
                <label>Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            )}

            {authMode === "register" && (
              <div className="field">
                <label>Confirm Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            )}

            <button className="btn primary w-full mt-4" disabled={isAuthProcessing}>
              {isAuthProcessing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                authMode === "login" ? "Sign In" : authMode === "register" ? "Create Account" : "Send Reset Link"
              )}
            </button>

            {authStatus && (
              <p className={`text-2xs text-center mt-4 ${authStatus.toLowerCase().includes("error") || authStatus.toLowerCase().includes("fail") || authStatus.toLowerCase().includes("match") ? "text-bad" : "text-lime"}`}>
                {authStatus}
              </p>
            )}

            <div className="auth-footer">
              <span
                className="auth-link"
                onClick={() => {
                  setAuthMode(authMode === "forgot" ? "login" : "forgot");
                  setAuthStatus("");
                }}
              >
                {authMode === "forgot" ? "Back to Login" : "Forgot your password?"}
              </span>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* SIDEBAR */}
      <aside className="card">
        <div className="cardBody sidebar-inner">
          <div className="brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://eburon.ai/icon-eburon.svg"
              alt="Eburon"
              className="rounded-xl logo-img"
            />
            <div>
              <div className="brand-name">EchoLabs</div>
              <div className="brand-sub">From Eburon AI</div>
            </div>
          </div>

          <nav className="nav-menu">
            {navItems.map((item) => (
              <div
                key={item.id}
                className={`nav-item ${activeTab === item.id ? "active" : ""}`}
                onClick={() => setActiveTab(item.id)}
              >
                {item.icon} {item.label}
              </div>
            ))}
          </nav>

          {/* User Profile Area */}
          <div className="sidebar-profile">
            <div 
              className="profile-info cursor-pointer hover:bg-gray-800 rounded-lg p-2 transition-colors"
              onClick={() => setShowUserProfile(!showUserProfile)}
            >
              <div className="profile-avatar text-xs overflow-hidden bg-lime-500 text-black rounded-full w-8 h-8 flex items-center justify-center font-bold">
                {user.email?.charAt(0).toUpperCase()}
              </div>
              <div className="profile-details">
                <div className="profile-name truncate w-32 text-sm font-medium">{user.email}</div>
                <div className="profile-tier text-xs text-gray-400">Click for options</div>
              </div>
              <div className={`profile-chevron transition-transform ${showUserProfile ? 'rotate-180' : ''}`}>
                ▼
              </div>
            </div>
            
            {showUserProfile && (
              <div className="profile-dropdown bg-gray-800 rounded-lg p-2 mt-2 border border-gray-700">
                <div className="profile-item text-sm text-gray-300 px-2 py-1">
                  {user.email}
                </div>
                <div className="profile-separator border-t border-gray-700 my-1"></div>
                <button 
                  onClick={handleLogout}
                  className="profile-logout text-sm text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-gray-700 transition-colors w-full text-left"
                >
                  Sign Out
                </button>
              </div>
            )}
            <div className="api-badge flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="status-dot ok"></div>
                <span>API Active</span>
              </div>
              <button
                className="btn icon-only scale-90"
                onClick={toggleTheme}
                title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              >
                {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="card">
        <div className="cardHeader">
          <div className="title">
            <h1>{activeItem?.label}</h1>
            <small>{activeItem?.desc}</small>
          </div>
          <button className="btn" onClick={() => setIsModalOpen(true)} title="Configure API Key">
            <Key size={14} className="mr-2" /> <span className="text-lime">Keys Configured</span>
          </button>
        </div>

        <div className="cardBody">
          {activeTab === "pane-tts" && (
            <div className="tab-pane active">
              <div className="field">
                <label htmlFor="ttsVoiceSelect">Select Voice</label>
                <select
                  id="ttsVoiceSelect"
                  title="Select a voice for synthesis"
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                >
                  {voices.length === 0 ? (
                    <option value="">Loading voices...</option>
                  ) : (
                    voices.map((v) => (
                      <option key={v.voice_id} value={v.voice_id}>
                        {v.name} {v.labels?.accent ? `(${v.labels.accent})` : ""}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div className="field flex-1">
                <div className="flex flex-wrap justify-between items-center gap-2 mb-1">
                  <label htmlFor="ttsText">Text to Synthesize</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn text-2xs"
                      onClick={() => setTtsText(enhanceTextForTTS(ttsText))}
                      title="Symbols only: @ → at, . → dot (emails, URLs)"
                    >
                      Enhance symbols
                    </button>
                    <button
                      type="button"
                      className="btn text-2xs text-lime border border-lime/50"
                      onClick={() => setTtsText(normalizeForTTS(ttsText))}
                      title="Full normalization: numbers, currency, phone, abbreviations (ElevenLabs best practices)"
                    >
                      Normalize for TTS
                    </button>
                    <button
                      type="button"
                      className="btn text-2xs"
                      onClick={() => setTtsText(ttsText + (ttsText.endsWith(" ") ? "" : " ") + BREAK_TAG)}
                      title="Append [pause]"
                    >
                      Add pause
                    </button>
                    <button
                      type="button"
                      className="btn text-2xs text-lime border border-lime/50"
                      onClick={handleAddExpression}
                      disabled={isEnhancingExpression || !ttsText.trim()}
                      title="Use AI to add [laughing], [sighs], etc. (Ollama or OpenAI)"
                    >
                      {isEnhancingExpression ? <Loader2 size={12} className="animate-spin" /> : "Add expression"}
                    </button>
                  </div>
                </div>
                <textarea
                  id="ttsText"
                  placeholder="Write natural speech. Use square brackets for expressions only: [sighs], [laughs], [happy gasp], [whispers]. No curly braces. Add pause inserts [pause]."
                  value={ttsText}
                  onChange={(e) => setTtsText(e.target.value)}
                ></textarea>
              </div>
              <div className="flex gap-2.5 items-center">
                <button
                  className="btn primary"
                  id="btnGenerateTTS"
                  onClick={handleGenerateTTS}
                  disabled={isGenerating}
                >
                  {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
                  Generate Speech
                </button>
                <span id="ttsStatus" className={`text-xs ${ttsStatus.startsWith("Error") ? "text-bad" : "text-muted"}`}>
                  {ttsStatus}
                </span>
              </div>
              <div className="audio-output-container">
                <label className="mb-3 block">Audio Output</label>
                <audio id="ttsAudio" controls className="w-full" ref={audioRef}></audio>
              </div>
            </div>
          )}

          {activeTab === "pane-stt" && (
            <div className="tab-pane active">
              <div className="field">
                <label htmlFor="sttFile">Audio File</label>
                <input
                  type="file"
                  id="sttFile"
                  accept="audio/*"
                  onChange={(e) => setSttFile(e.target.files?.[0] || null)}
                />
              </div>
              <div className="flex gap-2.5 items-center mb-6">
                <button
                  className="btn primary"
                  onClick={handleTranscribe}
                  disabled={isTranscribing || !sttFile}
                >
                  {isTranscribing ? <Loader2 size={16} className="animate-spin" /> : <Mic size={16} />}
                  Transcribe Audio
                </button>
                <span className={`text-xs ${sttStatus.includes("Error") || sttStatus === "Failed" ? "text-bad" : "text-muted"}`}>
                  {sttStatus}
                </span>
              </div>
              <div className="field flex-1">
                <label htmlFor="sttOutput">Transcription Result</label>
                <textarea
                  id="sttOutput"
                  readOnly
                  placeholder="Transcription will appear here..."
                  value={sttOutput}
                ></textarea>
              </div>
            </div>
          )}

          {activeTab === "pane-clone" && (
            <div className="tab-pane active">
              <div className="field">
                <label htmlFor="cloneName">Voice Name</label>
                <input
                  type="text"
                  id="cloneName"
                  placeholder="e.g. My Custom Voice"
                  value={cloneName}
                  onChange={(e) => setCloneName(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="cloneDesc">Description</label>
                <textarea
                  id="cloneDesc"
                  placeholder="Describe the voice..."
                  value={cloneDesc}
                  onChange={(e) => setCloneDesc(e.target.value)}
                  className="h-20"
                ></textarea>
              </div>
              <div className="grid-2">
                <div className="field">
                  <label htmlFor="cloneLanguage">Language & Model</label>
                  <select
                    id="cloneLanguage"
                    className="input-field"
                    value={cloneLanguage}
                    onChange={(e) => {
                      setCloneLanguage(e.target.value);
                      setCloneLocation("General");
                    }}
                  >
                    <option value="Filipino">Filipino</option>
                    <option value="English">English</option>
                    <option value="Spanish">Spanish</option>
                    <option value="French">French</option>
                    <option value="German">German</option>
                    <option value="Hindi">Hindi</option>
                    <option value="Japanese">Japanese</option>
                    <option value="en">Auto Detect</option>
                    {models.find(m => m.model_id === "eleven_multilingual_v2")?.languages.map(lang => (
                      <option key={lang.language_id} value={lang.language_id}>
                        {lang.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="cloneLocation">Regional Dialect / Accent</label>
                  <select
                    id="cloneLocation"
                    title="Select Accent or Dialect"
                    className="input-field"
                    value={cloneLocation}
                    onChange={(e) => setCloneLocation(e.target.value)}
                    disabled={!cloneLanguage}
                  >
                    <option value="">Auto-detect</option>
                    {cloneLanguage && languageDialectMap[cloneLanguage]?.map(dialect => (
                      <option key={dialect} value={dialect}>{dialect}</option>
                    ))}
                    {/* Fallback options if cloneLanguage is not set or not found in map */}
                    {!cloneLanguage || !languageDialectMap[cloneLanguage] && (
                      <>
                        <option value="General">General / Standard</option>
                        <option value="USA">USA / North America</option>
                        <option value="UK">UK / British</option>
                        <option value="Australia">Australian</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid-2">
                <div className="field">
                  <label htmlFor="cloneGender">Gender</label>
                  <select 
                    id="cloneGender" 
                    value={cloneGender}
                    onChange={(e) => setCloneGender(e.target.value)}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Non-binary">Non-binary</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="cloneAge">Age Group</label>
                  <select 
                    id="cloneAge" 
                    value={cloneAge}
                    onChange={(e) => setCloneAge(e.target.value)}
                  >
                    <option value="Young">Young</option>
                    <option value="Middle-aged">Middle-aged</option>
                    <option value="Old">Old</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label htmlFor="cloneFiles">Sample Files (Multiple allowed)</label>
                <div className="upload-zone" onClick={() => document.getElementById("cloneFiles")?.click()}>
                  <Volume2 size={24} className="mb-2 mx-auto" />
                  <div>{cloneFiles.length > 0 ? `${cloneFiles.length} files selected` : "Drop samples here or click to browse"}</div>
                  <input 
                    type="file" 
                    id="cloneFiles" 
                    multiple 
                    accept="audio/*" 
                    onChange={(e) => setCloneFiles(Array.from(e.target.files || []))}
                  />
                </div>
              </div>
              <div className="field">
                <div className="flex items-start gap-3 p-4 bg-white/5 border border-white/10 rounded-xl mb-4">
                  <input 
                    type="checkbox" 
                    id="cloneConsent" 
                    className="mt-1"
                    checked={cloneConsent}
                    onChange={(e) => setCloneConsent(e.target.checked)}
                  />
                  <label htmlFor="cloneConsent" className="text-2xs text-faint leading-relaxed cursor-pointer select-none">
                    I hereby confirm that I have all necessary rights or consents to upload and clone these voice samples and that I will not use the platform-generated content for any illegal, fraudulent, or harmful purpose. I reaffirm my obligation to abide by EchoLabs’ Terms of Service, Prohibited Content and Uses Policy and Privacy Policy.
                  </label>
                </div>
              </div>

              <div className="flex gap-2.5 items-center">
                <button 
                  className="btn primary" 
                  onClick={handleClone}
                  disabled={isCloning || !cloneName || cloneFiles.length === 0 || !cloneConsent}
                >
                  {isCloning ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />} 
                  Clone Voice
                </button>
                <span className={`text-xs ${cloneStatus.startsWith("Error") ? "text-bad" : "text-muted"}`}>
                  {cloneStatus}
                </span>
              </div>
            </div>
          )}

          {activeTab === "pane-agents" && (
            <div className="tab-pane active">
              <div className="flex justify-between items-center mb-4">
                <label className="block">Orbit agents</label>
                <button
                  type="button"
                  className="btn icon-only"
                  onClick={fetchAgentBases}
                  disabled={isFetchingBases}
                  title="Refresh agents"
                >
                  {isFetchingBases ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                </button>
              </div>
              {agentBasesError && (
                <div className="mb-4 p-3 rounded border border-red-500/50 bg-red-500/10 text-red-200 text-2xs">
                  {agentBasesError}
                </div>
              )}

              <div className="agents-layout">
                {/* iPhone Mockup Dialer */}
                <div className="iphone-mockup">
                  <div className="iphone-frame">
                    <div className="iphone-notch"></div>
                    <div className="iphone-screen">
                      <div className="dialer-header">
                        <span className="dialer-time">Dialer</span>
                      </div>
                      <div className="dialer-agent-select">
                        <label className="text-2xs text-faint">Agent for calls</label>
                        <select
                          title="Select agent for calls"
                          value={selectedDialerAgentId}
                          onChange={(e) => setSelectedDialerAgentId(e.target.value)}
                          className="dialer-select"
                        >
                          <option value="">Select agent</option>
                          {displayAgents.map((a) => (
                            <option key={a.id} value={a.id}>{a.name || a.id}</option>
                          ))}
                        </select>
                      </div>
                      <div className="dialer-number-display">
                        <input
                          type="tel"
                          placeholder="Enter number"
                          value={dialerNumber}
                          onChange={(e) => setDialerNumber(e.target.value.replace(/\D/g, "").slice(0, 15))}
                          className="dialer-number-input"
                        />
                        {dialerNumber && (
                          <button
                            type="button"
                            className="dialer-backspace"
                            onClick={() => setDialerNumber((n) => n.slice(0, -1))}
                            title="Backspace"
                            aria-label="Backspace"
                          >
                            ←
                          </button>
                        )}
                      </div>
                      <div className="dialer-pad">
                        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((digit) => (
                          <button
                            key={digit}
                            type="button"
                            className="dialer-key"
                            onClick={digit === "0" ? undefined : () => setDialerNumber((n) => (n + digit).slice(0, 15))}
                            onPointerDown={digit === "0" ? () => handleDialKeyDown(digit) : undefined}
                            onPointerUp={digit === "0" ? () => handleDialKeyUp(digit) : undefined}
                            onPointerLeave={digit === "0" ? () => { if (longPress0Ref.current) { clearTimeout(longPress0Ref.current); longPress0Ref.current = null; } } : undefined}
                          >
                            {digit === "0" ? (
                              <span className="dialer-key-0"><span>0</span><span className="dialer-key-plus">+</span></span>
                            ) : (
                              digit
                            )}
                          </button>
                        ))}
                      </div>
                      <div className="dialer-actions">
                        <button
                          className="btn primary dialer-call-btn"
                          onClick={() => selectedDialerAgentId && handleToggleCall(selectedDialerAgentId)}
                          disabled={!selectedDialerAgentId || callStatus === "loading"}
                        >
                          {callStatus === "loading" ? <Loader2 size={20} className="animate-spin" /> : <Phone size={20} />}
                          {callStatus === "active" ? "End" : "Call"}
                        </button>
                        <label className="upload-phonebook-btn">
                          <Upload size={14} />
                          Upload phonebook
                          <input
                            type="file"
                            accept=".csv,.txt"
                            onChange={handleBulkPhonebookUpload}
                            hidden
                          />
                        </label>
                      </div>
                      {phonebookEntries.length > 0 && (
                        <div className="phonebook-list">
                          <div className="phonebook-header text-2xs text-faint">{phonebookEntries.length} contacts</div>
                          <div className="phonebook-scroll">
                            {phonebookEntries.slice(0, 8).map((p, i) => (
                              <div
                                key={i}
                                className="phonebook-row"
                                onClick={() => setDialerNumber(p.number)}
                              >
                                <span>{p.name}</span>
                                <span className="text-lime">{p.number}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Create Agent Form */}
                <div className="create-agent-form">
                  <h3 className="create-agent-title">Create My Agent</h3>
                  <div className="field">
                    <label>Agent Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Customer Support Bot"
                      value={newAgentName}
                      onChange={(e) => setNewAgentName(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>Languages Spoken</label>
                    <select
                      title="Languages spoken by agent"
                      value={agentLanguage}
                      onChange={(e) => setAgentLanguage(e.target.value)}
                    >
                      <option value="multilingual">Multilingual</option>
                      <option value="en">English</option>
                      <option value="en-US">English (US)</option>
                      <option value="en-GB">English (UK)</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                      <option value="it">Italian</option>
                      <option value="pt">Portuguese</option>
                      <option value="nl">Dutch</option>
                      <option value="pl">Polish</option>
                      <option value="ru">Russian</option>
                      <option value="ja">Japanese</option>
                      <option value="zh">Chinese</option>
                      <option value="ko">Korean</option>
                      <option value="hi">Hindi</option>
                      <option value="ar">Arabic</option>
                      <option value="tr">Turkish</option>
                      <option value="vi">Vietnamese</option>
                      <option value="id">Indonesian</option>
                      <option value="th">Thai</option>
                      <option value="fil">Filipino</option>
                      <option value="sv">Swedish</option>
                      <option value="da">Danish</option>
                      <option value="fi">Finnish</option>
                      <option value="no">Norwegian</option>
                      <option value="cs">Czech</option>
                      <option value="el">Greek</option>
                      <option value="he">Hebrew</option>
                      <option value="hu">Hungarian</option>
                      <option value="ro">Romanian</option>
                      <option value="uk">Ukrainian</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Intro Spiel (first message)</label>
                    <textarea
                      placeholder="Hi! I'm your assistant. How can I help you today?"
                      value={agentIntroSpiel}
                      onChange={(e) => setAgentIntroSpiel(e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div className="field">
                    <label>Skills & Description (system prompt)</label>
                    <textarea
                      placeholder="You are a helpful customer support agent. You can answer questions about products, process orders, and handle returns. Be friendly and concise."
                      value={agentSkillsPrompt}
                      onChange={(e) => setAgentSkillsPrompt(e.target.value)}
                      rows={4}
                    />
                  </div>
                  <button
                    className="btn primary w-full create-my-agent-btn"
                    onClick={handleCreateMyAgent}
                    disabled={isCreatingAgent || !newAgentName.trim()}
                  >
                    {isCreatingAgent ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />}
                    Create My Agent
                  </button>
                  <span className={`text-xs block mt-2 ${agentStatus.startsWith("Error") ? "text-bad" : "text-muted"}`}>
                    {agentStatus}
                  </span>
                </div>
              </div>

              <div className="mb-4 mt-6 p-3 rounded border border-white/10 bg-white/5 text-2xs text-muted">
                <span className="text-faint">Inbound line for testing:</span>{" "}
                <a href={`tel:${INBOUND_CALL_NUMBER.replace(/\s/g, "")}`} className="text-lime hover:underline">{INBOUND_CALL_NUMBER}</a>
              </div>

              <div className="mt-6">
                <label className="mb-3 block">Available Agents ({displayAgents.length})</label>
                <div className="grid grid-2">
                  {displayAgents.map((a) => (
                    <div key={a.id} className="card p-5 flex flex-col items-center text-center transition-all group relative overflow-hidden hover:border-lime">
                      <div className="w-12 h-12 rounded-full bg-limeDim flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Users size={20} className="text-lime" />
                      </div>
                      <div className="font-bold mb-1">{a.name || "Unnamed Assistant"}</div>
                      <div className="text-2xs text-faint mb-4 truncate w-full">{a.id}</div>
                      
                      <div className="flex gap-2 w-full mt-auto">
                        <button 
                          className="btn flex-1 text-2xs"
                          onClick={() => handleToggleCall(a.id)}
                          disabled={callStatus === "loading" || (callStatus === "active" && activeAgentId !== a.id)}
                        >
                          {callStatus === "loading" && activeAgentId === a.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            "Test Call"
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                  {displayAgents.length === 0 && !isFetchingBases && !agentBasesError && (
                    <div className="placeholder-pane h-20 text-2xs col-span-2">
                      No agents yet. Create one using the form above or in the&nbsp;
                      <a href="https://dashboard.vapi.ai" target="_blank" rel="noopener noreferrer" className="text-lime hover:underline">VAPI dashboard</a>.
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6">
                <label className="mb-3 block">Active Call</label>
                <div className={`placeholder-pane h-32 text-2xs ${callStatus === "active" ? "border-lime" : ""}`}>
                  {callStatus === "active" ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="status-dot ok animate-pulse"></div>
                      <div className="text-lime">Session Active: {activeAgentId}</div>
                    </div>
                  ) : (
                    "No active call. Use the dialer or Test Call to start."
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "pane-history" && (
            <div className="tab-pane active">
              <div className="flex justify-between items-center mb-4">
                <label className="block">TTS History</label>
                {user ? (
                  <button className="text-2xs text-lime bg-transparent hover:text-white" onClick={fetchRealTimeHistory}>Refresh</button>
                ) : null}
              </div>
              {!user ? (
                <div className="placeholder-pane h-32 flex items-center justify-center text-muted">
                  Sign in to save and view your TTS history.
                </div>
              ) : (
                <>
                  {historyAudioUrl && (
                    <div className="mb-4 p-3 rounded border border-border bg-panel flex items-center gap-3">
                      <audio
                        ref={historyAudioRef}
                        src={historyAudioUrl}
                        controls
                        className="flex-1 h-8"
                        onEnded={() => { setTtsStatus(""); setPlayingHistoryId(null); }}
                      />
                      <span className="text-2xs text-muted">Replay</span>
                    </div>
                  )}
                  <div className="history-table">
                  <div className="history-table-header">
                    <div className="col-text">Text</div>
                    <div className="col-voice">Voice</div>
                    <div className="col-date">Date</div>
                    <div className="col-actions"></div>
                  </div>
                  <div className="history-table-body">
                    {isHistoryLoading ? (
                      <div className="placeholder-pane h-32"><Loader2 className="animate-spin" /></div>
                    ) : history.length === 0 ? (
                      <div className="placeholder-pane h-32">No TTS history yet. Generate speech to see it here.</div>
                    ) : (
                      history.slice(0, 50).map((h) => (
                        <div key={h.id} className="history-row group">
                          <div className="col-text" title={h.text}>
                            <div className="text-preview">{h.text}</div>
                          </div>
                          <div className="col-voice">
                            <span className="voice-pill">{h.voice_name}</span>
                          </div>
                          <div className="col-date">
                            {new Date(h.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="col-actions">
                            <button
                              className={`action-btn ${playingHistoryId === h.id ? "text-lime" : ""}`}
                              onClick={() => handlePlayHistory(h.id)}
                              title="Play"
                            >
                              <Play size={16} fill={playingHistoryId === h.id ? "currentColor" : undefined} />
                            </button>
                            <button
                              className="action-btn"
                              onClick={() => {
                                setTtsText(h.text);
                                setSelectedVoice(h.voice_id);
                                setActiveTab("pane-tts");
                              }}
                              title="Re-synthesize"
                            >
                              <AudioWaveform size={16} />
                            </button>
                            <div className="relative inline-block" ref={downloadMenuId === h.id ? downloadMenuRef : undefined}>
                              <button
                                className="action-btn"
                                onClick={(e) => { e.stopPropagation(); setDownloadMenuId(downloadMenuId === h.id ? null : h.id); }}
                                title="Download"
                              >
                                <Download size={16} />
                              </button>
                              {downloadMenuId === h.id && (
                                <div className="absolute right-0 top-full mt-1 z-10 rounded border border-border bg-panel py-1 min-w-[80px] shadow-lg">
                                  <button
                                    className="block w-full text-left px-3 py-1.5 text-2xs hover:bg-limeDim"
                                    onClick={() => { handleDownloadHistory(h.id, h.text, "mp3"); setDownloadMenuId(null); }}
                                  >
                                    MP3
                                  </button>
                                  <button
                                    className="block w-full text-left px-3 py-1.5 text-2xs hover:bg-limeDim"
                                    onClick={() => { handleDownloadHistory(h.id, h.text, "wav"); setDownloadMenuId(null); }}
                                  >
                                    WAV
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                </>
              )}
            </div>
          )}

          {activeTab === "pane-voices" && (
            <div className="tab-pane active">
              <div className="flex justify-between items-center mb-6">
                <label className="block">Voice Library</label>
                <div className="text-2xs text-lime">{voices.length} Voices Available</div>
              </div>
              <div className="grid grid-3">
                {voices.length === 0 ? (
                  <div className="placeholder-pane h-32 col-span-3">Fetching premium voices...</div>
                ) : (
                  voices.map((v) => (
                    <div key={v.voice_id} className="card p-5 flex flex-col items-center text-center transition-all group relative overflow-hidden hover:border-lime">
                      <div className="w-12 h-12 rounded-full bg-limeDim flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative z-10">
                        <Volume2 size={20} className="text-lime" />
                      </div>
                      <div className="font-bold mb-1 relative z-10 text-sm">{v.name}</div>
                      <div className="text-2xs text-faint mb-4 relative z-10">
                         {v.labels?.language || v.labels?.accent || v.category || "General"}
                      </div>
                      
                      <button 
                        className="btn primary py-2 w-full text-2xs mt-auto relative z-10"
                        onClick={() => handlePlayPreview(v.preview_url)}
                        disabled={!v.preview_url}
                      >
                        {v.preview_url ? "Quick Preview" : "No Preview"}
                      </button>

                      {/* Subtle background glow on hover */}
                      <div className="absolute inset-0 bg-lime opacity-0 group-hover:opacity-[0.03] transition-opacity"></div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === "pane-settings" && (
            <div className="tab-pane active">
              <div className="field">
                <label>Default Echo Model</label>
                <select title="Default model for TTS">
                  <option>echo_flash_v2.5</option>
                  <option>echo_multilingual_v2</option>
                  <option>echo_turbo_v2.5</option>
                </select>
              </div>
              <div className="field">
                <label>Output Format</label>
                <select title="Default audio output format">
                  <option>mp3_44100_128</option>
                  <option>wav_44100_16bit</option>
                  <option>pcm_24000</option>
                </select>
              </div>
              <div className="field">
                <label>Stability (TTS)</label>
                <input type="range" min="0" max="1" step="0.1" defaultValue="0.5" title="Adjust voice stability" />
              </div>
              <div className="field">
                <label>Similarity Boost (TTS)</label>
                <input type="range" min="0" max="1" step="0.1" defaultValue="0.7" title="Adjust voice similarity" />
              </div>
              <div className="mt-4">
                <button className="btn primary" onClick={() => alert("Settings saved locally (Simulated)")}>Save Settings</button>
              </div>
            </div>
          )}

          {!["pane-tts", "pane-stt", "pane-clone", "pane-agents", "pane-history", "pane-voices", "pane-settings"].includes(activeTab) && (
            <div className="tab-pane active placeholder-pane">
              Coming Soon: {activeItem?.label}
            </div>
          )}
        </div>
      </main>

      {/* Test Call Modal: orb, audio visualizer, live transcription */}
      {showTestCallModal && (
        <div className="call-overlay call-modal">
          <div className="call-content">
            <div className="orb-container">
              <div className={`orb active ${isSpeaking ? "speaking" : ""}`}></div>
              {callStatus === "loading" && (
                <div className="text-muted text-sm">Connecting...</div>
              )}
              {callStatus === "active" && (
                <>
                  <div className="text-lime font-bold tracking-widest uppercase text-xs">Orbit Web Call</div>
                  <div className="text-2xs text-faint">{activeAgentId}</div>
                  <div className={`audio-visualizer audio-viz-${audioVizId.replace(/:/g, "")} mt-4`} aria-hidden>
                    <style>{`
                      ${Array.from({ length: 12 })
                        .map(
                          (_, i) =>
                            `.audio-viz-${audioVizId.replace(/:/g, "")} .audio-bar:nth-child(${i + 2}) { --bar-height: ${8 + Math.min(92, callVolume * 100 * (0.5 + 0.5 * Math.sin(i * 0.6)))}%; }`
                        )
                        .join("\n")}
                    `}</style>
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div key={i} className="audio-bar" />
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="transcript-box">
              <div className="text-2xs text-faint mb-2 uppercase tracking-wider">Live transcription</div>
              {transcript.length === 0 ? (
                <div className="text-faint italic">Awaiting audio input...</div>
              ) : (
                transcript.map((t, idx) => (
                  <div key={idx} className={`mb-4 ${t.role === "user" ? "text-right" : "text-left"}`}>
                    <div className={`inline-block p-3 rounded-xl ${t.role === "user" ? "bg-white/5" : "text-lime"}`}>
                      {t.text}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="call-controls">
              <button
                className="btn danger px-8 py-4 rounded-full"
                onClick={() => {
                  orbit?.stop();
                  setShowTestCallModal(false);
                }}
              >
                <PhoneOff size={20} /> End call
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Overlay */}
      {isModalOpen && (
        <div className="modal-overlay flex">
          <div className="modal">
            <div className="title mb-5">
              <h1>🔑 Global API Configuration</h1>
              <small>Environment variables are already configured.</small>
            </div>
            <div className="flex gap-2.5 justify-end mt-6">
              <button className="btn" onClick={() => setIsModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
