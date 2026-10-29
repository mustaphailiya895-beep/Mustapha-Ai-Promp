import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  FileImage,
  FileVideo,
  Sparkles,
  Copy,
  Check,
  BookmarkPlus,
  Loader2,
  Trash2,
  RefreshCw,
  AlertCircle,
  Eye,
  Film,
  Info,
  MousePointerClick
} from 'lucide-react';
import { AppLanguage } from '../utils/i18n';
import {
  saveDraftRecord,
  loadDraftRecord,
  copyTextReliably,
  AnalyzerDraftRecord
} from '../utils/draftStorage';

interface VisionStudioProps {
  theme?: 'dark' | 'light';
  lang: AppLanguage;
  onSendPromptToStudio?: (promptText: string) => void;
  onRecordUsage?: (
    type: 'textRequests' | 'imageGenerations' | 'videoGenerations' | 'voiceRequests'
  ) => void;
}

interface ExtractedFrame {
  data: string;
  mimeType: string;
  timestampSec: number;
}

const ANALYZER_DRAFT_ID = 'content_image_video_analyzer_v2';
const MAX_FILE_SIZE_BYTES = 35 * 1024 * 1024; // 35MB

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

/**
 * Extracts up to 6 chronological representative frames from a video File on the client
 * using an offscreen HTML5 <video> and <canvas>, ensuring reliable multi-frame inspection
 * across opening, middle progression, and ending scenes.
 */
async function extractChronologicalVideoFrames(
  file: File,
  maxFrames = 6
): Promise<ExtractedFrame[]> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    const frames: ExtractedFrame[] = [];
    const cleanup = () => {
      URL.revokeObjectURL(url);
    };

    const timeoutId = window.setTimeout(() => {
      cleanup();
      resolve(frames);
    }, 15000);

    video.onloadedmetadata = async () => {
      try {
        const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 4;
        const ratios = [0.05, 0.22, 0.42, 0.62, 0.82, 0.95].slice(0, maxFrames);
        const timestamps = ratios.map((r) => Math.min(Math.max(0.1, duration * r), Math.max(0.1, duration - 0.1)));

        const canvas = document.createElement('canvas');
        const targetWidth = Math.min(768, video.videoWidth || 640);
        const aspect =
          video.videoWidth && video.videoHeight ? video.videoHeight / video.videoWidth : 9 / 16;
        canvas.width = targetWidth;
        canvas.height = Math.round(targetWidth * aspect);
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          window.clearTimeout(timeoutId);
          cleanup();
          resolve([]);
          return;
        }

        for (const ts of timestamps) {
          await new Promise<void>((seekResolve) => {
            const onSeeked = () => {
              video.removeEventListener('seeked', onSeeked);
              try {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
                const base64 = dataUrl.split(',')[1] || '';
                if (base64) {
                  frames.push({
                    data: base64,
                    mimeType: 'image/jpeg',
                    timestampSec: Number(ts.toFixed(1))
                  });
                }
              } catch {
                // Ignore canvas security/decode glitch on individual frame
              }
              seekResolve();
            };
            video.addEventListener('seeked', onSeeked);
            try {
              video.currentTime = ts;
            } catch {
              video.removeEventListener('seeked', onSeeked);
              seekResolve();
            }
          });
        }
      } catch {
        // Fallback if frame extraction partially fails
      } finally {
        window.clearTimeout(timeoutId);
        cleanup();
        resolve(frames);
      }
    };

    video.onerror = () => {
      window.clearTimeout(timeoutId);
      cleanup();
      resolve([]);
    };
  });
}

