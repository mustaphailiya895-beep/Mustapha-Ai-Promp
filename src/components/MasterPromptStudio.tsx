import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  Save,
  FolderOpen,
  AlertCircle,
  Loader2,
  ClipboardPaste,
  Download,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Trash2,
  MousePointerClick
} from 'lucide-react';
import { AppLanguage } from '../utils/i18n';
import { SavedMasterPrompt } from '../utils/modelRegistry';
import {
  ChangeSummaryReport,
  ValidationReport
} from '../utils/promptEngine';
import {
  saveDraftRecord,
  loadDraftRecord,
  clearDraftRecord,
  countWordsAndCharsFast,
  copyTextReliably,
  StudioDraftRecord
} from '../utils/draftStorage';

interface MasterPromptStudioProps {
  savedPrompts: SavedMasterPrompt[];
  selectedPrompt?: SavedMasterPrompt | null;
  onSelectPrompt?: (p: SavedMasterPrompt) => void;
  onSavePrompt: (
    newPrompt: Omit<SavedMasterPrompt, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onSendResultToChat?: (output: string) => void;
  selectedModel?: string;
  theme?: 'dark' | 'light';
  lang: AppLanguage;
  onRecordUsage?: (
    type: 'textRequests' | 'imageGenerations' | 'videoGenerations' | 'voiceRequests'
  ) => void;
  currentUserId?: string | null;
}

const STUDIO_DRAFT_ID = 'universal_master_prompt_studio_v2';

export const MasterPromptStudio: React.FC<MasterPromptStudioProps> = ({
  lang,
  selectedPrompt,
  onSelectPrompt,
  savedPrompts,
  onSavePrompt,
  selectedModel,
  onRecordUsage
}) => {
  // Section 1: Tsohon Master Prompt Ɗina (Immutable Original Source)
  const [originalMasterPrompt, setOriginalMasterPrompt] = useState('');
  // Section 2: Sabon Ideas Ɗina (New Idea / Target Topic)
  const [newIdea, setNewIdea] = useState('');
  // Section 3: Full Cikakken Result — Click and Copy
  const [fullResult, setFullResult] = useState('');

  // Debounced lightweight counters so 15,000+ word pastes never block keystrokes
  const [section1Stats, setSection1Stats] = useState({ words: 0, chars: 0, lines: 0 });
  const [section2Stats, setSection2Stats] = useState({ words: 0, chars: 0, lines: 0 });
  const [section3Stats, setSection3Stats] = useState({ words: 0, chars: 0, lines: 0 });

  // Transformation metadata (optional collapsible inspection)
  const [changeSummary, setChangeSummary] = useState<ChangeSummaryReport | null>(null);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [modelUsed, setModelUsed] = useState('');
  const [showDetailsDrawer, setShowDetailsDrawer] = useState(false);

  // Execution & UI states
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressStage, setProgressStage] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'manual_fallback'>('idle');
  const [draftRestored, setDraftRestored] = useState(false);

