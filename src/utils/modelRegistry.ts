export type ModelCapability =
  | 'chat'
  | 'master_prompt'
  | 'thinking'
  | 'search_grounding'
  | 'low_latency'
  | 'image_understanding'
  | 'video_understanding'
  | 'image_generation'
  | 'image_editing'
  | 'video_generation'
  | 'audio_transcription'
  | 'tts'
  | 'live_voice'
  | 'music_generation'
  | 'bioscience';

export interface AIModelConfig {
  id: string;
  displayName: string;
  provider: 'Google Gemini' | 'OpenAI' | 'Anthropic' | 'Stability AI';
  providerId: 'gemini' | 'openai' | 'anthropic' | 'stability';
  description: string;
  capabilities: ModelCapability[];
  enabled: boolean;
  configured: boolean;
  requiresPaidKey: boolean;
  badge: string;
  supportedAspectRatios?: string[];
  supportedImageSizes?: string[];
}

export const MODEL_REGISTRY: AIModelConfig[] = [
  {
    id: 'gemini-3.1-flash-lite',
    displayName: 'Gemini 3.1 Flash Lite (Fast & Reliable)',
    provider: 'Google Gemini',
    providerId: 'gemini',
    description:
      'High-availability, low-latency model for English & Hausa AI Chat, Image Analysis, and Master Prompt Studio.',
    capabilities: ['chat', 'master_prompt', 'low_latency', 'image_understanding', 'bioscience'],
    enabled: true,
    configured: true,
    requiresPaidKey: false,
    badge: 'Active · High Quota'
  },
  {
    id: 'gemini-3.8-flash',
    displayName: 'Gemini 3.8 Flash',
    provider: 'Google Gemini',
    providerId: 'gemini',
    description:
      'Balanced reasoning model for everyday chat, Master Prompt execution, and Google Search grounding (auto-falls back to 3.1 Flash Lite if daily free quota is reached).',
    capabilities: ['chat', 'master_prompt', 'search_grounding', 'image_understanding', 'bioscience'],
    enabled: true,
    configured: true,
    requiresPaidKey: false,
    badge: 'General & Search'
  },
  {
    id: 'gemini-4-argon',
    displayName: 'Gemini 4 Argon',
    provider: 'Google Gemini',
    providerId: 'gemini',
    description:
      'Flagship reasoning model with High Thinking mode and multimodal image/video understanding (auto-falls back if Paid Tier is not active).',
    capabilities: [
      'chat',
      'master_prompt',
      'thinking',
      'search_grounding',
      'image_understanding',
      'video_understanding',
      'bioscience'
    ],
    enabled: true,
    configured: true,
    requiresPaidKey: true,
    badge: 'Flagship Reasoning'
  },
  {
    id: 'gemini-3.1-flash-lite-image',
    displayName: 'Gemini 3.1 Flash Lite Image (Nano Banana Lite)',
    provider: 'Google Gemini',
    providerId: 'gemini',
    description:
      'Default Gemini image generation and editing model supporting square, portrait, and landscape aspect ratios (requires billing-enabled Gemini API key).',
    capabilities: ['image_generation', 'image_editing'],
    enabled: true,
    configured: true,
    requiresPaidKey: true,
    badge: 'Image Gen (Paid Tier)',
    supportedAspectRatios: ['1:1', '3:4', '4:3', '9:16', '16:9'],
    supportedImageSizes: ['1K']
  },
  {
    id: 'gemini-nano-banana-2.1',
    displayName: 'Gemini Nano Banana 2.1',
    provider: 'Google Gemini',
    providerId: 'gemini',
    description:
      'High-resolution image creation and conversational editing across 1K, 2K, and 4K resolutions (requires billing-enabled Gemini API key).',
    capabilities: ['image_generation', 'image_editing'],
    enabled: true,
    configured: true,
    requiresPaidKey: true,
    badge: '1K/2K/4K (Paid Tier)',
    supportedAspectRatios: ['1:1', '3:4', '4:3', '9:16', '16:9'],
    supportedImageSizes: ['1K', '2K', '4K']
  },
  {
    id: 'gemini-3-pro-image',
    displayName: 'Gemini 3 Pro Image',
    provider: 'Google Gemini',
    providerId: 'gemini',
    description:
      'Studio-grade image generation with selectable 1K, 2K, and 4K resolution and precise aspect ratio control (requires billing-enabled Gemini API key).',
    capabilities: ['image_generation'],
    enabled: true,
    configured: true,
    requiresPaidKey: true,
    badge: 'Studio Pro (Paid Tier)',
    supportedAspectRatios: ['1:1', '3:4', '4:3', '9:16', '16:9'],
    supportedImageSizes: ['1K', '2K', '4K']
  },
  {
    id: 'gemini-omni-1.1-flash',
    displayName: 'Gemini Omni 1.1 Flash (Veo Video)',
    provider: 'Google Gemini',
    providerId: 'gemini',
    description:
      'Generates and animates high-definition videos (16:9 landscape or 9:16 portrait, 5s/10s) via the Interactions API (requires billing-enabled Gemini API key).',
    capabilities: ['video_generation'],
    enabled: true,
    configured: true,
    requiresPaidKey: true,
    badge: 'Video (Paid Tier)',
    supportedAspectRatios: ['16:9', '9:16']
  },
  {
    id: 'gemini-3.5-transcribe',
    displayName: 'Gemini 3.5 Transcribe',
    provider: 'Google Gemini',
    providerId: 'gemini',
    description:
      'High-accuracy speech-to-text audio transcription for voice recordings and spoken notes.',
    capabilities: ['audio_transcription'],
    enabled: true,
    configured: true,
    requiresPaidKey: false,
    badge: 'Active · Speech-to-Text'
  },
  {
    id: 'gemini-3.8-flash-lite-tts',
    displayName: 'Gemini 3.8 Flash Lite TTS',
    provider: 'Google Gemini',
    providerId: 'gemini',
    description:
      'Low-latency natural text-to-speech voice synthesis returning playable WAV audio.',
    capabilities: ['tts'],
    enabled: true,
    configured: true,
    requiresPaidKey: false,
    badge: 'Active · Text-to-Speech'
  },
  {
    id: 'gemini-3.8-live',
    displayName: 'Gemini 3.8 Live',
    provider: 'Google Gemini',
    providerId: 'gemini',
    description:
      'Real-time bidirectional voice conversation over low-latency WebSocket audio streaming.',
    capabilities: ['live_voice'],
    enabled: true,
    configured: true,
    requiresPaidKey: false,
    badge: 'Real-Time Voice'
  },
  {
    id: 'lyria-3-clip-preview',
    displayName: 'Lyria 3 Clip Preview',
    provider: 'Google Gemini',
    providerId: 'gemini',
    description:
      'Generates 30-second instrumental or vocal music clips from text prompts (requires billing-enabled Gemini API key).',
    capabilities: ['music_generation'],
    enabled: true,
    configured: true,
    requiresPaidKey: true,
    badge: '30s Music (Paid Tier)'
  }
];

