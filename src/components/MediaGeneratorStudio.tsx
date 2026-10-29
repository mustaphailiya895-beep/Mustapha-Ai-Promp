import React, { useState, useEffect } from 'react';
import { AppLanguage, getTranslations } from '../utils/i18n';
import {
  Image as ImageIcon,
  Film,
  Music,
  Sparkles,
  Download,
  Upload,
  Trash2,
  AlertCircle,
  Copy,
  Check,
  RotateCcw,
  BookmarkPlus
} from 'lucide-react';

export interface SavedMediaItem {
  id: string;
  prompt: string;
  model: string;
  aspectRatio: string;
  imageSize: string;
  mediaType: 'image' | 'video' | 'audio';
  previewData: string;
  createdAt: string;
}

interface MediaGeneratorStudioProps {
  theme: 'dark' | 'light';
  lang?: AppLanguage;
  initialTab?: 'image' | 'video' | 'music';
  savedMedia: SavedMediaItem[];
  onSaveMedia: (item: Omit<SavedMediaItem, 'id' | 'createdAt'>) => Promise<void>;
  onDeleteMedia: (id: string) => Promise<void>;
  onSavePromptToLibrary?: (promptText: string, category: string) => Promise<void>;
  onRecordUsage: (type: 'imageGenerations' | 'videoGenerations') => void;
}

const ASPECT_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9'];
const IMAGE_SIZES = ['1K', '2K', '4K'];
const IMAGE_STYLES = [
  'Photorealistic',
  'Cinematic Lighting',
  'Digital Illustration',
  '3D Render',
  'Minimalist Studio',
  'Documentary Photography'
];