  // Modals & Confirmations (no window.alert/confirm)
  const [confirmClearTarget, setConfirmClearTarget] = useState<'section1' | 'section2' | 'all' | null>(null);
  const [showLoadSavedModal, setShowLoadSavedModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [saveCategory, setSaveCategory] = useState('Master Prompt');
  const [activePromptId, setActivePromptId] = useState<string | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const resultTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const section3ContainerRef = useRef<HTMLDivElement | null>(null);

  // 1. Load selected saved prompt OR recover IndexedDB draft on mount
  useEffect(() => {
    let cancelled = false;
    if (selectedPrompt) {
      setActivePromptId(selectedPrompt.id);
      setOriginalMasterPrompt(selectedPrompt.promptText || '');
      setSaveTitle(selectedPrompt.name || '');
      setSaveCategory(selectedPrompt.category || 'Master Prompt');
      return;
    }

    loadDraftRecord<StudioDraftRecord>(STUDIO_DRAFT_ID).then((draft) => {
      if (cancelled || !draft) return;
      if (draft.originalMasterPrompt || draft.newIdea || draft.fullResult) {
        setOriginalMasterPrompt(draft.originalMasterPrompt || '');
        setNewIdea(draft.newIdea || '');
        setFullResult(draft.fullResult || '');
        setDraftRestored(true);
        setTimeout(() => {
          if (!cancelled) setDraftRestored(false);
        }, 4000);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedPrompt]);

  // 2. Debounced O(n) word & character count for Section 1 (handles 15,000+ words smoothly)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSection1Stats(countWordsAndCharsFast(originalMasterPrompt));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [originalMasterPrompt]);

  // 3. Debounced O(n) word & character count for Section 2
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSection2Stats(countWordsAndCharsFast(newIdea));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [newIdea]);

  // 4. Debounced O(n) word & character count for Section 3
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSection3Stats(countWordsAndCharsFast(fullResult));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [fullResult]);

  // 5. Debounced IndexedDB Auto-Save so refreshing or leaving never loses long prompts
  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveDraftRecord<StudioDraftRecord>({
        id: STUDIO_DRAFT_ID,
        originalMasterPrompt,
        newIdea,
        fullResult,
        updatedAt: Date.now()
      });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [originalMasterPrompt, newIdea, fullResult]);

  const handlePasteIntoField = async (target: 'section1' | 'section2') => {
    setErrorMsg(null);
    try {
      if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
        const clipText = await navigator.clipboard.readText();
        if (clipText) {
          if (target === 'section1') {
            setOriginalMasterPrompt((prev) => (prev ? `${prev}\n${clipText}` : clipText));
          } else {
            setNewIdea((prev) => (prev ? `${prev}\n${clipText}` : clipText));
          }
          return;
        }
      }
      setErrorMsg(
        lang === 'ha'
          ? 'Da fatan za a danna dogon-latsawa (Long Press) ko Ctrl+V a cikin akwatin rubutu don liƙawa.'
          : 'Clipboard read permission was blocked by your browser. Please tap inside the text area and press Paste (Ctrl+V / Cmd+V).'
      );
    } catch {
      setErrorMsg(
        lang === 'ha'
          ? 'Da fatan za a danna dogon-latsawa (Long Press) ko Ctrl+V a cikin akwatin rubutu don liƙawa.'
          : 'Please tap directly inside the text box and use Paste (Ctrl+V / Cmd+V or Long-Press Paste).'
      );
    }
  };

  const handleConfirmClear = async () => {
    if (confirmClearTarget === 'section1') {
      setOriginalMasterPrompt('');
    } else if (confirmClearTarget === 'section2') {
      setNewIdea('');
    } else if (confirmClearTarget === 'all') {
      setOriginalMasterPrompt('');
      setNewIdea('');
      setFullResult('');
      setChangeSummary(null);
      setValidationReport(null);
      await clearDraftRecord(STUDIO_DRAFT_ID);
    }
    setConfirmClearTarget(null);
    setErrorMsg(null);
  };