export function validateModelCapability(
  modelId: string,
  requiredCapability: ModelCapability
): { valid: boolean; reason?: string; suggestedModelId?: string } {
  const model = MODEL_REGISTRY.find((m) => m.id === modelId);
  const fallback = MODEL_REGISTRY.find(
    (m) => m.enabled && m.configured && m.capabilities.includes(requiredCapability)
  );

  if (!model) {
    return {
      valid: false,
      reason: `Model "${modelId}" is not registered in the MUSTAPHA AI PROMPT model hub.`,
      suggestedModelId: fallback?.id
    };
  }

  if (!model.configured || !model.enabled) {
    return {
      valid: false,
      reason: `${model.displayName} (${model.provider}) is not currently enabled or is missing required server API credentials.`,
      suggestedModelId: fallback?.id
    };
  }

  if (!model.capabilities.includes(requiredCapability)) {
    return {
      valid: false,
      reason: `${model.displayName} does not support the "${requiredCapability.replace(/_/g, ' ')}" capability.`,
      suggestedModelId: fallback?.id
    };
  }

  return { valid: true };
}

export const PROMPT_CATEGORIES = [
  'AI Video Generation',
  'AI Image Generation',
  'Story or Script',
  'Character Design',
  'Writing and Translation',
  'Social Media Content',
  'Coding',
  'General Productivity'
] as const;

export interface SavedMasterPrompt {
  id: string;
  userId: string;
  name: string;
  description: string;
  category: string;
  promptText: string;
  outputLanguage: string;
  outputType: string;
  targetPlatform: string;
  desiredLength: string;
  characterLimit: number;
  exactCharCount: boolean;
  createdAt: string;
  updatedAt: string;
}