export const VisionStudio: React.FC<VisionStudioProps> = ({
  lang,
  onSendPromptToStudio,
  onRecordUsage
}) => {
  // File upload states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mediaBase64, setMediaBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('image/png');
  const [mediaKind, setMediaKind] = useState<'image' | 'video'>('image');
  const [extractedFrames, setExtractedFrames] = useState<ExtractedFrame[]>([]);
  const [isExtractingFrames, setIsExtractingFrames] = useState(false);

  // Optional user focus note
  const [userNotes, setUserNotes] = useState('');

  // Structured Analyzer Outputs
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contentType, setContentType] = useState('');
  const [isScreenshotDetected, setIsScreenshotDetected] = useState(false);
  const [visualObservations, setVisualObservations] = useState<string[]>([]);
  const [honestyDisclosure, setHonestyDisclosure] = useState('');
  const [fullAiPrompt, setFullAiPrompt] = useState('');
  const [modelUsed, setModelUsed] = useState('');

  // Status states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedTitle, setCopiedTitle] = useState(false);
  const [copiedFullPrompt, setCopiedFullPrompt] = useState<'idle' | 'copied' | 'manual'>('idle');
  const [savedPromptSuccess, setSavedPromptSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fullPromptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  // Recover latest analyzer draft on mount
  useEffect(() => {
    let cancelled = false;
    loadDraftRecord<AnalyzerDraftRecord>(ANALYZER_DRAFT_ID).then((draft) => {
      if (cancelled || !draft) return;
      if (draft.title || draft.fullAiPrompt) {
        setGeneratedTitle(draft.title || '');
        setDescription(draft.description || '');
        setContentType(draft.contentType || '');
        setFullAiPrompt(draft.fullAiPrompt || '');
        setHonestyDisclosure(draft.honestyDisclosure || '');
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Save draft whenever output changes
  useEffect(() => {
    if (!generatedTitle && !fullAiPrompt) return;
    const timer = window.setTimeout(() => {
      saveDraftRecord<AnalyzerDraftRecord>({
        id: ANALYZER_DRAFT_ID,
        title: generatedTitle,
        description,
        contentType,
        fullAiPrompt,
        honestyDisclosure,
        fileName: selectedFile?.name,
        updatedAt: Date.now()
      });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [generatedTitle, description, contentType, fullAiPrompt, honestyDisclosure, selectedFile]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);

    const validImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const validVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    const isImage = validImageTypes.includes(file.type) || file.type.startsWith('image/');
    const isVideo = validVideoTypes.includes(file.type) || file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      setErrorMsg(
        lang === 'ha'
          ? 'Wannan nau’in fayil ba a tallafa masa ba. Da fatan za a zaɓi Hoto (JPG, PNG, WebP, GIF) ko Bidiyo (MP4, WebM, MOV).'
          : 'Unsupported file format. Please select a valid Screenshot/Image (JPG, PNG, WebP, GIF) or Video (MP4, WebM, MOV).'
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMsg(
        lang === 'ha'
          ? `Girman fayil (${formatBytes(file.size)}) ya wuce iyakar 35MB. Da fatan za a zaɓi fayil mara nauyi.`
          : `File size (${formatBytes(file.size)}) exceeds the 35MB limit. Please select a smaller image or shorter video clip.`
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
    setMimeType(file.type || (isVideo ? 'video/mp4' : 'image/png'));
    setMediaKind(isVideo ? 'video' : 'image');
    setExtractedFrames([]);

    // Read base64 for preview & upload
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      setPreviewUrl(dataUrl);
      const base64Data = dataUrl.split(',')[1] || '';
      // For huge videos (> 15MB), we rely on extracted chronological keyframes to avoid oversized base64 payloads
      if (isVideo && file.size > 15 * 1024 * 1024) {
        setMediaBase64(null);
      } else {
        setMediaBase64(base64Data);
      }
    };
    reader.readAsDataURL(file);

    // If video, extract chronological keyframes for accurate multi-frame visual progression analysis
    if (isVideo) {
      setIsExtractingFrames(true);
      try {
        const frames = await extractChronologicalVideoFrames(file, 6);
        setExtractedFrames(frames);
      } finally {
        setIsExtractingFrames(false);
      }
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setMediaBase64(null);
    setExtractedFrames([]);
    setErrorMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleTriggerSelectAnother = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleAnalyzeMedia = async () => {
    if (isAnalyzing || isExtractingFrames) return;
    setErrorMsg(null);

    if (!mediaBase64 && extractedFrames.length === 0) {
      setErrorMsg(
        lang === 'ha'
          ? 'Da fatan za a loda Screenshot, Hoto ko Bidiyo tukuna.'
          : 'Please upload a Screenshot, Image, or Video file first.'
      );
      return;
    }

    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/content-analyzer/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaBase64,
          mimeType,
          frames: extractedFrames,
          userNotes: userNotes.trim(),
          language: lang
        })
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(
          data.error ||
            (lang === 'ha'
              ? 'An sami matsala wajen nazarin wannan fayil. Da fatan za a sake gwadawa.'
              : 'Failed to analyze the uploaded media. Please try again.')
        );
      }

      const titleOut = String(data.title || 'Visual Reference Content Title').trim();
      const descOut = String(data.description || '').trim();
      const typeOut = String(data.contentType || (mediaKind === 'video' ? 'Video Reference' : 'Image Reference')).trim();
      const promptOut = String(data.fullAiPrompt || data.analysis || '').trim();

      setGeneratedTitle(titleOut);
      setDescription(descOut);
      setContentType(typeOut);
      setIsScreenshotDetected(Boolean(data.isScreenshot));
      setVisualObservations(Array.isArray(data.visualObservations) ? data.visualObservations : []);
      setHonestyDisclosure(String(data.honestyDisclosure || '').trim());
      setFullAiPrompt(promptOut);
      setModelUsed(data.modelUsed || 'gemini-3.1-flash-lite');

      if (onRecordUsage) {
        onRecordUsage('textRequests');
      }

      window.setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    } catch (err: any) {
      setErrorMsg(
        err?.message ||
          (lang === 'ha'
            ? 'Ba a sami damar kammala nazarin hoto/bidiyo ba. Da fatan za a sake gwadawa.'
            : 'Could not complete the content analysis right now. Please try again.')
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopyTitle = async () => {
    if (!generatedTitle.trim()) return;
    const res = await copyTextReliably(generatedTitle);
    if (res.ok) {
      setCopiedTitle(true);
      window.setTimeout(() => setCopiedTitle(false), 2500);
    }
  };

  const handleCopyFullPrompt = async () => {
    if (!fullAiPrompt.trim()) return;
    const res = await copyTextReliably(fullAiPrompt);
    if (res.ok) {
      setCopiedFullPrompt('copied');
      window.setTimeout(() => setCopiedFullPrompt('idle'), 3000);
    } else {
      setCopiedFullPrompt('manual');
      if (fullPromptTextareaRef.current) {
        fullPromptTextareaRef.current.focus();
        fullPromptTextareaRef.current.select();
        fullPromptTextareaRef.current.setSelectionRange(0, fullAiPrompt.length);
      }
    }
  };

  const handleSaveGeneratedPrompt = () => {
    if (!fullAiPrompt.trim()) return;
    if (onSendPromptToStudio) {
      onSendPromptToStudio(fullAiPrompt.trim());
    }
    setSavedPromptSuccess(true);
    window.setTimeout(() => setSavedPromptSuccess(false), 2500);
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-[#151821] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-semibold tracking-wide uppercase mb-1.5">
          <Eye className="w-3.5 h-3.5" />
          <span>CONTENT IMAGE & VIDEO ANALYZER</span>
        </div>
        <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
          {lang === 'ha'
            ? 'Nazarin Screenshot, Hoto ko Bidiyo & Samar da Sunan Content da Cikakken AI Prompt'
            : 'Analyze Any Screenshot, Image, or Video — Generate Title & Full AI Prompt'}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
          {lang === 'ha'
            ? 'Loda hoton screenshot na TikTok/YouTube/Instagram, hoto na yau da kullun, ko bidiyo. AI zai fahimci abin da ke ciki, ya ba ka Sunan Content (Title) da Cikakken AI Prompt.'
            : 'Upload a social media screenshot, image, or video clip. The analyzer inspects the real visual content, generates a suitable Content Title, and builds a complete, copy-ready AI Prompt.'}
        </p>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70 rounded-xl p-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm text-rose-800 dark:text-rose-200">{errorMsg}</div>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
          >
            {lang === 'ha' ? 'Rufe' : 'Dismiss'}
          </button>
        </div>
      )}

      {/* =====================================================================
          UPLOAD SECTION — "Upload Screenshot, Image ko Video"
      ===================================================================== */}
      <section
        aria-label="Upload Screenshot, Image ko Video"
        className="bg-white dark:bg-[#151821] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Upload Screenshot, Image ko Video
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {lang === 'ha'
                ? 'Yana karɓar: JPG, PNG, WebP, GIF, MP4, WebM, MOV (har zuwa 35MB)'
                : 'Supported formats: Screenshots, JPG, PNG, WebP, GIF, MP4, WebM, MOV (up to 35MB)'}
            </p>
          </div>

          {selectedFile && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleTriggerSelectAnother}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{lang === 'ha' ? 'Zaɓi Wani Fayil' : 'Select Another File'}</span>
              </button>
              <button
                type="button"
                onClick={handleRemoveFile}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{lang === 'ha' ? 'Cire Fayil' : 'Remove File'}</span>
              </button>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,image/*,video/*"
          onChange={handleFileChange}
          className="hidden"
          data-testid="input-upload-media"
        />

        {!previewUrl ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all bg-slate-50/70 dark:bg-[#0f1117]/60 hover:bg-indigo-500/5"
          >
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3">
              <Upload className="w-7 h-7" />
            </div>
            <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              {lang === 'ha'
                ? 'Danna nan don loda Screenshot, Hoto ko Bidiyo'
                : 'Click to upload Screenshot, Image, or Video'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {lang === 'ha'
                ? 'Hoton TikTok/YouTube/Instagram, Hoto na yau da kullun, ko Bidiyo (MP4 / WebM / MOV)'
                : 'Social media screenshots, reference photos, product shots, or video clips'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* File Metadata Bar */}
            {selectedFile && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-[#0f1117] border border-slate-200 dark:border-slate-800 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  {mediaKind === 'video' ? (
                    <FileVideo className="w-4 h-4 text-indigo-500 shrink-0" />
                  ) : (
                    <FileImage className="w-4 h-4 text-indigo-500 shrink-0" />
                  )}
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {selectedFile.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                    {formatBytes(selectedFile.size)}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold uppercase text-[10px]">
                    {mediaKind === 'video' ? 'VIDEO' : 'IMAGE / SCREENSHOT'}
                  </span>
                </div>
              </div>
            )}

            {/* Preview Container */}
            <div className="rounded-xl overflow-hidden bg-slate-950/90 border border-slate-200 dark:border-slate-800 flex items-center justify-center max-h-[380px]">
              {mediaKind === 'video' ? (
                <video
                  src={previewUrl}
                  controls
                  className="max-h-[360px] w-auto object-contain"
                />
              ) : (
                <img
                  src={previewUrl}
                  alt="Uploaded reference preview"
                  className="max-h-[360px] w-auto object-contain"
                />
              )}
            </div>

            {/* Chronological Video Keyframes Strip */}
            {mediaKind === 'video' && (
              <div className="bg-slate-50 dark:bg-[#0f1117] border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Film className="w-3.5 h-3.5 text-indigo-500" />
                    {isExtractingFrames
                      ? lang === 'ha'
                        ? 'Ana ciro muhimman sassa daga bidiyon...'
                        : 'Extracting chronological keyframes across video...'
                      : lang === 'ha'
                        ? `An ciro sassa ${extractedFrames.length} na bidiyon don cikakken nazari`
                        : `Extracted ${extractedFrames.length} chronological video keyframes for multi-scene analysis`}
                  </span>
                </div>
                {extractedFrames.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {extractedFrames.map((f, idx) => (
                      <div
                        key={idx}
                        className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-black aspect-video"
                      >
                        <img
                          src={`data:${f.mimeType};base64,${f.data}`}
                          alt={`Frame at ${f.timestampSec}s`}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/75 text-[10px] font-mono text-white">
                          {f.timestampSec}s
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Optional User Direction Input */}
        <div className="pt-1">
          <label
            htmlFor="analyzer-user-notes"
            className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1"
          >
            {lang === 'ha'
              ? 'Ƙarin Bayani (Zaɓi — idan kana son AI ya mai da hankali kan wani abu na musamman):'
              : 'Optional Focus Note (leave blank for automatic full analysis, title & prompt):'}
          </label>
          <input
            id="analyzer-user-notes"
            type="text"
            value={userNotes}
            onChange={(e) => setUserNotes(e.target.value)}
            placeholder={
              lang === 'ha'
                ? 'Misali: Mai da hankali kan yanayin haske da motsin kyamarar...'
                : 'e.g. Focus on lighting style, character outfit, or adapt prompt for 9:16 vertical format...'
            }
            className="w-full rounded-xl bg-slate-50 dark:bg-[#0f1117] border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-hidden focus:border-indigo-500"
          />
        </div>

        {/* Analyze Action Button */}
        <button
          type="button"
          data-testid="btn-analyze-content"
          disabled={(!mediaBase64 && extractedFrames.length === 0) || isAnalyzing || isExtractingFrames}
          onClick={handleAnalyzeMedia}
          className="w-full py-3.5 px-6 rounded-2xl font-bold text-sm sm:text-base text-white bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2.5 transition-all cursor-pointer"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>
                {lang === 'ha'
                  ? 'Ana Nazarin Fayil & Samar da Title da Cikakken Prompt...'
                  : 'Analyzing Reference & Generating Content Title + Full AI Prompt...'}
              </span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>
                {lang === 'ha'
                  ? 'NAZARI & SAMAR DA TITLE + FULL AI PROMPT'
                  : 'ANALYZE & GENERATE TITLE + FULL AI PROMPT'}
              </span>
            </>
          )}
        </button>
      </section>

      {/* =====================================================================
          STRUCTURED OUTPUTS:
          1. CONTENT TITLE ("COPY TITLE")
          2. CONCISE REFERENCE DESCRIPTION & OBSERVATIONS
          3. FULL AI PROMPT ("COPY FULL AI PROMPT")
      ===================================================================== */}
      {(generatedTitle || fullAiPrompt) && (
        <div ref={resultsRef} className="space-y-5">
          {/* 1. GENERATED CONTENT TITLE */}
          <section
            aria-label="Generated Content Title"
            className="bg-white dark:bg-[#151821] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase">
                  1. CONTENT TITLE
                </span>
                {contentType && (
                  <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium">
                    {contentType}
                  </span>
                )}
              </div>

              <button
                type="button"
                data-testid="btn-copy-title"
                onClick={handleCopyTitle}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  copiedTitle
                    ? 'bg-emerald-600 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                {copiedTitle ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{lang === 'ha' ? 'An Kwafi Title!' : 'COPIED TITLE!'}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>COPY TITLE</span>
                  </>
                )}
              </button>
            </div>

            <input
              type="text"
              data-testid="output-content-title"
              value={generatedTitle}
              onChange={(e) => setGeneratedTitle(e.target.value)}
              className="w-full rounded-xl bg-slate-50 dark:bg-[#0f1117] border border-slate-200 dark:border-slate-800 px-4 py-3 text-sm sm:text-base font-bold text-slate-900 dark:text-white outline-hidden focus:border-indigo-500"
            />
          </section>

          {/* 2. CONCISE DESCRIPTION & VISUAL OBSERVATIONS */}
          <section
            aria-label="Reference Description"
            className="bg-white dark:bg-[#151821] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase">
                2. REFERENCE DESCRIPTION & VISUAL BREAKDOWN
              </span>
              {isScreenshotDetected && (
                <span className="px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium">
                  {lang === 'ha'
                    ? 'An ware asalin hoton daga maɓallan manhaja (Screenshot UI separated)'
                    : 'Screenshot detected — UI chrome separated from scene content'}
                </span>
              )}
            </div>

            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
              {description}
            </p>

            {visualObservations.length > 0 && (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {visualObservations.map((obs, idx) => (
                  <li
                    key={idx}
                    className="text-xs bg-slate-50 dark:bg-[#0f1117] border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-600 dark:text-slate-300"
                  >
                    • {obs}
                  </li>
                ))}
              </ul>
            )}

            {honestyDisclosure && (
              <div className="flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#0f1117] rounded-xl p-2.5 border border-slate-200/70 dark:border-slate-800">
                <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                <span>
                  {honestyDisclosure} {modelUsed ? `(${modelUsed})` : ''}
                </span>
              </div>
            )}
          </section>

          {/* 3. FULL AI PROMPT */}
          <section
            aria-label="FULL AI PROMPT"
            className="bg-white dark:bg-[#151821] border-2 border-indigo-500/30 dark:border-indigo-500/40 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  FULL AI PROMPT
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {lang === 'ha'
                    ? 'Cikakken AI Prompt da aka tsara daga wannan hoto ko bidiyo — a shirye don kwafa.'
                    : 'Complete, ready-to-use AI Prompt inspired by your reference — click COPY FULL AI PROMPT.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="btn-copy-full-ai-prompt"
                  onClick={handleCopyFullPrompt}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                    copiedFullPrompt === 'copied'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-500/20'
                  }`}
                >
                  {copiedFullPrompt === 'copied' ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>
                        {lang === 'ha' ? 'AN KWAFI FULL AI PROMPT!' : 'COPIED FULL AI PROMPT!'}
                      </span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>COPY FULL AI PROMPT</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {copiedFullPrompt === 'manual' && (
              <div className="bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 rounded-xl p-3 text-xs text-indigo-900 dark:text-indigo-200">
                {lang === 'ha'
                  ? 'An zaɓi dukkan rubutun! Danna Copy (Ctrl+C ko Long-Press Copy) don kwafa.'
                  : 'All prompt text is selected! Press Ctrl+C / Cmd+C (or tap Copy) to copy.'}
              </div>
            )}

            <textarea
              ref={fullPromptTextareaRef}
              data-testid="output-full-ai-prompt"
              value={fullAiPrompt}
              onChange={(e) => setFullAiPrompt(e.target.value)}
              rows={12}
              spellCheck={false}
              className="w-full rounded-xl bg-slate-50 dark:bg-[#0f1117] border border-slate-200 dark:border-slate-800 focus:border-indigo-500 p-3.5 sm:p-4 text-xs sm:text-sm font-mono text-slate-900 dark:text-slate-100 leading-relaxed resize-y min-h-[240px] outline-hidden"
            />

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyFullPrompt}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>COPY FULL AI PROMPT</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (fullPromptTextareaRef.current) {
                      fullPromptTextareaRef.current.focus();
                      fullPromptTextareaRef.current.select();
                      fullPromptTextareaRef.current.setSelectionRange(0, fullAiPrompt.length);
                      setCopiedFullPrompt('manual');
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                >
                  <MousePointerClick className="w-3.5 h-3.5" />
                  <span>{lang === 'ha' ? 'Zaɓi Duka' : 'Select All'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleSaveGeneratedPrompt}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 transition-colors cursor-pointer"
              >
                {savedPromptSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>{lang === 'ha' ? 'An Adana!' : 'Saved to Prompts!'}</span>
                  </>
                ) : (
                  <>
                    <BookmarkPlus className="w-3.5 h-3.5" />
                    <span>{lang === 'ha' ? 'Adana a Saved Prompts' : 'Save to Prompts'}</span>
                  </>
                )}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