  // PRIMARY ACTION: GENERATE FULL MASTER PROMPT
  const handleGenerateFullMasterPrompt = async () => {
    if (isGenerating) return;
    setErrorMsg(null);

    const trimmedOriginal = originalMasterPrompt.trim();
    const trimmedIdea = newIdea.trim();

    if (!trimmedOriginal) {
      setErrorMsg(
        lang === 'ha'
          ? 'Da fatan za a liƙa "1. Tsohon Master Prompt Ɗina" tukuna.'
          : 'Please paste your original Master Prompt in "1. Tsohon Master Prompt Ɗina" first.'
      );
      return;
    }

    if (!trimmedIdea) {
      setErrorMsg(
        lang === 'ha'
          ? 'Da fatan za a rubuta sabon ra’ayinka a "2. Sabon Ideas Ɗina" tukuna.'
          : 'Please enter your new idea or target topic in "2. Sabon Ideas Ɗina" first.'
      );
      return;
    }

    setIsGenerating(true);
    const isLongPrompt = trimmedOriginal.length > 11500;
    setProgressStage(
      isLongPrompt
        ? lang === 'ha'
          ? 'Ana raba dogon Master Prompt zuwa sassa masu ma’ana (Long-Prompt Pipeline)...'
          : 'Analyzing long Master Prompt structure & splitting at section boundaries...'
        : lang === 'ha'
          ? 'Ana nazarin Tsohon Master Prompt da Sabon Idea...'
          : 'Analyzing Original Master Prompt structure & adapting to your New Idea...'
    );

    const stageTimer = window.setTimeout(() => {
      setProgressStage(
        isLongPrompt
          ? lang === 'ha'
            ? 'Ana sabunta kowane sashe ba tare da rage rubutu ba...'
            : 'Transforming topic-dependent sections while preserving universal rules verbatim...'
          : lang === 'ha'
            ? 'Ana haɗa Cikakken Sabon Master Prompt...'
            : 'Synthesizing and validating complete self-contained Master Prompt...'
      );
    }, 2800);

    try {
      const response = await fetch('/api/master-prompt/transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalMasterPrompt: trimmedOriginal,
          newIdea: trimmedIdea,
          mode: 'smart',
          model: selectedModel || 'gemini-3.8-flash',
          language: lang
        })
      });

      const data = await response.json();
      if (!response.ok || data.error || !data.finalMasterPrompt) {
        throw new Error(
          data.error ||
            (lang === 'ha'
              ? 'An sami matsala wajen samar da Cikakken Master Prompt. Da fatan za a sake gwadawa.'
              : 'Failed to generate the adapted Master Prompt. Your original text is safely preserved—please try again.')
        );
      }

      const generatedText = String(data.finalMasterPrompt).trim();
      setFullResult(generatedText);
      setChangeSummary(data.changeSummary || null);
      setValidationReport(data.validationReport || null);
      setModelUsed(data.modelUsed || 'gemini-3.8-flash');

      if (onRecordUsage) {
        onRecordUsage('textRequests');
      }

      // Scroll smoothly to Section 3
      window.setTimeout(() => {
        section3ContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    } catch (err: any) {
      setErrorMsg(
        err?.message ||
          (lang === 'ha'
            ? 'An sami matsala wajen haɗawa da AI. Rubutunka yana nan daram—gwada sake dannawa.'
            : 'An error occurred while transforming your Master Prompt. Your inputs are safely preserved—please try again.')
      );
    } finally {
      window.clearTimeout(stageTimer);
      setIsGenerating(false);
      setProgressStage('');
    }
  };

  // RELIABLE FULL PROMPT COPY + MANUAL SELECTION FALLBACK
  const handleCopyFullResult = async () => {
    if (!fullResult.trim()) return;
    const res = await copyTextReliably(fullResult);
    if (res.ok) {
      setCopyStatus('copied');
      window.setTimeout(() => setCopyStatus('idle'), 3000);
    } else {
      // Fallback: select all text inside Section 3 textarea for manual copy
      setCopyStatus('manual_fallback');
      if (resultTextareaRef.current) {
        resultTextareaRef.current.focus();
        resultTextareaRef.current.select();
        resultTextareaRef.current.setSelectionRange(0, fullResult.length);
      }
    }
  };

  const handleSelectAllResultManually = () => {
    if (!resultTextareaRef.current || !fullResult) return;
    resultTextareaRef.current.focus();
    resultTextareaRef.current.select();
    resultTextareaRef.current.setSelectionRange(0, fullResult.length);
    setCopyStatus('manual_fallback');
  };

  const handleDownloadResultTxt = () => {
    if (!fullResult.trim()) return;
    const blob = new Blob([fullResult], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (newIdea || 'adapted-master-prompt')
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .slice(0, 45);
    a.href = url;
    a.download = `${safeName || 'master-prompt'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSaveToLibrary = async () => {
    const contentToSave = fullResult.trim() || originalMasterPrompt.trim();
    if (!contentToSave) return;
    const finalTitle =
      saveTitle.trim() ||
      (newIdea.trim() ? `Adapted: ${newIdea.trim().slice(0, 50)}` : 'Universal Master Prompt');

    setIsSaving(true);
    try {
      await onSavePrompt({
        name: finalTitle,
        description: newIdea.trim()
          ? `Adapted for: ${newIdea.trim().slice(0, 140)}`
          : 'Saved from Universal Master Prompt Studio',
        category: saveCategory || 'Master Prompt',
        promptText: contentToSave,
        outputLanguage: lang === 'ha' ? 'Hausa' : 'English',
        outputType: 'Master Prompt',
        targetPlatform: 'Universal AI',
        desiredLength: 'Full',
        characterLimit: 0,
        exactCharCount: false
      });
      setSaveSuccess(true);
      window.setTimeout(() => {
        setSaveSuccess(false);
        setShowSaveModal(false);
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not save prompt to account.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6">
      {/* Studio Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-[#151821] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-semibold tracking-wide uppercase mb-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>UNIVERSAL MASTER PROMPT STUDIO</span>
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
            {lang === 'ha'
              ? 'Sauya Tsohon Master Prompt Zuwa Sabon Idea (Cikakken Tsari)'
              : 'Transform Any Master Prompt to Fit Your New Idea'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            {lang === 'ha'
              ? 'Liƙa tsohon Master Prompt ɗinka (har zuwa kalmomi 15,000+), rubuta sabon ra’ayinka, sannan ka kwafi cikakken sakamakon.'
              : 'Paste any existing Master Prompt (supports 15,000+ words), enter any new Idea, and generate a complete, copy-ready Master Prompt.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {draftRestored && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
              <Check className="w-3.5 h-3.5" />
              {lang === 'ha' ? 'An dawo da rubutunka' : 'Draft recovered'}
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowLoadSavedModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-indigo-500" />
            <span>{lang === 'ha' ? 'Buɗe Adana' : 'Saved Prompts'} ({savedPrompts.length})</span>
          </button>
          {(originalMasterPrompt || newIdea || fullResult) && (
            <button
              type="button"
              onClick={() => setConfirmClearTarget('all')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{lang === 'ha' ? 'Sake Fara Duka' : 'Reset Studio'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Banner before clearing unsaved content */}
      {confirmClearTarget && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/70 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm text-amber-900 dark:text-amber-200">
              <p className="font-semibold">
                {lang === 'ha'
                  ? 'Kana da tabbacin kana son share wannan rubutun?'
                  : 'Are you sure you want to clear this content?'}
              </p>
              <p className="text-amber-700 dark:text-amber-300/90 mt-0.5">
                {lang === 'ha'
                  ? 'Wannan matakin zai goge rubutun da ke cikin filin da ka zaɓa.'
                  : 'Confirming will remove the unsaved text from the selected section.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setConfirmClearTarget(null)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              {lang === 'ha' ? 'A’a, Bar Shi' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleConfirmClear}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer"
            >
              {lang === 'ha' ? 'Eh, Share' : 'Confirm Clear'}
            </button>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70 rounded-xl p-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm text-rose-800 dark:text-rose-200 leading-relaxed">
              {errorMsg}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline shrink-0 cursor-pointer"
          >
            {lang === 'ha' ? 'Rufe' : 'Dismiss'}
          </button>
        </div>
      )}

      {/* =====================================================================
          SECTION 1 — TSOHON MASTER PROMPT ƊINA
      ===================================================================== */}
      <section
        aria-label="1. Tsohon Master Prompt Ɗina"
        className="bg-white dark:bg-[#151821] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <label
              htmlFor="section-1-original-prompt"
              className="block text-base sm:text-lg font-bold text-slate-900 dark:text-white"
            >
              1. Tsohon Master Prompt Ɗina
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {lang === 'ha'
                ? 'Liƙa cikakken tsohon Master Prompt ɗinka a nan (yana ɗaukar dogon rubutu har kalmomi 15,000+ ba tare da rage komai ba).'
                : 'Paste your complete existing Master Prompt here. Preserves all headings, numbered sections, symbols, and line breaks (supports 15,000+ words).'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              data-testid="section1-counter"
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/90 text-[11px] font-mono text-slate-600 dark:text-slate-300"
            >
              {section1Stats.words.toLocaleString()} {lang === 'ha' ? 'kalmomi' : 'words'} •{' '}
              {section1Stats.chars.toLocaleString()} {lang === 'ha' ? 'haruffa' : 'chars'}
            </span>
            <button
              type="button"
              onClick={() => handlePasteIntoField('section1')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 transition-colors cursor-pointer"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              <span>{lang === 'ha' ? 'Liƙa (Paste)' : 'Paste'}</span>
            </button>
            {originalMasterPrompt.length > 0 && (
              <button
                type="button"
                onClick={() => setConfirmClearTarget('section1')}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-rose-500/10 text-slate-600 hover:text-rose-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-rose-400 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{lang === 'ha' ? 'Share' : 'Clear'}</span>
              </button>
            )}
          </div>
        </div>

        <textarea
          id="section-1-original-prompt"
          data-testid="input-original-master-prompt"
          value={originalMasterPrompt}
          onChange={(e) => setOriginalMasterPrompt(e.target.value)}
          rows={11}
          spellCheck={false}
          placeholder={
            lang === 'ha'
              ? 'Liƙa cikakken Tsohon Master Prompt ɗinka a nan...'
              : 'Paste your complete existing Master Prompt here (headings, stages, rules, constraints, examples)...'
          }
          className="w-full rounded-xl bg-slate-50 dark:bg-[#0f1117] border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 p-3.5 sm:p-4 text-xs sm:text-sm font-mono text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 leading-relaxed resize-y min-h-[220px] max-h-[540px] outline-hidden"
        />
      </section>

      {/* =====================================================================
          SECTION 2 — SABON IDEAS ƊINA
      ===================================================================== */}
      <section
        aria-label="2. Sabon Ideas Ɗina"
        className="bg-white dark:bg-[#151821] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <label
              htmlFor="section-2-new-idea"
              className="block text-base sm:text-lg font-bold text-slate-900 dark:text-white"
            >
              2. Sabon Ideas Ɗina
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {lang === 'ha'
                ? 'Rubuta sabon ra’ayi, jigo, ko aikin da kake son Tsohon Master Prompt ɗinka ya koma kai.'
                : 'Enter any new Idea, topic, niche, subject, character, product, scenario, or objective.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              data-testid="section2-counter"
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/90 text-[11px] font-mono text-slate-600 dark:text-slate-300"
            >
              {section2Stats.words.toLocaleString()} {lang === 'ha' ? 'kalmomi' : 'words'} •{' '}
              {section2Stats.chars.toLocaleString()} {lang === 'ha' ? 'haruffa' : 'chars'}
            </span>
            <button
              type="button"
              onClick={() => handlePasteIntoField('section2')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 transition-colors cursor-pointer"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              <span>{lang === 'ha' ? 'Liƙa (Paste)' : 'Paste'}</span>
            </button>
            {newIdea.length > 0 && (
              <button
                type="button"
                onClick={() => setConfirmClearTarget('section2')}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-rose-500/10 text-slate-600 hover:text-rose-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-rose-400 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{lang === 'ha' ? 'Share' : 'Clear'}</span>
              </button>
            )}
          </div>
        </div>

        <textarea
          id="section-2-new-idea"
          data-testid="input-new-idea"
          value={newIdea}
          onChange={(e) => setNewIdea(e.target.value)}
          rows={5}
          placeholder={
            lang === 'ha'
              ? 'Rubuta Sabon Idea ɗinka a nan (misali: sabon jigo, kasuwanci, ilimi, bidiyo, software, ko kowane irin aiki)...'
              : 'Describe your New Idea in detail (any topic, niche, character, product, workflow, or creative direction)...'
          }
          className="w-full rounded-xl bg-slate-50 dark:bg-[#0f1117] border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 p-3.5 sm:p-4 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 leading-relaxed resize-y min-h-[120px] max-h-[320px] outline-hidden"
        />
      </section>

      {/* =====================================================================
          PRIMARY ACTION BUTTON — GENERATE FULL MASTER PROMPT
      ===================================================================== */}
      <div className="flex flex-col items-center justify-center gap-2.5">
        <button
          type="button"
          data-testid="btn-generate-full-master-prompt"
          disabled={isGenerating}
          onClick={handleGenerateFullMasterPrompt}
          className="w-full sm:w-auto min-w-[290px] inline-flex items-center justify-center gap-2.5 px-7 py-4 rounded-2xl font-bold text-sm sm:text-base text-white bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-60 shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>{progressStage || 'Generating Full Master Prompt...'}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>GENERATE FULL MASTER PROMPT</span>
            </>
          )}
        </button>

        {section1Stats.words > 2000 && !isGenerating && (
          <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium text-center">
            {lang === 'ha'
              ? `An gano dogon Master Prompt (${section1Stats.words.toLocaleString()} kalmomi). Za a sarrafa shi daki-daki ba tare da yanke rubutu ba.`
              : `Long Master Prompt detected (${section1Stats.words.toLocaleString()} words). Structure-aware multi-section pipeline is ready.`}
          </p>
        )}
      </div>

      {/* =====================================================================
          SECTION 3 — FULL CIKAKKEN RESULT — CLICK AND COPY
      ===================================================================== */}
      <section
        ref={section3ContainerRef}
        aria-label="3. Full Cikakken Result — Click and Copy"
        className="bg-white dark:bg-[#151821] border-2 border-indigo-500/30 dark:border-indigo-500/40 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <label
              htmlFor="section-3-full-result"
              className="block text-base sm:text-lg font-bold text-slate-900 dark:text-white"
            >
              3. Full Cikakken Result — Click and Copy
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {lang === 'ha'
                ? 'Cikakken sabon Master Prompt ɗinka. Danna COPY FULL RESULT don kwafar dukkan rubutun.'
                : 'Your complete, self-contained adapted Master Prompt. Click COPY FULL RESULT to copy the entire prompt.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              data-testid="section3-counter"
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/90 text-[11px] font-mono text-slate-600 dark:text-slate-300"
            >
              {section3Stats.words.toLocaleString()} {lang === 'ha' ? 'kalmomi' : 'words'} •{' '}
              {section3Stats.chars.toLocaleString()} {lang === 'ha' ? 'haruffa' : 'chars'}
            </span>

            <button
              type="button"
              data-testid="btn-copy-full-result"
              disabled={!fullResult.trim()}
              onClick={handleCopyFullResult}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer disabled:opacity-40 ${
                copyStatus === 'copied'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-500/20'
              }`}
            >
              {copyStatus === 'copied' ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>
                    {lang === 'ha'
                      ? `An Kwafi Duka (${section3Stats.chars.toLocaleString()} haruffa)!`
                      : `COPIED FULL RESULT (${section3Stats.chars.toLocaleString()} chars)!`}
                  </span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>COPY FULL RESULT</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Manual selection notice if clipboard permission required fallback */}
        {copyStatus === 'manual_fallback' && (
          <div className="bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 rounded-xl p-3 text-xs text-indigo-900 dark:text-indigo-200 flex items-center justify-between gap-2">
            <span>
              {lang === 'ha'
                ? 'An zaɓi dukkan rubutun! Yanzu danna Copy (Ctrl+C ko Long-Press Copy) don kwafa.'
                : 'All result text is now selected! Press Ctrl+C / Cmd+C (or tap Copy on mobile) to copy.'}
            </span>
            <button
              type="button"
              onClick={() => setCopyStatus('idle')}
              className="font-semibold underline cursor-pointer"
            >
              OK
            </button>
          </div>
        )}

        <textarea
          ref={resultTextareaRef}
          id="section-3-full-result"
          data-testid="output-full-result"
          value={fullResult}
          onChange={(e) => setFullResult(e.target.value)}
          rows={14}
          spellCheck={false}
          placeholder={
            lang === 'ha'
              ? 'Cikakken Sabon Master Prompt zai bayyana a nan bayan ka danna GENERATE FULL MASTER PROMPT...'
              : 'Your complete transformed Master Prompt will appear here after you click GENERATE FULL MASTER PROMPT...'
          }
          className="w-full rounded-xl bg-slate-50 dark:bg-[#0f1117] border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 p-3.5 sm:p-4 text-xs sm:text-sm font-mono text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 leading-relaxed resize-y min-h-[280px] max-h-[680px] outline-hidden"
        />

        {/* Bottom Action Bar for Section 3 */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!fullResult.trim()}
              onClick={handleCopyFullResult}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>COPY FULL RESULT</span>
            </button>

            <button
              type="button"
              disabled={!fullResult.trim()}
              onClick={handleSelectAllResultManually}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            >
              <MousePointerClick className="w-3.5 h-3.5" />
              <span>{lang === 'ha' ? 'Zaɓi Duka (Select All)' : 'Select All Text'}</span>
            </button>

            <button
              type="button"
              disabled={!fullResult.trim()}
              onClick={handleDownloadResultTxt}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{lang === 'ha' ? 'Sauke .TXT' : 'Download .TXT'}</span>
            </button>

            <button
              type="button"
              disabled={!fullResult.trim() && !originalMasterPrompt.trim()}
              onClick={() => {
                if (!saveTitle && newIdea.trim()) {
                  setSaveTitle(`Master Prompt: ${newIdea.trim().slice(0, 45)}`);
                }
                setShowSaveModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-40 text-emerald-700 dark:text-emerald-300 transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{lang === 'ha' ? 'Adana Prompt' : 'Save Prompt'}</span>
            </button>
          </div>

          {(changeSummary || validationReport) && (
            <button
              type="button"
              onClick={() => setShowDetailsDrawer((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>
                {showDetailsDrawer
                  ? lang === 'ha'
                    ? 'Boye Cikakken Bayanin Sauyi'
                    : 'Hide Adaptation Summary'
                  : lang === 'ha'
                    ? 'Duba Bayanin Sauyi & Tabbaci'
                    : 'View Adaptation Summary & Checks'}
              </span>
              {showDetailsDrawer ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>

        {/* Collapsible Adaptation Summary & Validation Drawer */}
        {showDetailsDrawer && (changeSummary || validationReport) && (
          <div className="mt-3 pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {changeSummary && (
              <div className="bg-slate-50 dark:bg-[#0f1117] border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2">
                <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                  <span>Adaptation Summary</span>
                  {modelUsed && (
                    <span className="text-[11px] font-mono text-indigo-500">{modelUsed}</span>
                  )}
                </div>
                <p className="text-slate-600 dark:text-slate-300">
                  <span className="font-semibold">Topic Shift:</span>{' '}
                  {changeSummary.originalSubjectToNewIdea}
                </p>
                {changeSummary.topicDependentSectionsChanged?.length > 0 && (
                  <div>
                    <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">
                      Adapted Topic Sections:
                    </p>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-400">
                      {changeSummary.topicDependentSectionsChanged.slice(0, 5).map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {changeSummary.universalInstructionsPreserved?.length > 0 && (
                  <div>
                    <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">
                      Preserved Universal Rules:
                    </p>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-400">
                      {changeSummary.universalInstructionsPreserved.slice(0, 4).map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {validationReport && (
              <div className="bg-slate-50 dark:bg-[#0f1117] border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2">
                <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                  <span>Validation Checks</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    {validationReport.summaryText}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {validationReport.checks.map((chk) => (
                    <li
                      key={chk.id}
                      className="flex items-start gap-2 text-slate-600 dark:text-slate-300"
                    >
                      <Check
                        className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                          chk.passed ? 'text-emerald-500' : 'text-amber-500'
                        }`}
                      />
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {chk.label}:
                        </span>{' '}
                        <span>{chk.detail}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Modal: Load Saved Prompt */}
      {showLoadSavedModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#151821] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                {lang === 'ha' ? 'Zaɓi Master Prompt Daga Adana' : 'Load a Saved Master Prompt'}
              </h3>
              <button
                type="button"
                onClick={() => setShowLoadSavedModal(false)}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                {lang === 'ha' ? 'Rufe' : 'Close'}
              </button>
            </div>

            <div className="overflow-y-auto space-y-2 pr-1 flex-1">
              {savedPrompts.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">
                  {lang === 'ha'
                    ? 'Babu Master Prompt da aka adana tukuna.'
                    : 'No saved prompts yet. You can save any Master Prompt from Section 3.'}
                </p>
              ) : (
                savedPrompts.map((sp) => (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => {
                      setActivePromptId(sp.id);
                      setOriginalMasterPrompt(sp.promptText || '');
                      if (onSelectPrompt) onSelectPrompt(sp);
                      setShowLoadSavedModal(false);
                    }}
                    className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500/60 bg-slate-50 dark:bg-[#0f1117] transition-colors cursor-pointer"
                  >
                    <div className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-white">
                      {sp.name}
                    </div>
                    <div className="text-[11px] text-slate-500 line-clamp-2 mt-1 font-mono">
                      {sp.promptText}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Save Prompt to Library */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#151821] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              {lang === 'ha' ? 'Adana Master Prompt' : 'Save Master Prompt to Library'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  {lang === 'ha' ? 'Sunan Prompt' : 'Prompt Title'}
                </label>
                <input
                  type="text"
                  value={saveTitle}
                  onChange={(e) => setSaveTitle(e.target.value)}
                  placeholder="e.g. Universal Documentary Master Prompt"
                  className="w-full rounded-xl bg-slate-50 dark:bg-[#0f1117] border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  {lang === 'ha' ? 'Rukuni (Category)' : 'Category'}
                </label>
                <input
                  type="text"
                  value={saveCategory}
                  onChange={(e) => setSaveCategory(e.target.value)}
                  placeholder="Master Prompt"
                  className="w-full rounded-xl bg-slate-50 dark:bg-[#0f1117] border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white outline-hidden"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                {lang === 'ha' ? 'Soke' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveToLibrary}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
              >
                {isSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : saveSuccess ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>{saveSuccess ? 'Saved!' : lang === 'ha' ? 'Adana Yanzu' : 'Save Now'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