export const STARTER_MASTER_PROMPTS: SavedMasterPrompt[] = [
  {
    id: 'starter-video-cinematic',
    userId: 'system',
    name: 'Cinematic AI Video Director Blueprint',
    description:
      'Transforms any short video idea (English or Hausa) into a structured 5-shot Veo / Omni Flash video prompt with camera motion, lighting, and sound cues.',
    category: 'AI Video Generation',
    promptText: `Act as an award-winning cinematographer and AI video prompt engineer.
Take the user's [NEW IDEA] and output a production-ready AI video prompt structured into:
1. LOGLINE & VISUAL MOOD (1 sentence)
2. CAMERA & LENS SPECIFICATION (focal length, movement, framing)
3. LIGHTING & COLOR PALETTE (time of day, atmosphere, contrast)
4. CONTINUOUS MOTION SEQUENCE (exact physical movement from 0s to 5s)
5. COPY-READY VEO / OMNI FLASH PROMPT (single dense paragraph ready to paste directly into the video generator).
Do not include conversational filler before or after the structured output.`,
    outputLanguage: 'English',
    outputType: 'Video prompt',
    targetPlatform: 'Gemini Omni 1.1 Flash / Veo',
    desiredLength: 'Medium (200-350 words)',
    characterLimit: 0,
    exactCharCount: false,
    createdAt: '2026-10-24T08:00:00.000Z',
    updatedAt: '2026-10-24T08:00:00.000Z'
  },
  {
    id: 'starter-image-photoreal',
    userId: 'system',
    name: 'Architectural & Product Studio Master Prompt',
    description:
      'Converts any house, product, or scene concept into an 8K editorial photography prompt with material textures and natural lighting.',
    category: 'AI Image Generation',
    promptText: `You are a commercial art director. Convert the user's [NEW IDEA] into an ultra-detailed image generation prompt.
Include:
- Subject geometry and primary materials
- Environment and surface composition
- Natural and studio lighting setup
- Camera angle, lens aperture, and film stock aesthetic
Return ONLY the final image generation prompt text with zero introductory remarks.`,
    outputLanguage: 'English',
    outputType: 'Image prompt',
    targetPlatform: 'Gemini Nano Banana 2.1 / 3 Pro Image',
    desiredLength: 'Concise (60-120 words)',
    characterLimit: 500,
    exactCharCount: false,
    createdAt: '2026-10-24T08:00:00.000Z',
    updatedAt: '2026-10-24T08:00:00.000Z'
  },
  {
    id: 'starter-hausa-story-script',
    userId: 'system',
    name: 'Tsarin Rubuta Labari da Fim na Hausa (Hausa Story & Script)',
    description:
      'Yana juya kowane ra’ayi zuwa labari mai daɗi ko tsarin fim cikin harshen Hausa mai inganci.',
    category: 'Story or Script',
    promptText: `Kai ƙwararren marubucin labarai da fina-finan Hausa ne.
Karɓi sabon ra'ayin mai amfani [NEW IDEA] ka rubuta:
1. JIGO DA TAƘAITACCEN BAYANI (1-2 jimla)
2. JERIN TAURARI DA HALAYENSU (Characters)
3. CIKAKKEN LABARI KO TSARIN FIM (Scene-by-scene script cikin Hausa mai tsabta da ban sha'awa)
4. DARASIN LABARIN.
Rubuta sakamakon kai tsaye ba tare da dogon sharhi na farko ba.`,
    outputLanguage: 'Hausa',
    outputType: 'Story or script',
    targetPlatform: 'YouTube / Kannywood / Hausa Media',
    desiredLength: 'Medium (200-350 words)',
    characterLimit: 0,
    exactCharCount: false,
    createdAt: '2026-10-24T08:00:00.000Z',
    updatedAt: '2026-10-24T08:00:00.000Z'
  },
  {
    id: 'starter-character-design',
    userId: 'system',
    name: 'Consistent 3D & Cinematic Character Design Sheet',
    description:
      'Builds a consistent character design specification for animation, comics, or AI image/video generation.',
    category: 'Character Design',
    promptText: `Act as a Lead Character Concept Artist. For the user's [NEW IDEA], generate a complete Character Design Specification:
1. IDENTITY & ARCHETYPE (name, age range, silhouette, posture)
2. FACIAL FEATURES & EXPRESSION (eyes, hair, distinctive traits)
3. WARDROBE, FABRICS & COLOR PALETTE (3 primary hex/named colors, textures, accessories)
4. CONSISTENT IMAGE GENERATION SEED PROMPT (single paragraph describing front, 3/4, and profile character turnaround sheet on neutral studio background).`,
    outputLanguage: 'English',
    outputType: 'Character design',
    targetPlatform: 'Gemini Image & Video Studio',
    desiredLength: 'Medium (200-350 words)',
    characterLimit: 0,
    exactCharCount: false,
    createdAt: '2026-10-24T08:00:00.000Z',
    updatedAt: '2026-10-24T08:00:00.000Z'
  }
];