export const MediaGeneratorStudio: React.FC<MediaGeneratorStudioProps> = ({
  theme,
  lang = 'en',
  initialTab = 'image',
  savedMedia,
  onSaveMedia,
  onDeleteMedia,
  onSavePromptToLibrary,
  onRecordUsage
}) => {
  const t = getTranslations(lang);
  const [activeTab, setActiveTab] = useState<'image' | 'video' | 'music'>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
    setError(null);
  }, [initialTab]);

  // Image Generation & Editing State
  const [imagePrompt, setImagePrompt] = useState(
    'Minimalist architectural pavilion made of warm cedar and curved glass beside a misty mountain lake at sunrise, studio lighting'
  );
  const [imageModel, setImageModel] = useState<
    'gemini-3.1-flash-lite-image' | 'gemini-nano-banana-2.1' | 'gemini-3-pro-image'
  >('gemini-3.1-flash-lite-image');
  const [aspectRatio, setAspectRatio] = useState<string>('16:9');
  const [imageSize, setImageSize] = useState<string>('1K');
  const [imageStyle, setImageStyle] = useState<string>('Photorealistic');
  const [editSourceBase64, setEditSourceBase64] = useState<string | null>(null);
  const [editSourceMime, setEditSourceMime] = useState<string>('image/png');
  const [editSourceName, setEditSourceName] = useState<string>('');
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [savedPromptSuccess, setSavedPromptSuccess] = useState(false);

  // Video Generation & Animation State (gemini-omni-1.1-flash via Interactions API)
  const [videoPrompt, setVideoPrompt] = useState(
    'Slow cinematic drone flight over a futuristic solar oasis at golden hour with gentle wind ripples across water'
  );
  const [videoAspectRatio, setVideoAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [videoDuration, setVideoDuration] = useState<'5s' | '10s'>('5s');
  const [videoResolution, setVideoResolution] = useState<'720p' | '1080p'>('720p');
  const [videoSourceImageBase64, setVideoSourceImageBase64] = useState<string | null>(null);
  const [videoSourceImageMime, setVideoSourceImageMime] = useState<string>('image/png');
  const [videoSourceName, setVideoSourceName] = useState<string>('');
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [videoJobStatus, setVideoJobStatus] = useState<
    'idle' | 'queued' | 'processing' | 'completed' | 'failed'
  >('idle');
  const [videoJobId, setVideoJobId] = useState<string | null>(null);

  // Music Generation State (lyria-3-clip-preview / lyria-3-pro-preview)
  const [musicPrompt, setMusicPrompt] = useState(
    'Warm ambient electronic synthwave track with gentle acoustic piano arpeggios and steady lo-fi percussion'
  );
  const [musicModel, setMusicModel] = useState<
    'lyria-3-clip-preview' | 'lyria-3-pro-preview'
  >('lyria-3-clip-preview');
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [generatedLyrics, setGeneratedLyrics] = useState<string>('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDark = theme === 'dark';

  const handleUploadImageForEditOrAnimate = (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'image-edit' | 'video-animate'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const b64 = dataUrl.split(',')[1] || '';
      if (target === 'image-edit') {
        setEditSourceBase64(b64);
        setEditSourceMime(file.type || 'image/png');
        setEditSourceName(file.name);
        setImageModel('gemini-nano-banana-2.1');
      } else {
        setVideoSourceImageBase64(b64);
        setVideoSourceImageMime(file.type || 'image/png');
        setVideoSourceName(file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateImage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isLoading) return;
    setError(null);
    if (!imagePrompt.trim()) {
      setError(
        lang === 'ha'
          ? 'Da fatan za a shigar da bayanin hoton da kake son samarwa.'
          : 'Please enter a prompt describing the image you want to create or edit.'
      );
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: imagePrompt,
          model: imageModel,
          aspectRatio,
          imageSize,
          style: imageStyle,
          sourceImageBase64: editSourceBase64,
          sourceImageMimeType: editSourceMime,
          language: lang
        })
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.error || 'Image generation failed.');
      }
      const imgUrl = data.imageUrl || data.data?.imageUrl;
      setGeneratedImageUrl(imgUrl);
      onRecordUsage('imageGenerations');
      if (imgUrl) {
        await onSaveMedia({
          prompt: imagePrompt,
          model: imageModel,
          aspectRatio,
          imageSize,
          mediaType: 'image',
          previewData: imgUrl
        });
      }
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Image generation failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateVideo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isLoading) return;
    setError(null);
    if (!videoPrompt.trim()) {
      setError(
        lang === 'ha'
          ? 'Da fatan za a shigar da bayanin bidiyon da kake son samarwa.'
          : 'Please describe the video scene or camera motion.'
      );
      return;
    }
    setIsLoading(true);
    setVideoJobStatus('queued');
    try {
      setVideoJobStatus('processing');
      const res = await fetch('/api/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: videoPrompt,
          aspectRatio: videoAspectRatio,
          duration: videoDuration,
          resolution: videoResolution,
          sourceImageBase64: videoSourceImageBase64,
          sourceImageMimeType: videoSourceImageMime,
          language: lang
        })
      });
      const data = await res.json();
      if (data.jobId) {
        setVideoJobId(data.jobId);
      }
      if (!res.ok || data.success === false) {
        setVideoJobStatus('failed');
        throw new Error(data.error || 'Video generation failed.');
      }
      const vidUrl = data.videoUrl || data.data?.videoUrl;
      setGeneratedVideoUrl(vidUrl);
      setVideoJobStatus('completed');
      onRecordUsage('videoGenerations');
    } catch (err: any) {
      setVideoJobStatus('failed');
      setError(err instanceof Error ? err.message : 'Video generation failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateMusic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setError(null);
    if (!musicPrompt.trim()) {
      setError('Please describe the musical track or genre.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/music/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: musicPrompt,
          model: musicModel,
          language: lang
        })
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.error || 'Music generation failed.');
      }
      setGeneratedAudioUrl(data.audioDataUrl || data.data?.audioDataUrl);
      setGeneratedLyrics(data.lyrics || data.data?.lyrics || '');
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Music generation failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyPrompt = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 1800);
  };

  const handleSavePrompt = async (text: string, category: string) => {
    if (!onSavePromptToLibrary || !text.trim()) return;
    await onSavePromptToLibrary(text.trim(), category);
    setSavedPromptSuccess(true);
    setTimeout(() => setSavedPromptSuccess(false), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">
            {activeTab === 'video' ? t.videoGenTitle : t.imageGenTitle}
          </h2>
          <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            {activeTab === 'video' ? t.videoGenSubtitle : t.imageGenSubtitle}
          </p>
        </div>

        {/* Interactive Tab Selector */}
        <div
          className={`inline-flex p-1 rounded-lg border self-start ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'
          }`}
        >
          <button
            type="button"
            onClick={() => {
              setActiveTab('image');
              setError(null);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'image' ? 'bg-teal-600 text-white' : 'opacity-75 hover:opacity-100'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>{t.navImageGen}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('video');
              setError(null);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'video' ? 'bg-teal-600 text-white' : 'opacity-75 hover:opacity-100'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>{t.navVideoGen}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('music');
              setError(null);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'music' ? 'bg-teal-600 text-white' : 'opacity-75 hover:opacity-100'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>Lyria Music</span>
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-300 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() =>
              activeTab === 'image' ? handleGenerateImage() : handleGenerateVideo()
            }
            disabled={isLoading}
            className="px-3 py-1.5 rounded-lg bg-teal-600 text-white font-semibold hover:bg-teal-500 shrink-0 cursor-pointer"
          >
            {t.retry}
          </button>
        </div>
      )}

      {/* TAB 1: IMAGE GENERATOR & EDITOR */}
      {activeTab === 'image' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form onSubmit={handleGenerateImage} className="lg:col-span-6 space-y-4">
            <div
              className={`p-5 rounded-xl border space-y-4 ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div>
                <label htmlFor="image-model-select" className="block text-xs font-medium mb-1">
                  Image Model
                </label>
                <select
                  id="image-model-select"
                  value={imageModel}
                  onChange={(e) => setImageModel(e.target.value as any)}
                  className={`w-full rounded-lg border px-3 py-2 text-xs ${
                    isDark ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-300'
                  }`}
                >
                  <option value="gemini-3.1-flash-lite-image">
                    Gemini 3.1 Flash Lite Image (Fast Image Generation)
                  </option>
                  <option value="gemini-nano-banana-2.1">
                    Gemini Nano Banana 2.1 (Create &amp; Edit Images)
                  </option>
                  <option value="gemini-3-pro-image">
                    Gemini 3 Pro Image (Studio Quality 1K / 2K / 4K)
                  </option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="image-prompt-input" className="block text-xs font-medium">
                    {t.imagePromptLabel}
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyPrompt(imagePrompt)}
                      className="text-[11px] text-teal-500 hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      {copiedPrompt ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedPrompt ? t.copied : t.copyPrompt}</span>
                    </button>
                    {onSavePromptToLibrary && (
                      <button
                        type="button"
                        onClick={() => handleSavePrompt(imagePrompt, 'Image Generation')}
                        className="text-[11px] text-teal-500 hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <BookmarkPlus className="w-3 h-3" />
                        <span>{t.savePrompt}</span>
                      </button>
                    )}
                  </div>
                </div>
                <textarea
                  id="image-prompt-input"
                  rows={4}
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  placeholder={
                    lang === 'ha'
                      ? 'Bayyana hoton da kake son samarwa cikin Hausa ko Turanci...'
                      : 'Describe the image you want to generate in English or Hausa...'
                  }
                  className={`w-full rounded-lg border p-3 text-sm ${
                    isDark ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-300'
                  }`}
                />
                {savedPromptSuccess && (
                  <p className="text-[11px] text-emerald-500 mt-1">
                    {lang === 'ha' ? 'An adana prompt a ma’ajiyar Prompts!' : 'Prompt saved to Saved Prompts!'}
                  </p>
                )}
              </div>

              {/* Style Selector */}
              <div>
                <span className="block text-xs font-medium mb-1.5">
                  {lang === 'ha' ? 'Salon Hoto (Style)' : 'Visual Style'}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {IMAGE_STYLES.map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setImageStyle(st)}
                      className={`py-1 px-2.5 rounded-lg text-xs border transition-colors cursor-pointer ${
                        imageStyle === st
                          ? 'bg-teal-600 text-white border-teal-600'
                          : isDark
                          ? 'bg-slate-950 border-slate-800 text-slate-300'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Aspect Ratio Selector (8 ratios) */}
              <div>
                <span className="block text-xs font-medium mb-1.5">
                  {t.aspectRatio}
                </span>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                  {ASPECT_RATIOS.map((ratio) => (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => setAspectRatio(ratio)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-mono border transition-colors cursor-pointer ${
                        aspectRatio === ratio
                          ? 'bg-teal-600 text-white border-teal-600'
                          : isDark
                          ? 'bg-slate-950 border-slate-800 text-slate-300'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>

              {/* Image Size Selector (1K, 2K, 4K) */}
              <div>
                <span className="block text-xs font-medium mb-1.5">
                  {t.outputResolution}
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {IMAGE_SIZES.map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setImageSize(sz)}
                      className={`py-1.5 px-3 rounded-lg text-xs font-mono font-semibold border transition-colors cursor-pointer ${
                        imageSize === sz
                          ? 'bg-teal-600 text-white border-teal-600'
                          : isDark
                          ? 'bg-slate-950 border-slate-800 text-slate-300'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      {sz} Resolution
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional Image Upload for Editing with Nano Banana 2.1 */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span>Reference Image for Editing (Optional · Nano Banana 2.1)</span>
                  {editSourceName && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditSourceBase64(null);
                        setEditSourceName('');
                      }}
                      className="text-red-500 hover:underline inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>
                <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-500/30 text-xs cursor-pointer hover:bg-slate-500/10">
                  <Upload className="w-3.5 h-3.5 text-teal-500" />
                  <span>{editSourceName || 'Upload Image to Edit'}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => handleUploadImageForEditOrAnimate(e, 'image-edit')}
                    className="hidden"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-display font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {isLoading
                    ? t.generatingImage
                    : editSourceBase64
                    ? 'Edit Image with Nano Banana 2.1'
                    : t.generateImageBtn}
                </span>
              </button>
            </div>
          </form>

          {/* Image Preview & Actions */}
          <div className="lg:col-span-6 space-y-4">
            <div
              className={`p-5 rounded-xl border min-h-[340px] flex flex-col justify-between ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800 gap-2">
                <span className="font-display text-sm font-semibold">
                  Generated Image Canvas
                </span>
                {generatedImageUrl && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleGenerateImage()}
                      disabled={isLoading}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border cursor-pointer ${
                        isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-teal-500" />
                      <span>{t.regenerateImage}</span>
                    </button>
                    <a
                      href={generatedImageUrl}
                      download={`mustapha-ai-${Date.now()}.png`}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-teal-600 text-white hover:bg-teal-500"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{t.downloadImage}</span>
                    </a>
                  </div>
                )}
              </div>

              <div className="my-auto py-6 flex items-center justify-center">
                {generatedImageUrl ? (
                  <img
                    src={generatedImageUrl}
                    alt={imagePrompt}
                    referrerPolicy="no-referrer"
                    className="max-h-80 rounded-lg border border-slate-700/40 object-contain"
                  />
                ) : (
                  <div className="text-center space-y-2 opacity-70">
                    <ImageIcon className="w-8 h-8 mx-auto text-teal-500" />
                    <p className="text-sm font-medium">
                      {lang === 'ha' ? 'Ba a samar da hoto ba tukuna' : 'No image generated yet'}
                    </p>
                    <p className="text-xs max-w-xs mx-auto">
                      {lang === 'ha'
                        ? `Zabi nau'in hoto (${aspectRatio}) da girman (${imageSize}), sannan danna ${t.generateImageBtn}.`
                        : `Choose your model, aspect ratio (${aspectRatio}), and resolution (${imageSize}), then click ${t.generateImageBtn}.`}
                    </p>
                  </div>
                )}
              </div>

              <div className="text-[11px] font-mono opacity-65 flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
                <span>Model: {imageModel}</span>
                <span>
                  {aspectRatio} · {imageSize} · {imageStyle}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: VIDEO GENERATION & PHOTO ANIMATION (GEMINI OMNI 1.1 FLASH) */}
      {activeTab === 'video' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form onSubmit={handleGenerateVideo} className="lg:col-span-6 space-y-4">
            <div
              className={`p-5 rounded-xl border space-y-4 ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-mono text-teal-600 dark:text-teal-400">
                <span>Interactions API · gemini-omni-1.1-flash</span>
                {videoJobStatus !== 'idle' && (
                  <span className="uppercase font-semibold">
                    Status: {videoJobStatus}
                  </span>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="video-prompt-input" className="block text-xs font-medium">
                    {t.videoPromptLabel}
                  </label>
                  <button
                    type="button"
                    onClick={() => handleCopyPrompt(videoPrompt)}
                    className="text-[11px] text-teal-500 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    {copiedPrompt ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedPrompt ? t.copied : t.copyPrompt}</span>
                  </button>
                </div>
                <textarea
                  id="video-prompt-input"
                  rows={4}
                  value={videoPrompt}
                  onChange={(e) => setVideoPrompt(e.target.value)}
                  placeholder={
                    lang === 'ha'
                      ? 'Bayyana yanayin bidiyo ko motsin kyamarar cikin Hausa ko Turanci...'
                      : 'Describe the video scene, camera motion, and lighting in English or Hausa...'
                  }
                  className={`w-full rounded-lg border p-3 text-sm ${
                    isDark ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-300'
                  }`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <span className="block text-xs font-medium mb-1">
                    {t.aspectRatio}
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['16:9', '9:16'] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setVideoAspectRatio(r)}
                        className={`py-2 px-2 rounded-lg text-xs font-mono border cursor-pointer ${
                          videoAspectRatio === r
                            ? 'bg-teal-600 text-white border-teal-600'
                            : isDark
                            ? 'bg-slate-950 border-slate-800'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="block text-xs font-medium mb-1">
                    {t.videoDuration}
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['5s', '10s'] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setVideoDuration(d)}
                        className={`py-2 px-2 rounded-lg text-xs font-mono border cursor-pointer ${
                          videoDuration === d
                            ? 'bg-teal-600 text-white border-teal-600'
                            : isDark
                            ? 'bg-slate-950 border-slate-800'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="block text-xs font-medium mb-1">
                    {t.outputResolution}
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['720p', '1080p'] as const).map((res) => (
                      <button
                        key={res}
                        type="button"
                        onClick={() => setVideoResolution(res)}
                        className={`py-2 px-2 rounded-lg text-xs font-mono border cursor-pointer ${
                          videoResolution === res
                            ? 'bg-teal-600 text-white border-teal-600'
                            : isDark
                            ? 'bg-slate-950 border-slate-800'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        {res}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span>Animate an Uploaded Photo into Video (Optional)</span>
                  {videoSourceName && (
                    <button
                      type="button"
                      onClick={() => {
                        setVideoSourceImageBase64(null);
                        setVideoSourceName('');
                      }}
                      className="text-red-500 hover:underline"
                    >
                      Remove Photo
                    </button>
                  )}
                </div>
                <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-500/30 text-xs cursor-pointer hover:bg-slate-500/10">
                  <Upload className="w-3.5 h-3.5 text-teal-500" />
                  <span>{videoSourceName || 'Upload Starting Frame Photo'}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => handleUploadImageForEditOrAnimate(e, 'video-animate')}
                    className="hidden"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-display font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <Film className="w-4 h-4" />
                <span>
                  {isLoading
                    ? t.generatingVideo
                    : videoSourceImageBase64
                    ? 'Animate Photo into Video'
                    : t.generateVideoBtn}
                </span>
              </button>
            </div>
          </form>

          <div className="lg:col-span-6">
            <div
              className={`p-5 rounded-xl border min-h-[340px] flex flex-col justify-between ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
                <span className="font-display text-sm font-semibold">
                  Video Output Player
                </span>
                {videoJobId && (
                  <span className="text-[11px] font-mono opacity-70">
                    Job: {videoJobId}
                  </span>
                )}
              </div>
              <div className="my-auto py-8 flex items-center justify-center">
                {generatedVideoUrl ? (
                  <video
                    src={generatedVideoUrl}
                    controls
                    autoPlay
                    loop
                    className="max-h-80 rounded-lg border border-slate-700/40"
                  />
                ) : (
                  <div className="text-center space-y-2 opacity-70">
                    <Film className="w-8 h-8 mx-auto text-teal-500" />
                    <p className="text-sm font-medium">
                      {lang === 'ha'
                        ? 'Shirye don samar da bidiyo'
                        : 'Ready to generate or animate video'}
                    </p>
                    <p className="text-xs max-w-xs mx-auto">
                      Uses <code className="font-mono">gemini-omni-1.1-flash</code> via the
                      Interactions API ({videoAspectRatio} · {videoDuration} · {videoResolution}).
                    </p>
                  </div>
                )}
              </div>
              <div className="text-[11px] font-mono opacity-65 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span>Model: gemini-omni-1.1-flash</span>
                <span>
                  {videoAspectRatio} · {videoDuration} · {videoResolution}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: LYRIA 3 MUSIC GENERATOR */}
      {activeTab === 'music' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form onSubmit={handleGenerateMusic} className="lg:col-span-6 space-y-4">
            <div
              className={`p-5 rounded-xl border space-y-4 ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div>
                <label htmlFor="music-model-select" className="block text-xs font-medium mb-1">
                  Lyria 3 Model
                </label>
                <select
                  id="music-model-select"
                  value={musicModel}
                  onChange={(e) => setMusicModel(e.target.value as any)}
                  className={`w-full rounded-lg border px-3 py-2 text-xs ${
                    isDark ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-300'
                  }`}
                >
                  <option value="lyria-3-clip-preview">
                    Lyria 3 Clip Preview (Up to 30s Music Clip)
                  </option>
                  <option value="lyria-3-pro-preview">
                    Lyria 3 Pro Preview (Full-Length Studio Track)
                  </option>
                </select>
              </div>

              <div>
                <label htmlFor="music-prompt-input" className="block text-xs font-medium mb-1">
                  Music &amp; Instrumentation Prompt
                </label>
                <textarea
                  id="music-prompt-input"
                  rows={4}
                  value={musicPrompt}
                  onChange={(e) => setMusicPrompt(e.target.value)}
                  className={`w-full rounded-lg border p-3 text-sm ${
                    isDark ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-300'
                  }`}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-display font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <Music className="w-4 h-4" />
                <span>{isLoading ? 'Composing with Lyria 3...' : 'Generate Music Track'}</span>
              </button>
            </div>
          </form>

          <div className="lg:col-span-6">
            <div
              className={`p-5 rounded-xl border min-h-[300px] flex flex-col justify-between ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <span className="font-display text-sm font-semibold border-b pb-3 border-slate-200 dark:border-slate-800">
                Audio Deck &amp; Lyrics
              </span>
              <div className="my-auto py-8 space-y-4">
                {generatedAudioUrl ? (
                  <div className="space-y-4">
                    <audio src={generatedAudioUrl} controls className="w-full" />
                    {generatedLyrics && (
                      <div className="p-3 rounded-lg border border-slate-700/40 font-mono text-xs whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {generatedLyrics}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center space-y-2 opacity-70">
                    <Music className="w-8 h-8 mx-auto text-teal-500" />
                    <p className="text-sm font-medium">No track generated yet</p>
                    <p className="text-xs max-w-xs mx-auto">
                      Select <code className="font-mono">lyria-3-clip-preview</code> or{' '}
                      <code className="font-mono">lyria-3-pro-preview</code> and compose.
                    </p>
                  </div>
                )}
              </div>
              <div className="text-[11px] font-mono opacity-65 pt-3 border-t border-slate-200 dark:border-slate-800">
                Model: {musicModel}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Saved Generations History Strip */}
      {savedMedia.length > 0 && (
        <div
          className={`p-5 rounded-xl border space-y-3 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <h3 className="font-display text-sm font-semibold">
            Your Private Generation History ({savedMedia.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {savedMedia.map((item) => (
              <div
                key={item.id}
                className={`p-3 rounded-lg border space-y-2 ${
                  isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                {item.mediaType === 'image' && (
                  <img
                    src={item.previewData}
                    alt={item.prompt}
                    referrerPolicy="no-referrer"
                    className="w-full h-36 object-cover rounded-md"
                  />
                )}
                <p className="text-xs line-clamp-2">{item.prompt}</p>
                <div className="flex items-center justify-between text-[11px] font-mono opacity-70">
                  <span>
                    {item.aspectRatio} · {item.imageSize}
                  </span>
                  <button
                    type="button"
                    onClick={() => onDeleteMedia(item.id)}
                    className="text-red-500 hover:underline"
                  >
                    {t.delete}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
