import React, { useState } from 'react';
import { BrandLogo } from './BrandLogo';
import { Shield, Smartphone, Lock, ArrowRight, Info, X, CheckCircle2 } from 'lucide-react';

interface LoginViewProps {
  onGoogleLogin: () => Promise<void>;
  onEnterDemoMode: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  authError: string | null;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onGoogleLogin,
  onEnterDemoMode,
  theme,
  onToggleTheme,
  authError
}) => {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [showAuthRequirementsModal, setShowAuthRequirementsModal] = useState(false);

  const handleGoogleClick = async () => {
    setIsSigningIn(true);
    try {
      await onGoogleLogin();
    } finally {
      setIsSigningIn(false);
    }
  };

  const isDark = theme === 'dark';

  return (
    <div
      className={`min-h-screen flex flex-col justify-between transition-colors ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Top Bar Contract: 3 zones */}
      <header
        className={`flex items-center justify-between gap-8 px-6 py-4 border-b ${
          isDark ? 'border-slate-800/80 bg-slate-950/90' : 'border-slate-200 bg-white/90'
        }`}
      >
        <BrandLogo size="md" />
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium opacity-80">
          <a href="#features" className="hover:underline whitespace-nowrap shrink-0">
            Capabilities
          </a>
          <a href="#studio" className="hover:underline whitespace-nowrap shrink-0">
            Prompt Studio
          </a>
          <a href="#models" className="hover:underline whitespace-nowrap shrink-0">
            Model Hub
          </a>
          <a href="#security" className="hover:underline whitespace-nowrap shrink-0">
            Security
          </a>
        </nav>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onToggleTheme}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
              isDark
                ? 'border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-800'
                : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {isDark ? 'Light Theme' : 'Dark Theme'}
          </button>
        </div>
      </header>

      {/* Main Split Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Column: Value Proposition */}
        <div className="lg:col-span-7 space-y-6">
          <div className="text-xs font-mono tracking-wider uppercase text-teal-600 dark:text-teal-400">
            Multi-Model AI Workspace · Master Prompt Engineering
          </div>
          <h1
            className="font-display text-3xl sm:text-5xl font-bold tracking-tight leading-tight"
            style={{ textWrap: 'balance' }}
          >
            Save your best AI instructions once. Reuse them on any new idea in seconds.
          </h1>
          <p
            className={`text-base sm:text-lg leading-relaxed max-w-2xl ${
              isDark ? 'text-slate-300' : 'text-slate-600'
            }`}
          >
            MUSTAPHA AI STUDIO combines multi-turn conversational AI, a precision Universal Master
            Prompt Studio with server-verified character counts, 4K image & video
            generation, real-time voice interaction, and molecular bioscience tools in one
            private workspace curated for Mustapha Iliya.
          </p>

          <div
            id="features"
            className={`grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t ${
              isDark ? 'border-slate-800' : 'border-slate-200'
            }`}
          >
            <div>
              <h2 className="font-display font-semibold text-sm">
                01. Master Prompt Studio
              </h2>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Store complex video, coding, or writing rules once. Enter only your new
                topic and generate clean, constraint-verified results.
              </p>
            </div>
            <div>
              <h2 className="font-display font-semibold text-sm">
                02. Multi-Model Gemini & Veo Hub
              </h2>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Switch seamlessly between Gemini 4 Argon (High Thinking), Gemini 3.8 Flash
                (Search Grounding), Nano Banana 2.1, Omni 1.1 Flash Video, and Lyria 3.
              </p>
            </div>
            <div>
              <h2 className="font-display font-semibold text-sm">
                03. Multimodal Vision & Voice
              </h2>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Analyze photos and videos, transcribe microphone recordings, synthesize
                expressive TTS, or converse over Gemini Live WebSockets.
              </p>
            </div>
            <div>
              <h2 className="font-display font-semibold text-sm">
                04. Zero-Trust Per-User Security
              </h2>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Server-side API key isolation and hardened Firestore security rules keep
                your conversations, prompts, and media strictly private.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Authentication Card */}
        <div className="lg:col-span-5">
          <div
            className={`p-6 sm:p-8 rounded-xl border ${
              isDark
                ? 'bg-slate-900 border-slate-800'
                : 'bg-white border-slate-200 shadow-xs'
            }`}
          >
            <div className="space-y-2 mb-6">
              <h2 className="font-display text-xl font-bold">Sign in to your workspace</h2>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Authenticate to sync your saved Master Prompts, chat history, and custom
                assistant preferences across devices.
              </p>
            </div>

            {authError && (
              <div
                role="alert"
                className="mb-4 p-3 rounded-lg border border-red-500/40 bg-red-500/10 text-xs text-red-600 dark:text-red-300"
              >
                {authError}
              </div>
            )}

            <div className="space-y-3">
              {/* Primary Enabled Auth Method: Continue with Google */}
              <button
                type="button"
                onClick={handleGoogleClick}
                disabled={isSigningIn}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-lg font-medium text-sm bg-teal-600 hover:bg-teal-500 text-white transition-colors cursor-pointer disabled:opacity-60"
              >
                <svg className="w-4 h-4 bg-white rounded-full p-0.5" viewBox="0 0 48 48">
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                </svg>
                <span>{isSigningIn ? 'Connecting to Google...' : 'Continue with Google'}</span>
              </button>

              {/* Interactive Evaluation / Demo Workspace Entry */}
              <button
                type="button"
                onClick={onEnterDemoMode}
                className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium text-sm border transition-colors cursor-pointer ${
                  isDark
                    ? 'border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-100'
                    : 'border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-900'
                }`}
              >
                <span>Launch Interactive Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Honest Provider Architecture Section for Phone SMS and Apple Sign-In */}
            <div
              className={`mt-6 pt-5 border-t space-y-2.5 ${
                isDark ? 'border-slate-800' : 'border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between text-xs">
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                  Additional Auth Adapters
                </span>
                <button
                  type="button"
                  onClick={() => setShowAuthRequirementsModal(true)}
                  className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400 hover:underline font-medium"
                >
                  <Info className="w-3.5 h-3.5" />
                  <span>Admin Setup Guide</span>
                </button>
              </div>

              <div
                className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs opacity-70 ${
                  isDark ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Phone SMS Verification (OTP)</span>
                </span>
                <span className="font-mono text-[11px]">Requires SMS Setup</span>
              </div>

              <div
                className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs opacity-70 ${
                  isDark ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Sign in with Apple / iCloud</span>
                </span>
                <span className="font-mono text-[11px]">Requires Apple Cert</span>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-2 text-[11px] opacity-70">
              <Shield className="w-3.5 h-3.5 text-teal-500 shrink-0" />
              <span>
                Protected by Firebase Auth & Zero-Trust Firestore Security Rules.
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer
        className={`px-6 py-4 border-t text-xs flex flex-wrap items-center justify-between gap-4 ${
          isDark
            ? 'border-slate-800/80 text-slate-400'
            : 'border-slate-200 text-slate-500'
        }`}
      >
        <span>MUSTAPHA AI STUDIO · Mustapha Iliya Personal AI Workspace</span>
        <span>Privacy-First Architecture · Server-Side Secret Isolation</span>
      </footer>

      {/* Modal detailing exact Firebase setup requirements for Phone SMS and Apple Sign-In */}
      {showAuthRequirementsModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-setup-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
        >
          <div
            className={`max-w-lg w-full rounded-xl border p-6 space-y-4 ${
              isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 id="auth-setup-modal-title" className="font-display text-base font-bold">
                Authentication Provider Configuration Guide
              </h3>
              <button
                type="button"
                onClick={() => setShowAuthRequirementsModal(false)}
                aria-label="Close setup guide"
                className="p-1 rounded-lg hover:bg-slate-500/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed">
              <div className="p-3 rounded-lg border border-teal-500/30 bg-teal-500/10 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0 mt-0.5" />
                <div>
                  <strong>Google Sign-In (Active & Provisioned):</strong> Provisioned in
                  Firebase project <code className="font-mono">deft-xanthometer-b5v9p</code>.
                </div>
              </div>

              <div className="space-y-1">
                <h4 className="font-semibold">
                  1. Enabling Phone Number Verification (SMS One-Time Code)
                </h4>
                <p className={isDark ? 'text-slate-300' : 'text-slate-600'}>
                  To enable SMS OTP login in production, the administrator must configure in
                  the Firebase Console (Authentication &gt; Sign-in method &gt; Phone):
                </p>
                <ul className="list-disc pl-5 space-y-1 opacity-85">
                  <li>Upgrade project billing plan to Blaze (required by Firebase for SMS delivery).</li>
                  <li>Enable Google Cloud reCAPTCHA Enterprise API and add the Cloud Run domain to Authorized Domains.</li>
                  <li>Configure SMS Region Policy allowlist and daily SMS quota limits.</li>
                </ul>
              </div>

              <div className="space-y-1">
                <h4 className="font-semibold">
                  2. Enabling Sign in with Apple (Apple ID / iCloud)
                </h4>
                <p className={isDark ? 'text-slate-300' : 'text-slate-600'}>
                  To enable Sign in with Apple in the Firebase Console (Authentication &gt;
                  Sign-in method &gt; Apple):
                </p>
                <ul className="list-disc pl-5 space-y-1 opacity-85">
                  <li>Register an Apple Services ID (e.g. <code className="font-mono">com.mustaphaaiprompt.web</code>) in the Apple Developer Portal.</li>
                  <li>Register return URL: <code className="font-mono">https://deft-xanthometer-b5v9p.firebaseapp.com/__/auth/handler</code>.</li>
                  <li>Provide Apple Team ID, Key ID, and upload the private <code className="font-mono">.p8</code> signing key.</li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowAuthRequirementsModal(false)}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-teal-600 text-white hover:bg-teal-500"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
