import React, { useState, useRef, useEffect } from 'react';
import { AppLanguage, getTranslations } from '../utils/i18n';
import {
  Mic,
  Square,
  Volume2,
  Play,
  Pause,
  Radio,
  PhoneOff,
  AlertCircle,
  Sparkles
} from 'lucide-react';

interface VoiceAssistantStudioProps {
  theme: 'dark' | 'light';
  lang?: AppLanguage;
  onRecordUsage: (type: 'voiceRequests') => void;
}

const VOICES = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'] as const;

export const VoiceAssistantStudio: React.FC<VoiceAssistantStudioProps> = ({
  theme,
  lang = 'en',
  onRecordUsage
}) => {
  const t = getTranslations(lang);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiReply, setAiReply] = useState('');
  const [selectedVoice, setSelectedVoice] = useState<string>('Kore');
  const [audioDataUrl, setAudioDataUrl] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live API Real-Time Session State (gemini-3.8-live)
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [liveStatus, setLiveStatus] = useState<string>('Disconnected');
  const [liveTranscripts, setLiveTranscripts] = useState<string[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Live API refs
  const liveWsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);

  const isDark = theme === 'dark';

  useEffect(() => {
    return () => {
      stopLiveConversation();
    };
  }, []);

  const handleStartRecording = async () => {
    setError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError(t.errMicPermission);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAudioBlob(audioBlob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      setError(t.errMicPermission);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudioBlob = async (blob: Blob) => {
    setIsProcessing(true);
    setError(null);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const dataUrl = String(reader.result || '');
          resolve(dataUrl.split(',')[1] || '');
        };
      });
      reader.readAsDataURL(blob);
      const audioBase64 = await base64Promise;

      const res = await fetch('/api/audio/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64,
          mimeType: blob.type || 'audio/webm',
          language: lang
        })
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.error || 'Transcription failed.');
      }
      setTranscript(data.transcript || data.data?.transcript || '');
      onRecordUsage('voiceRequests');
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Audio transcription failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateVoiceResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessing) return;
    setError(null);
    if (!transcript.trim()) {
      setError(
        lang === 'ha'
          ? 'Da fatan za a yi magana ta makirufo ko rubuta tambaya a akwatin da ke kasa.'
          : 'Please record a spoken question or type in the text box first.'
      );
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Get concise conversational reply from Gemini 3.1 Flash Lite (supports English & Hausa)
      const chatRes = await fetch('/api/master-prompt/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterPrompt:
            lang === 'ha'
              ? 'Kai ne Mataimakin Murya na MUSTAPHA AI PROMPT. Bada amsa cikin harshen da mai amfani ya yi magana (Hausa ko Turanci) cikin jimloli 2 zuwa 4 masu dadi da saukin sauraro.'
              : 'You are the MUSTAPHA AI PROMPT Voice Assistant. Respond in the same language the user used (English or Hausa) in a warm, natural spoken tone in 2 to 4 sentences suitable for reading aloud.',
          newIdea: transcript,
          outputLanguage: lang === 'ha' ? 'Hausa' : 'English',
          model: 'gemini-3.1-flash-lite',
          language: lang
        })
      });
      const chatData = await chatRes.json();
      if (!chatRes.ok || chatData.success === false) {
        throw new Error(chatData.error || 'Failed to generate assistant response.');
      }
      const replyText = chatData.output || chatData.data?.output;
      setAiReply(replyText);

      // 2. Synthesize speech using gemini-3.8-flash-lite-tts
      const ttsRes = await fetch('/api/audio/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: replyText,
          voiceName: selectedVoice,
          language: lang
        })
      });
      const ttsData = await ttsRes.json();
      if (!ttsRes.ok || ttsData.success === false) {
        throw new Error(ttsData.error || 'TTS synthesis failed.');
      }
      setAudioDataUrl(ttsData.audioDataUrl || ttsData.data?.audioDataUrl);
      onRecordUsage('voiceRequests');
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Voice assistant workflow failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSynthesizeTextDirectly = async () => {
    if (isProcessing) return;
    setError(null);
    const targetText = aiReply.trim() || transcript.trim();
    if (!targetText) {
      setError(
        lang === 'ha'
          ? 'Shigar da rubutu a akwatin farko don karantawa da murya.'
          : 'Enter text in the input field first to convert to speech.'
      );
      return;
    }
    setIsProcessing(true);
    try {
      const ttsRes = await fetch('/api/audio/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: targetText,
          voiceName: selectedVoice,
          language: lang
        })
      });
      const ttsData = await ttsRes.json();
      if (!ttsRes.ok || ttsData.success === false) {
        throw new Error(ttsData.error || 'TTS synthesis failed.');
      }
      setAudioDataUrl(ttsData.audioDataUrl || ttsData.data?.audioDataUrl);
      onRecordUsage('voiceRequests');
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'TTS synthesis failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Real-time Gemini 3.8 Live API WebSocket connection
  const startLiveConversation = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/api/live`);
      liveWsRef.current = ws;
      setLiveStatus('Connecting to Gemini 3.8 Live...');

      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      inputAudioCtxRef.current = inputCtx;
      outputAudioCtxRef.current = outputCtx;
      nextStartTimeRef.current = 0;

      ws.onopen = () => {
        setIsLiveActive(true);
        setLiveStatus('Connected · Streaming Live Audio');
        const source = inputCtx.createMediaStreamSource(stream);
        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        source.connect(processor);
        processor.connect(inputCtx.destination);

        processor.onaudioprocess = (e) => {
          if (liveWsRef.current?.readyState !== WebSocket.OPEN) return;
          const float32 = e.inputBuffer.getChannelData(0);
          const int16 = new Int16Array(float32.length);
          for (let i = 0; i < float32.length; i++) {
            const s = Math.max(-1, Math.min(1, float32[i]));
            int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
          const bytes = new Uint8Array(int16.buffer);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          liveWsRef.current.send(JSON.stringify({ audio: btoa(binary) }));
        };
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'audio' && msg.audio && outputAudioCtxRef.current) {
            const ctx = outputAudioCtxRef.current;
            const bin = atob(msg.audio);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) {
              bytes[i] = bin.charCodeAt(i);
            }
            const int16 = new Int16Array(bytes.buffer);
            const audioBuffer = ctx.createBuffer(1, int16.length, 24000);
            const channelData = audioBuffer.getChannelData(0);
            for (let i = 0; i < int16.length; i++) {
              channelData[i] = int16[i] / 32768.0;
            }
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);
            const startTime = Math.max(ctx.currentTime, nextStartTimeRef.current);
            source.start(startTime);
            nextStartTimeRef.current = startTime + audioBuffer.duration;
          } else if (msg.type === 'transcript' && msg.text) {
            setLiveTranscripts((prev) => [...prev.slice(-8), msg.text]);
          } else if (msg.type === 'interrupted') {
            nextStartTimeRef.current = 0;
          } else if (msg.type === 'error') {
            setError(msg.error);
          }
        } catch {
          // Ignore malformed frame
        }
      };

      ws.onclose = () => {
        setIsLiveActive(false);
        setLiveStatus('Disconnected');
      };
    } catch {
      setError(t.errMicPermission);
    }
  };

  const stopLiveConversation = () => {
    liveWsRef.current?.close();
    liveWsRef.current = null;
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;
    inputAudioCtxRef.current?.close().catch(() => {});
    outputAudioCtxRef.current?.close().catch(() => {});
    setIsLiveActive(false);
    setLiveStatus('Disconnected');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight">
          {t.voiceTitle}
        </h2>
        <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          {t.voiceSubtitle}
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-xs text-red-600 dark:text-red-300 flex items-center gap-2.5"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Speech-to-Text + AI Response + TTS Playback */}
        <form onSubmit={handleGenerateVoiceResponse} className="lg:col-span-7 space-y-4">
          <div
            className={`p-5 rounded-xl border space-y-4 ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold">
                Speech-to-Text &amp; Text-to-Speech Studio
              </h3>
              <span className="text-xs font-mono opacity-65">
                gemini-3.5-transcribe + gemini-3.8-flash-lite-tts
              </span>
            </div>

            {/* Microphone Record Button */}
            <div className="flex flex-wrap items-center gap-3">
              {!isRecording ? (
                <button
                  type="button"
                  onClick={handleStartRecording}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold cursor-pointer"
                >
                  <Mic className="w-4 h-4" />
                  <span>{t.startRecording}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStopRecording}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold cursor-pointer"
                >
                  <Square className="w-4 h-4" />
                  <span>{t.stopAndTranscribe}</span>
                </button>
              )}

              <div className="flex items-center gap-2">
                <label htmlFor="tts-voice-select" className="text-xs font-medium">
                  TTS Voice:
                </label>
                <select
                  id="tts-voice-select"
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs ${
                    isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-300'
                  }`}
                >
                  {VOICES.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Editable Transcribed Input before sending */}
            <div>
              <label htmlFor="voice-transcript-input" className="block text-xs font-medium mb-1">
                {t.transcribedSpeechLabel}
              </label>
              <textarea
                id="voice-transcript-input"
                rows={3}
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder={
                  lang === 'ha'
                    ? 'Yi magana ta makirufo ko rubuta tambayarka a nan cikin Hausa ko Turanci...'
                    : 'Speak into your microphone (you can edit recognized text here before sending) or type directly...'
                }
                className={`w-full rounded-lg border p-3 text-sm ${
                  isDark ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-300'
                }`}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={isProcessing}
                className="flex-1 py-2.5 px-4 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-display font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {isProcessing ? 'Processing...' : t.askAndSpeakBtn}
                </span>
              </button>

              <button
                type="button"
                onClick={handleSynthesizeTextDirectly}
                disabled={isProcessing}
                className={`py-2.5 px-4 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer ${
                  isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-100'
                }`}
              >
                <Volume2 className="w-4 h-4 text-teal-500" />
                <span>{t.convertTextToSpeechBtn}</span>
              </button>
            </div>

            {aiReply && (
              <div
                className={`p-4 rounded-lg border text-sm space-y-2 ${
                  isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="text-xs font-semibold opacity-70">Assistant Spoken Response:</div>
                <p>{aiReply}</p>
              </div>
            )}

            {audioDataUrl && (
              <div
                className={`p-3 rounded-lg border flex items-center justify-between gap-3 ${
                  isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <audio
                  ref={audioElementRef}
                  src={audioDataUrl}
                  onPlay={() => setIsPlayingAudio(true)}
                  onPause={() => setIsPlayingAudio(false)}
                  onEnded={() => setIsPlayingAudio(false)}
                  controls
                  className="w-full h-9"
                />
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    aria-label={isPlayingAudio ? 'Pause speech' : 'Play speech'}
                    onClick={() => {
                      if (!audioElementRef.current) return;
                      if (isPlayingAudio) {
                        audioElementRef.current.pause();
                      } else {
                        audioElementRef.current.play();
                      }
                    }}
                    className="p-2 rounded-lg bg-teal-600 text-white hover:bg-teal-500 cursor-pointer"
                  >
                    {isPlayingAudio ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    aria-label={t.stopSpeech}
                    onClick={() => {
                      if (!audioElementRef.current) return;
                      audioElementRef.current.pause();
                      audioElementRef.current.currentTime = 0;
                      setIsPlayingAudio(false);
                    }}
                    className="p-2 rounded-lg border border-slate-500/30 hover:bg-slate-500/10 cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Right: Real-Time Gemini 3.8 Live API Session */}
        <div className="lg:col-span-5">
          <div
            className={`p-5 rounded-xl border h-full flex flex-col justify-between space-y-4 ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold">
                  Gemini 3.8 Live (Real-Time Voice)
                </h3>
                <span className="text-xs font-mono opacity-75">{liveStatus}</span>
              </div>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Streams 16kHz PCM microphone audio over WebSocket to{' '}
                <code className="font-mono">gemini-3.8-live</code> on the server and plays
                back 24kHz model audio in real time.
              </p>
            </div>

            <div className="py-8 flex flex-col items-center justify-center gap-3">
              {!isLiveActive ? (
                <button
                  type="button"
                  onClick={startLiveConversation}
                  className="px-5 py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-display font-semibold text-xs inline-flex items-center gap-2 cursor-pointer"
                >
                  <Radio className="w-4 h-4" />
                  <span>{t.startLiveSession}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopLiveConversation}
                  className="px-5 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-display font-semibold text-xs inline-flex items-center gap-2 cursor-pointer"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>{t.endLiveSession}</span>
                </button>
              )}
            </div>

            {liveTranscripts.length > 0 && (
              <div className="p-3 rounded-lg border border-slate-700/40 text-xs space-y-1 max-h-36 overflow-y-auto">
                {liveTranscripts.map((txt, idx) => (
                  <p key={idx}>{txt}</p>
                ))}
              </div>
            )}

            <div className="text-[11px] font-mono opacity-60 pt-2 border-t border-slate-200 dark:border-slate-800">
              WebSocket Endpoint: /api/live · Voice: Zephyr
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
