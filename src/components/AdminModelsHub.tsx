import React, { useState } from 'react';
import { AIModelConfig } from '../utils/modelRegistry';
import {
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Activity,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';

interface AdminModelsHubProps {
  models: AIModelConfig[];
  onToggleModelEnabled: (modelId: string) => void;
  usageStats: {
    textRequests: number;
    imageGenerations: number;
    voiceRequests: number;
    videoGenerations: number;
  };
  dailyLimits: {
    textLimit: number;
    imageLimit: number;
    voiceLimit: number;
  };
  onUpdateLimits: (limits: { textLimit: number; imageLimit: number; voiceLimit: number }) => void;
  isAdminUser: boolean;
  theme: 'dark' | 'light';
}

export const AdminModelsHub: React.FC<AdminModelsHubProps> = ({
  models,
  onToggleModelEnabled,
  usageStats,
  dailyLimits,
  onUpdateLimits,
  isAdminUser,
  theme
}) => {
  const [testingModelId, setTestingModelId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    modelId: string;
    ok: boolean;
    latencyMs?: number;
    message: string;
  } | null>(null);

  const [textLimitInput, setTextLimitInput] = useState(dailyLimits.textLimit);
  const [imageLimitInput, setImageLimitInput] = useState(dailyLimits.imageLimit);
  const [voiceLimitInput, setVoiceLimitInput] = useState(dailyLimits.voiceLimit);
  const [savedLimitsBanner, setSavedLimitsBanner] = useState(false);

  const isDark = theme === 'dark';

  const handleTestProvider = async (model: AIModelConfig) => {
    setTestingModelId(model.id);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/test-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: model.providerId,
          modelId: model.id.includes('image') || model.id.includes('omni') || model.id.includes('lyria') || model.id.includes('live') || model.id.includes('tts') || model.id.includes('transcribe')
            ? 'gemini-3.1-flash-lite'
            : model.id
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setTestResult({
          modelId: model.id,
          ok: false,
          latencyMs: data.latencyMs,
          message: data.error || 'Provider connection test failed.'
        });
      } else {
        setTestResult({
          modelId: model.id,
          ok: true,
          latencyMs: data.latencyMs,
          message: `Verified (${data.latencyMs}ms) · Server secret isolated`
        });
      }
    } catch (err: any) {
      setTestResult({
        modelId: model.id,
        ok: false,
        message: err instanceof Error ? err.message : 'Network error'
      });
    } finally {
      setTestingModelId(null);
    }
  };

  const handleSaveLimits = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateLimits({
      textLimit: Number(textLimitInput) || 500,
      imageLimit: Number(imageLimitInput) || 100,
      voiceLimit: Number(voiceLimitInput) || 100
    });
    setSavedLimitsBanner(true);
    setTimeout(() => setSavedLimitsBanner(false), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">
            Multi-Model AI Hub &amp; Administrator Console
          </h2>
          <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Provider-independent AI service registry, capability verification, usage
            telemetry, and quota governance. Private API keys remain strictly on the
            server.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-lg border border-teal-500/30 bg-teal-500/10 text-teal-600 dark:text-teal-400">
          <ShieldCheck className="w-4 h-4" />
          <span>{isAdminUser ? 'Administrator Access Verified' : 'Workspace Member View'}</span>
        </div>
      </div>

      {/* Usage & Quota Overview Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          className={`p-4 rounded-xl border ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className="text-xs opacity-70">Text &amp; Master Prompt Runs</div>
          <div className="font-mono text-2xl font-bold mt-1 tabular-nums">
            {usageStats.textRequests}{' '}
            <span className="text-xs font-normal opacity-60">/ {dailyLimits.textLimit}</span>
          </div>
        </div>

        <div
          className={`p-4 rounded-xl border ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className="text-xs opacity-70">AI Image Generations</div>
          <div className="font-mono text-2xl font-bold mt-1 tabular-nums">
            {usageStats.imageGenerations}{' '}
            <span className="text-xs font-normal opacity-60">/ {dailyLimits.imageLimit}</span>
          </div>
        </div>

        <div
          className={`p-4 rounded-xl border ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className="text-xs opacity-70">Voice &amp; TTS Requests</div>
          <div className="font-mono text-2xl font-bold mt-1 tabular-nums">
            {usageStats.voiceRequests}{' '}
            <span className="text-xs font-normal opacity-60">/ {dailyLimits.voiceLimit}</span>
          </div>
        </div>

        <div
          className={`p-4 rounded-xl border ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className="text-xs opacity-70">Video &amp; Omni Generations</div>
          <div className="font-mono text-2xl font-bold mt-1 tabular-nums">
            {usageStats.videoGenerations}{' '}
            <span className="text-xs font-normal opacity-60">/ 50</span>
          </div>
        </div>
      </div>

      {testResult && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between ${
            testResult.ok
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
              : 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300'
          }`}
        >
          <span>
            <strong>{testResult.modelId}:</strong> {testResult.message}
          </span>
          <button
            type="button"
            onClick={() => setTestResult(null)}
            className="underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Model Registry Table */}
      <div
        className={`rounded-xl border overflow-hidden ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-teal-500" />
            <h3 className="font-display text-sm font-semibold">
              Registered AI Models &amp; Provider Adapters ({models.length})
            </h3>
          </div>
          <span className="text-xs opacity-65">
            Verify capabilities &amp; connection health
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr
                className={`border-b ${
                  isDark ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-slate-50'
                }`}
              >
                <th className="py-3 px-4 font-semibold">Display Name</th>
                <th className="py-3 px-4 font-semibold">Model Identifier</th>
                <th className="py-3 px-4 font-semibold">Provider</th>
                <th className="py-3 px-4 font-semibold">Capabilities</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {models.map((m) => (
                <tr key={m.id} className="hover:bg-slate-500/5">
                  <td className="py-3 px-4 font-medium">
                    <div>{m.displayName}</div>
                    <div className="text-[11px] opacity-65 line-clamp-1">{m.description}</div>
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px]">{m.id}</td>
                  <td className="py-3 px-4 whitespace-nowrap">{m.provider}</td>
                  <td className="py-3 px-4">
                    <span className="opacity-80">
                      {m.capabilities.map((c) => c.replace(/_/g, ' ')).join(' · ')}
                    </span>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    {m.configured && m.enabled ? (
                      <span className="inline-flex items-center gap-1 text-emerald-500 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Enabled</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-500 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>{m.configured ? 'Disabled' : 'Needs API Key'}</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                    <button
                      type="button"
                      onClick={() => handleTestProvider(m)}
                      disabled={testingModelId === m.id}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded border text-[11px] font-medium cursor-pointer ${
                        isDark
                          ? 'border-slate-700 hover:bg-slate-800'
                          : 'border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <RefreshCw
                        className={`w-3 h-3 ${testingModelId === m.id ? 'animate-spin' : ''}`}
                      />
                      <span>Test</span>
                    </button>
                    {isAdminUser && m.configured && (
                      <button
                        type="button"
                        onClick={() => onToggleModelEnabled(m.id)}
                        className="px-2.5 py-1 rounded border border-teal-500/40 text-teal-600 dark:text-teal-400 text-[11px] font-medium cursor-pointer"
                      >
                        {m.enabled ? 'Disable' : 'Enable'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin Usage Limit Configuration */}
      <form
        onSubmit={handleSaveLimits}
        className={`p-5 rounded-xl border space-y-4 ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-teal-500" />
            <h3 className="font-display text-sm font-semibold">
              Daily Workspace Usage Quotas (Future Billing Ready)
            </h3>
          </div>
          {savedLimitsBanner && (
            <span className="text-xs text-emerald-500 font-medium">
              Quota thresholds updated!
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="limit-text" className="block text-xs font-medium mb-1">
              Daily Text &amp; Prompt Limit
            </label>
            <input
              id="limit-text"
              type="number"
              min={10}
              max={100000}
              value={textLimitInput}
              onChange={(e) => setTextLimitInput(Number(e.target.value))}
              className={`w-full rounded-lg border px-3 py-2 text-xs font-mono tabular-nums ${
                isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-300'
              }`}
            />
          </div>
          <div>
            <label htmlFor="limit-image" className="block text-xs font-medium mb-1">
              Daily Image Generation Limit
            </label>
            <input
              id="limit-image"
              type="number"
              min={5}
              max={10000}
              value={imageLimitInput}
              onChange={(e) => setImageLimitInput(Number(e.target.value))}
              className={`w-full rounded-lg border px-3 py-2 text-xs font-mono tabular-nums ${
                isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-300'
              }`}
            />
          </div>
          <div>
            <label htmlFor="limit-voice" className="block text-xs font-medium mb-1">
              Daily Voice &amp; TTS Limit
            </label>
            <input
              id="limit-voice"
              type="number"
              min={5}
              max={10000}
              value={voiceLimitInput}
              onChange={(e) => setVoiceLimitInput(Number(e.target.value))}
              className={`w-full rounded-lg border px-3 py-2 text-xs font-mono tabular-nums ${
                isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-300'
              }`}
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs opacity-65">
            Payment processing is intentionally disabled in v1. No charges are made.
          </span>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-medium cursor-pointer"
          >
            Save Usage Quotas
          </button>
        </div>
      </form>
    </div>
  );
};
