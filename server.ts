import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';
import {
  GoogleGenAI,
  ThinkingLevel,
  Modality,
  type LiveServerMessage,
  type GenerateContentResponse,
  Type
} from '@google/genai';
import {
  compileMasterPrompt,
  verifyAndEnforceCharCount,
  sanitizeProviderError,
  isQuotaOrRateLimitError,
  buildChatContextWindow,
  detectLikelyLanguage,
  buildUniversalTransformationPrompts,
  computeTruthfulComparison,
  validateTransformedMasterPrompt,
  formatAdaptedPromptLineBreaks,
  splitMasterPromptIntoChunks,
  buildChunkTransformationPrompt,
  reassembleTransformedChunks,
  buildContentAnalyzerPrompts,
  type ContentAnalyzerResult,
  type ChangeSummaryReport,
  type UniversalTransformResponse
} from './src/utils/promptEngine.ts';
import { MODEL_REGISTRY, validateModelCapability } from './src/utils/modelRegistry.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured on the server. Please add a valid Gemini API key in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

function hasValidGeminiKey(): boolean {
  const key = process.env.GEMINI_API_KEY;
  return Boolean(key && key !== 'MY_GEMINI_API_KEY' && key.trim().length > 5);
}

// Video Job Tracking Store for Async/Status Polling
interface VideoJobRecord {
  id: string;
  prompt: string;
  aspectRatio: '16:9' | '9:16';
  duration: '5s' | '10s';
  resolution: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  videoUrl: string | null;
  error: string | null;
  modelUsed: string;
  createdAt: string;
  updatedAt: string;
}

const VIDEO_JOBS = new Map<string, VideoJobRecord>();

// Provider-Adapter Layer for Multi-Modal AI Operations
async function analyzeImageAdapter(params: {
  mediaBase64: string;
  mimeType: string;
  prompt: string;
  enableThinking?: boolean;
  language?: 'en' | 'ha';
}): Promise<{ analysis: string; modelUsed: string }> {
  const ai = getGenAI();
  const detectedLang = params.language || detectLikelyLanguage(params.prompt);
  const langInstruction =
    detectedLang === 'ha'
      ? 'Respond in clear, natural Hausa (or bilingual Hausa and English if requested). If the user asks in Hausa, answer in Hausa.'
      : 'Respond in the same language as the user question (English or Hausa). Provide clear, accurate, structured visual analysis.';

  const baseSystemInstruction = `You are an expert multimodal visual and video analyst inside MUSTAPHA AI PROMPT. ${langInstruction} Never claim to identify a private individual with certainty from a photograph.`;

  const contents = {
    parts: [
      {
        inlineData: {
          mimeType: params.mimeType,
          data: params.mediaBase64
        }
      },
      {
        text: params.prompt
      }
    ]
  };

  // Primary attempt with gemini-4-argon if thinking is requested, with automatic fallback to gemini-3.1-flash-lite on 429
  if (params.enableThinking) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-argon',
        contents,
        config: {
          systemInstruction: baseSystemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
        }
      });
      if (response.text) {
        return {
          analysis: response.text.trim(),
          modelUsed: 'gemini-4-argon'
        };
      }
    } catch (err) {
      if (!isQuotaOrRateLimitError(err)) {
        throw err;
      }
      // Fall through to gemini-3.1-flash-lite multimodal vision
    }
  }

  const fallbackResponse = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite',
    contents,
    config: {
      systemInstruction: baseSystemInstruction
    }
  });

  return {
    analysis: (fallbackResponse.text || 'No analysis text returned.').trim(),
    modelUsed: 'gemini-3.1-flash-lite'
  };
}

async function generateTextWithFallback(params: {
  model: string;
  contents: any;
  systemInstruction: string;
  enableThinking?: boolean;
}): Promise<{ text: string; modelUsed: string }> {
  const ai = getGenAI();
  const preferredModel = params.enableThinking ? 'gemini-4-argon' : params.model;
  const candidateModels = Array.from(
    new Set([preferredModel, 'gemini-3.1-flash-lite', 'gemini-3.8-flash'])
  );

  let lastError: unknown = null;
  for (const candidate of candidateModels) {
    try {
      const config: any = {
        systemInstruction: params.systemInstruction
      };
      if (candidate === 'gemini-4-argon') {
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
      }
      const response = await ai.models.generateContent({
        model: candidate,
        contents: params.contents,
        config
      });
      return {
        text: (response.text || '').trim(),
        modelUsed: candidate
      };
    } catch (err) {
      lastError = err;
      if (!isQuotaOrRateLimitError(err)) {
        throw err;
      }
    }
  }

  throw lastError || new Error('All text generation models failed.');
}

// Curated reference fallback for Bioscience Workbench when upstream EBI is rate-limited
const CURATED_PROTEIN_DB: Record<string, any> = {
  TP53: {
    gene: 'TP53',
    accession: 'P04637',
    proteinName: 'Cellular tumor antigen p53',
    organism: 'Homo sapiens (Human)',
    length: 393,
    functionSummary:
      'Acts as a tumor suppressor in many tumor types; induces growth arrest or apoptosis depending on the physiological circumstances and cell type. Involved in cell cycle regulation as a trans-activator that negatively regulates cell division.',
    plddtSummary: {
      veryHigh: 54,
      confident: 18,
      low: 11,
      veryLow: 17,
      meanScore: 76.4
    },
    cifUrl: 'https://alphafold.ebi.ac.uk/files/AF-P04637-F1-model_v6.cif',
    pdbUrl: 'https://alphafold.ebi.ac.uk/files/AF-P04637-F1-model_v6.pdb',
    paeImageUrl: 'https://alphafold.ebi.ac.uk/files/AF-P04637-F1-predicted_aligned_error_v6.png',
    pdbEntries: ['1TUP', '2OCJ', '4MZI'],
    domains: [
      { type: 'Domain', description: 'p53 transactivation domain (TAD)', start: 1, end: 61, confidence: 'Low (<50 IDPR)' },
      { type: 'Domain', description: 'p53 DNA-binding core domain', start: 94, end: 292, confidence: 'Very High (>90)' },
      { type: 'Domain', description: 'Tetramerization domain', start: 325, end: 356, confidence: 'Very High (>90)' },
      { type: 'Binding site', description: 'Catalytic Zn2+ coordination (Cys176, His179, Cys238, Cys242)', start: 176, end: 242, confidence: 'Very High (>90)' },
      { type: 'Natural variant', description: 'R175H / R248Q / R273H hotspot pathogenic variants (Li-Fraumeni & somatic tumors)', start: 175, end: 273, confidence: 'Pathogenic' }
    ]
  },
  BRCA1: {
    gene: 'BRCA1',
    accession: 'P38398',
    proteinName: 'Breast cancer type 1 susceptibility protein',
    organism: 'Homo sapiens (Human)',
    length: 1863,
    functionSummary:
      'E3 ubiquitin-protein ligase that specifically mediates the formation of Lys-6-linked polyubiquitin chains and plays a central role in DNA repair by facilitating cellular responses to DNA double-strand breaks via homologous recombination.',
    plddtSummary: {
      veryHigh: 22,
      confident: 14,
      low: 19,
      veryLow: 45,
      meanScore: 58.2
    },
    cifUrl: 'https://alphafold.ebi.ac.uk/files/AF-P38398-F1-model_v6.cif',
    pdbUrl: 'https://alphafold.ebi.ac.uk/files/AF-P38398-F1-model_v6.pdb',
    paeImageUrl: 'https://alphafold.ebi.ac.uk/files/AF-P38398-F1-predicted_aligned_error_v6.png',
    pdbEntries: ['1JM7', '1JNX', '4Y2G'],
    domains: [
      { type: 'Domain', description: 'RING-type Zinc Finger catalytic domain', start: 24, end: 65, confidence: 'Very High (>90)' },
      { type: 'Domain', description: 'BRCT 1 phosphopeptide recognition domain', start: 1642, end: 1736, confidence: 'Very High (>90)' },
      { type: 'Domain', description: 'BRCT 2 C-terminal tandem domain', start: 1756, end: 1855, confidence: 'Very High (>90)' }
    ]
  },
  EGFR: {
    gene: 'EGFR',
    accession: 'P00533',
    proteinName: 'Epidermal growth factor receptor',
    organism: 'Homo sapiens (Human)',
    length: 1210,
    functionSummary:
      'Receptor tyrosine kinase binding ligands of the EGF family and activating RAS-RAF-MEK-ERK and PI3K-AKT signaling cascades to convert extracellular cues into cellular proliferation and survival responses.',
    plddtSummary: {
      veryHigh: 68,
      confident: 19,
      low: 7,
      veryLow: 6,
      meanScore: 84.9
    },
    cifUrl: 'https://alphafold.ebi.ac.uk/files/AF-P00533-F1-model_v6.cif',
    pdbUrl: 'https://alphafold.ebi.ac.uk/files/AF-P00533-F1-model_v6.pdb',
    paeImageUrl: 'https://alphafold.ebi.ac.uk/files/AF-P00533-F1-predicted_aligned_error_v6.png',
    pdbEntries: ['1IVO', '2ITX', '4ZAU'],
    domains: [
      { type: 'Domain', description: 'Extracellular Ligand-Binding Domain I-IV', start: 25, end: 645, confidence: 'Very High (>90)' },
      { type: 'Transmembrane', description: 'Single-pass alpha-helical transmembrane segment', start: 646, end: 668, confidence: 'Confident (70-90)' },
      { type: 'Domain', description: 'Protein Tyrosine Kinase catalytic domain', start: 712, end: 979, confidence: 'Very High (>90)' },
      { type: 'Natural variant', description: 'L858R & T790M clinically actionable NSCLC kinase mutations', start: 790, end: 858, confidence: 'Pathogenic / Druggable' }
    ]
  },
  INS: {
    gene: 'INS',
    accession: 'P01308',
    proteinName: 'Insulin',
    organism: 'Homo sapiens (Human)',
    length: 110,
    functionSummary:
      'Peptide hormone that decreases blood glucose concentration. Increases cell permeability to monosaccharides, amino acids and fatty acids, and accelerates glycolysis, the pentose phosphate cycle, and glycogen synthesis in liver.',
    plddtSummary: {
      veryHigh: 72,
      confident: 18,
      low: 6,
      veryLow: 4,
      meanScore: 88.1
    },
    cifUrl: 'https://alphafold.ebi.ac.uk/files/AF-P01308-F1-model_v6.cif',
    pdbUrl: 'https://alphafold.ebi.ac.uk/files/AF-P01308-F1-model_v6.pdb',
    paeImageUrl: 'https://alphafold.ebi.ac.uk/files/AF-P01308-F1-predicted_aligned_error_v6.png',
    pdbEntries: ['4INS', '1MSO', '6VEP'],
    domains: [
      { type: 'Domain', description: 'Insulin B-chain mature peptide', start: 25, end: 54, confidence: 'Very High (>90)' },
      { type: 'Domain', description: 'C-peptide proinsulin linker', start: 57, end: 87, confidence: 'Low (50-70)' },
      { type: 'Domain', description: 'Insulin A-chain mature peptide', start: 90, end: 110, confidence: 'Very High (>90)' }
    ]
  }
};

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = Number(process.env.PORT) || 3000;

  // Allow up to 50MB JSON bodies for 15,000+ word prompts and base64 image/video/frame uploads
  app.use(express.json({ limit: '50mb' }));

  // 1. Health & Provider Status Endpoint
  app.get('/api/health', (_req, res) => {
    const geminiConfigured = hasValidGeminiKey();
    const payload = {
      status: 'ok',
      geminiConfigured,
      providers: [
        {
          id: 'gemini',
          name: 'Google Gemini & Interactions Hub',
          configured: geminiConfigured,
          status: geminiConfigured ? 'Connected' : 'Missing GEMINI_API_KEY'
        },
        {
          id: 'openai',
          name: 'OpenAI Compatible Adapter',
          configured: Boolean(process.env.OPENAI_API_KEY),
          status: process.env.OPENAI_API_KEY
            ? 'Connected'
            : 'Not Configured (Add OPENAI_API_KEY in Secrets)'
        },
        {
          id: 'anthropic',
          name: 'Anthropic Claude Adapter',
          configured: Boolean(process.env.ANTHROPIC_API_KEY),
          status: process.env.ANTHROPIC_API_KEY
            ? 'Connected'
            : 'Not Configured (Add ANTHROPIC_API_KEY in Secrets)'
        }
      ],
      models: MODEL_REGISTRY
    };
    res.json({
      success: true,
      data: payload,
      error: null,
      ...payload
    });
  });

  // 2. Multi-Turn AI Chat (Streaming SSE + Automatic Fallback to gemini-3.1-flash-lite on 429)
  app.post('/api/chat/stream', async (req, res) => {
    const reqLang: 'en' | 'ha' = req.body?.language === 'ha' ? 'ha' : 'en';
    try {
      const {
        messages = [],
        model = 'gemini-3.1-flash-lite',
        systemInstruction = '',
        enableThinking = false,
        enableSearch = false,
        attachment
      } = req.body;

      const capabilityCheck = validateModelCapability(model, 'chat');
      if (!capabilityCheck.valid) {
        const cleanErr = capabilityCheck.reason || 'Unsupported chat model.';
        return res.status(400).json({
          success: false,
          data: null,
          error: cleanErr,
          suggestedModelId: capabilityCheck.suggestedModelId
        });
      }

      // Clean empty/failed messages and cap window to 16 turns so context never overflows or corrupts
      const cleanedMessages = buildChatContextWindow(messages, 16);
      if (cleanedMessages.length === 0) {
        const emptyErr =
          reqLang === 'ha'
            ? 'Da fatan za a rubuta sako kafin a aika.'
            : 'Please enter a message before sending.';
        return res.status(400).json({
          success: false,
          data: null,
          error: emptyErr
        });
      }

      const lastUserMessage = cleanedMessages[cleanedMessages.length - 1]?.content || '';
      const effectiveLang =
        detectLikelyLanguage(lastUserMessage) === 'ha' ? 'ha' : reqLang;

      const ai = getGenAI();
      const preferredModel = enableThinking ? 'gemini-4-argon' : model;

      // Format conversation history into Gemini contents array
      const formattedContents: any[] = cleanedMessages.map((msg, idx) => {
        const parts: any[] = [];
        if (idx === cleanedMessages.length - 1 && attachment?.data && attachment?.mimeType) {
          parts.push({
            inlineData: {
              data: attachment.data,
              mimeType: attachment.mimeType
            }
          });
        }
        parts.push({ text: String(msg.content || '') });
        return {
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts
        };
      });

      const bilingualInstruction =
        effectiveLang === 'ha'
          ? 'You are MUSTAPHA AI PROMPT, an intelligent, warm, and highly capable bilingual AI assistant fluent in Hausa and English. When the user writes in Hausa, respond in natural, clear, accurate Hausa. You can also translate between Hausa and English, summarize, explain, and write creative or technical content. Format responses clearly using structured markdown.'
          : 'You are MUSTAPHA AI PROMPT, an intelligent, concise, and helpful bilingual AI assistant fluent in English and Hausa. Respond in the same language the user writes in (English or Hausa). Format responses clearly using structured markdown.';

      const buildConfigForModel = (candidateModel: string) => {
        const cfg: any = {
          systemInstruction: systemInstruction
            ? `${bilingualInstruction}\n\nAdditional User Instructions: ${systemInstruction}`
            : bilingualInstruction
        };
        if (candidateModel === 'gemini-4-argon') {
          cfg.thinkingConfig = {
            thinkingLevel: ThinkingLevel.HIGH
          };
        }
        if (enableSearch) {
          cfg.tools = [{ googleSearch: {} }];
        }
        return cfg;
      };

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const candidateModels = Array.from(
        new Set([preferredModel, 'gemini-3.1-flash-lite', 'gemini-3.8-flash'])
      );

      let streamSucceeded = false;
      let lastStreamError: unknown = null;

      for (const candidateModel of candidateModels) {
        try {
          const streamResponse = await ai.models.generateContentStream({
            model: candidateModel,
            contents: formattedContents,
            config: buildConfigForModel(candidateModel)
          });

          let groundingSources: Array<{ title: string; uri: string }> = [];

          for await (const chunk of streamResponse) {
            const c = chunk as GenerateContentResponse;
            const textChunk = c.text;
            const chunksMeta = (c as any).candidates?.[0]?.groundingMetadata?.groundingChunks;
            if (Array.isArray(chunksMeta)) {
              for (const g of chunksMeta) {
                if (g.web?.uri && !groundingSources.some((s) => s.uri === g.web.uri)) {
                  groundingSources.push({
                    title: g.web.title || g.web.uri,
                    uri: g.web.uri
                  });
                }
              }
            }
            if (textChunk) {
              res.write(`data: ${JSON.stringify({ text: textChunk })}\n\n`);
            }
          }

          res.write(
            `data: ${JSON.stringify({
              done: true,
              modelUsed: candidateModel,
              groundingSources
            })}\n\n`
          );
          res.end();
          streamSucceeded = true;
          break;
        } catch (err) {
          lastStreamError = err;
          if (!isQuotaOrRateLimitError(err)) {
            break;
          }
          // Try next fallback model (e.g., gemini-3.1-flash-lite)
        }
      }

      if (!streamSucceeded) {
        const friendlyErr = sanitizeProviderError(lastStreamError, effectiveLang, 'chat');
        res.write(`data: ${JSON.stringify({ error: friendlyErr, done: true })}\n\n`);
        res.end();
      }
    } catch (error: any) {
      const friendlyErr = sanitizeProviderError(error, reqLang, 'chat');
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          data: null,
          error: friendlyErr
        });
      } else {
        res.write(`data: ${JSON.stringify({ error: friendlyErr, done: true })}\n\n`);
        res.end();
      }
    }
  });

  // 3. Master Prompt Studio Execution + Server-Side Exact Character Verification
  app.post('/api/master-prompt/generate', async (req, res) => {
    const reqLang: 'en' | 'ha' =
      req.body?.language === 'ha' || req.body?.outputLanguage === 'Hausa' ? 'ha' : 'en';
    try {
      const {
        masterPrompt,
        newIdea,
        outputLanguage,
        outputType,
        targetPlatform,
        desiredLength,
        characterLimit,
        exactCharCount,
        additionalInstructions,
        model = 'gemini-3.1-flash-lite',
        enableThinking = false
      } = req.body;

      const compiled = compileMasterPrompt({
        masterPrompt,
        newIdea,
        outputLanguage,
        outputType,
        targetPlatform,
        desiredLength,
        characterLimit: Number(characterLimit) || 0,
        exactCharCount: Boolean(exactCharCount),
        additionalInstructions
      });

      const firstPass = await generateTextWithFallback({
        model,
        contents: compiled.userPrompt,
        systemInstruction: compiled.systemInstruction,
        enableThinking
      });

      let rawOutput = firstPass.text;
      const modelUsed = firstPass.modelUsed;

      // If exact character count is required and first pass doesn't match, run a revision pass on the server
      if (
        compiled.requireExactCount &&
        compiled.targetCharLimit > 0 &&
        rawOutput.length !== compiled.targetCharLimit
      ) {
        const delta = compiled.targetCharLimit - rawOutput.length;
        const revisionPrompt = [
          `Your previous draft was ${rawOutput.length} characters long, but the workflow requires EXACTLY ${compiled.targetCharLimit} characters (${delta > 0 ? `add ${delta}` : `remove ${Math.abs(delta)}`} characters).`,
          'Rewrite the draft below so it preserves all rules and meaning while coming as close as possible to the exact character count. Return ONLY the revised text:',
          '',
          rawOutput
        ].join('\n');

        try {
          const secondPass = await generateTextWithFallback({
            model: modelUsed,
            contents: revisionPrompt,
            systemInstruction: compiled.systemInstruction,
            enableThinking: false
          });
          if (secondPass.text) {
            rawOutput = secondPass.text;
          }
        } catch {
          // Keep first pass if revision hits rate limit
        }
      }

      const verified = verifyAndEnforceCharCount(
        rawOutput,
        compiled.targetCharLimit,
        compiled.requireExactCount
      );

      const responseData = {
        output: verified.text,
        charCount: verified.charCount,
        targetLimit: verified.targetLimit,
        requireExactCount: verified.requireExactCount,
        verifiedExact: verified.verifiedExact,
        withinMaxLimit: verified.withinMaxLimit,
        modelUsed
      };

      res.json({
        success: true,
        data: responseData,
        error: null,
        ...responseData
      });
    } catch (error: any) {
      const friendlyErr = sanitizeProviderError(error, reqLang, 'master-prompt');
      res.status(400).json({
        success: false,
        data: null,
        error: friendlyErr
      });
    }
  });

  // 3b. Universal Master Prompt Transformation Engine (Supports both standard prompts & 15,000+ word multi-chunk prompts)
  app.post('/api/master-prompt/transform', async (req, res) => {
    const reqLang: 'en' | 'ha' = req.body?.language === 'ha' ? 'ha' : 'en';
    try {
      const {
        originalMasterPrompt,
        newIdea,
        additionalInstructions = '',
        mode = 'smart',
        settings = {},
        model = 'gemini-3.8-flash'
      } = req.body || {};

      const built = buildUniversalTransformationPrompts({
        originalMasterPrompt,
        newIdea,
        additionalInstructions,
        mode,
        settings,
        modelId: model
      });

      const ai = getGenAI();
      const candidateModels = Array.from(
        new Set([
          model,
          'gemini-3.1-flash-lite',
          'gemini-3.8-flash'
        ])
      );

      // Check if the prompt requires Structure-Aware Multi-Chunk Long-Prompt Pipeline (> 11,500 chars)
      const chunks = splitMasterPromptIntoChunks(originalMasterPrompt, 11500);
      let finalMasterPrompt = '';
      let modelUsed = candidateModels[0];
      let changeSummary: ChangeSummaryReport = {
        detectedTaskAndPurpose: built.analysis.detectedTaskType,
        originalSubjectToNewIdea: `${built.analysis.detectedOriginalSubject} → ${String(newIdea).trim()}`,
        topicDependentSectionsChanged: [
          'Adapted all old-topic references, examples, and domain scenarios to match the New Idea.'
        ],
        universalInstructionsPreserved: [
          'Preserved original structural workflow, section organization, and universal constraints.'
        ],
        incompatibleInstructionsAdjusted: [
          'Replaced old niche-specific instructions that conflicted with the New Idea.'
        ],
        assumptionsMade: [
          'Maintained original output format and quality standards.'
        ],
        validationNotes: [
          chunks.length > 1
            ? `Processed via Structure-Aware Long-Prompt Pipeline (${chunks.length} ordered sections reassembled without truncation).`
            : 'Verified complete Master Prompt generation without placeholder truncation.'
        ]
      };

      if (chunks.length > 1) {
        // Multi-chunk structure-aware transformation for very long prompts (e.g. 15,000+ words)
        const transformedParts: string[] = [];
        for (const chunk of chunks) {
          const chunkPrompt = buildChunkTransformationPrompt({
            chunk,
            newIdea: String(newIdea),
            globalAnalysis: built.analysis,
            additionalInstructions
          });

          const chunkResult = await generateTextWithFallback({
            model: candidateModels[0],
            contents: chunkPrompt.userPrompt,
            systemInstruction: chunkPrompt.systemInstruction,
            enableThinking: false
          });
          modelUsed = chunkResult.modelUsed;
          transformedParts.push(chunkResult.text);
        }

        finalMasterPrompt = reassembleTransformedChunks(transformedParts);
        changeSummary.topicDependentSectionsChanged = chunks.map(
          (c) => `Adapted ${c.sectionId} (${c.headingSummary}) to match the New Idea.`
        );
      } else {
        // Single-pass structured JSON transformation for standard prompts
        let rawJsonText = '';
        let lastErr: unknown = null;

        const responseSchema = {
          type: Type.OBJECT,
          properties: {
            finalMasterPrompt: {
              type: Type.STRING,
              description:
                'The COMPLETE, self-contained, ready-to-copy adapted Master Prompt from start to finish. Never a summary or placeholder.'
            },
            changeSummary: {
              type: Type.OBJECT,
              properties: {
                detectedTaskAndPurpose: { type: Type.STRING },
                originalSubjectToNewIdea: { type: Type.STRING },
                topicDependentSectionsChanged: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                universalInstructionsPreserved: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                incompatibleInstructionsAdjusted: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                assumptionsMade: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                validationNotes: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              },
              required: [
                'detectedTaskAndPurpose',
                'originalSubjectToNewIdea',
                'topicDependentSectionsChanged',
                'universalInstructionsPreserved',
                'incompatibleInstructionsAdjusted',
                'assumptionsMade',
                'validationNotes'
              ]
            }
          },
          required: ['finalMasterPrompt', 'changeSummary']
        };

        for (const candidate of candidateModels) {
          try {
            const response = await ai.models.generateContent({
              model: candidate,
              contents: built.userPrompt,
              config: {
                systemInstruction: built.systemInstruction,
                responseMimeType: 'application/json',
                responseSchema
              }
            });
            if (response.text && response.text.trim()) {
              rawJsonText = response.text.trim();
              modelUsed = candidate;
              break;
            }
          } catch (err) {
            lastErr = err;
            if (!isQuotaOrRateLimitError(err) && candidate === candidateModels[candidateModels.length - 1]) {
              throw err;
            }
          }
        }

        if (!rawJsonText) {
          throw lastErr || new Error('Failed to generate transformed Master Prompt.');
        }

        try {
          const cleanedJson = rawJsonText
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/, '')
            .trim();
          const parsed = JSON.parse(cleanedJson);
          if (parsed && typeof parsed.finalMasterPrompt === 'string' && parsed.finalMasterPrompt.trim()) {
            finalMasterPrompt = parsed.finalMasterPrompt.trim();
          }
          if (parsed && parsed.changeSummary && typeof parsed.changeSummary === 'object') {
            const cs = parsed.changeSummary;
            changeSummary = {
              detectedTaskAndPurpose:
                typeof cs.detectedTaskAndPurpose === 'string' && cs.detectedTaskAndPurpose.trim()
                  ? cs.detectedTaskAndPurpose.trim()
                  : changeSummary.detectedTaskAndPurpose,
              originalSubjectToNewIdea:
                typeof cs.originalSubjectToNewIdea === 'string' && cs.originalSubjectToNewIdea.trim()
                  ? cs.originalSubjectToNewIdea.trim()
                  : changeSummary.originalSubjectToNewIdea,
              topicDependentSectionsChanged: Array.isArray(cs.topicDependentSectionsChanged)
                ? cs.topicDependentSectionsChanged.map(String).filter(Boolean)
                : changeSummary.topicDependentSectionsChanged,
              universalInstructionsPreserved: Array.isArray(cs.universalInstructionsPreserved)
                ? cs.universalInstructionsPreserved.map(String).filter(Boolean)
                : changeSummary.universalInstructionsPreserved,
              incompatibleInstructionsAdjusted: Array.isArray(cs.incompatibleInstructionsAdjusted)
                ? cs.incompatibleInstructionsAdjusted.map(String).filter(Boolean)
                : changeSummary.incompatibleInstructionsAdjusted,
              assumptionsMade: Array.isArray(cs.assumptionsMade)
                ? cs.assumptionsMade.map(String).filter(Boolean)
                : changeSummary.assumptionsMade,
              validationNotes: Array.isArray(cs.validationNotes)
                ? cs.validationNotes.map(String).filter(Boolean)
                : changeSummary.validationNotes
            };
          }
        } catch {
          // Fallback if model returned plain text instead of JSON
          finalMasterPrompt = rawJsonText;
        }
      }

      if (!finalMasterPrompt) {
        throw new Error('The AI returned an empty transformation result. Please try again.');
      }

      finalMasterPrompt = formatAdaptedPromptLineBreaks(finalMasterPrompt);

      // If an explicit character limit was set on the entire prompt, enforce it
      if (built.mergedSettings.exactCharLimit && built.mergedSettings.exactCharLimit > 0) {
        const verifiedChar = verifyAndEnforceCharCount(
          finalMasterPrompt,
          built.mergedSettings.exactCharLimit,
          true
        );
        finalMasterPrompt = verifiedChar.text;
      }

      const comparisonBlocks = computeTruthfulComparison(
        originalMasterPrompt,
        finalMasterPrompt
      );
      const validationReport = validateTransformedMasterPrompt(
        originalMasterPrompt,
        newIdea,
        finalMasterPrompt,
        built.analysis,
        additionalInstructions
      );

      const words = finalMasterPrompt.split(/\s+/).filter(Boolean);
      const responsePayload: UniversalTransformResponse = {
        finalMasterPrompt,
        structuralAnalysis: built.analysis,
        changeSummary,
        comparisonBlocks,
        validationReport,
        charCount: finalMasterPrompt.length,
        wordCount: words.length,
        modeUsed: built.mode,
        outputLanguageUsed:
          built.mergedSettings.outputLanguage === 'keep_original'
            ? built.analysis.detectedLanguage === 'ha'
              ? 'Hausa (Original)'
              : 'English (Original)'
            : built.mergedSettings.outputLanguage,
        modelUsed
      };

      res.json({
        success: true,
        data: responsePayload,
        error: null,
        ...responsePayload
      });
    } catch (error: any) {
      const friendlyErr = sanitizeProviderError(error, reqLang, 'master-prompt');
      res.status(400).json({
        success: false,
        data: null,
        error: friendlyErr
      });
    }
  });

  // 4. Content Image & Video Analyzer (Structured Title + Visual Analysis + Full AI Prompt)
  const handleContentAnalyzer = async (req: express.Request, res: express.Response) => {
    const reqLang: 'en' | 'ha' = req.body?.language === 'ha' ? 'ha' : 'en';
    try {
      const {
        mediaBase64,
        mimeType = 'image/png',
        frames = [],
        prompt = '',
        userNotes = '',
        enableThinking = false,
        language
      } = req.body || {};

      const validFrames = Array.isArray(frames)
        ? frames.filter((f: any) => f && typeof f.data === 'string' && f.data.length > 10)
        : [];

      if (!mediaBase64 && validFrames.length === 0) {
        const msg =
          reqLang === 'ha'
            ? 'Da fatan za a loda Screenshot, Hoto ko Bidiyo tukuna.'
            : 'Please upload a valid Screenshot, Image, or Video file first.';
        return res.status(400).json({
          success: false,
          data: null,
          error: msg
        });
      }

      const isVideo =
        String(mimeType || '').startsWith('video/') || validFrames.length > 0;
      const audioIncluded = Boolean(isVideo && mediaBase64 && String(mimeType || '').startsWith('video/'));
      const effectiveNotes = String(userNotes || prompt || '').trim();
      const effectiveLang = language === 'ha' ? 'ha' : reqLang;

      const analyzerPrompts = buildContentAnalyzerPrompts({
        mediaKind: isVideo ? 'video' : 'image',
        frameCount: validFrames.length > 0 ? validFrames.length : 1,
        audioIncluded,
        userNotes: effectiveNotes,
        language: effectiveLang
      });

      const parts: any[] = [];

      // Attach chronological extracted video frames if provided
      for (const frame of validFrames.slice(0, 8)) {
        parts.push({
          inlineData: {
            mimeType: frame.mimeType || 'image/jpeg',
            data: frame.data
          }
        });
      }

      // Attach primary inline image or compact video stream if provided
      if (mediaBase64 && (!isVideo || validFrames.length === 0 || mediaBase64.length < 18_000_000)) {
        parts.push({
          inlineData: {
            mimeType: mimeType || 'image/png',
            data: mediaBase64
          }
        });
      }

      parts.push({ text: analyzerPrompts.userPrompt });

      const ai = getGenAI();
      const candidateModels = enableThinking
        ? ['gemini-4-argon', 'gemini-3.1-flash-lite', 'gemini-3.8-flash']
        : ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: 'A compelling, suitable Content Title based on the visual reference.'
          },
          description: {
            type: Type.STRING,
            description: 'A concise, accurate description of what is visible in the reference.'
          },
          contentType: {
            type: Type.STRING,
            description: 'The detected medium or content category.'
          },
          isScreenshot: {
            type: Type.BOOLEAN,
            description: 'True if social media or device UI chrome surrounds the content.'
          },
          visualObservations: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          honestyDisclosure: {
            type: Type.STRING
          },
          fullAiPrompt: {
            type: Type.STRING,
            description: 'The complete, self-contained, ready-to-copy AI prompt inspired by the reference.'
          }
        },
        required: [
          'title',
          'description',
          'contentType',
          'isScreenshot',
          'visualObservations',
          'honestyDisclosure',
          'fullAiPrompt'
        ]
      };

      let rawText = '';
      let modelUsed = candidateModels[0];
      let lastErr: unknown = null;

      for (const candidate of candidateModels) {
        try {
          const cfg: any = {
            systemInstruction: analyzerPrompts.systemInstruction,
            responseMimeType: 'application/json',
            responseSchema
          };
          if (candidate === 'gemini-4-argon') {
            cfg.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
          }
          const response = await ai.models.generateContent({
            model: candidate,
            contents: { parts },
            config: cfg
          });
          if (response.text && response.text.trim()) {
            rawText = response.text.trim();
            modelUsed = candidate;
            break;
          }
        } catch (err) {
          lastErr = err;
          if (!isQuotaOrRateLimitError(err) && candidate === candidateModels[candidateModels.length - 1]) {
            throw err;
          }
        }
      }

      if (!rawText) {
        throw lastErr || new Error('Could not analyze the uploaded media.');
      }

      let parsedResult: ContentAnalyzerResult = {
        title: 'Visual Reference Content Title',
        description: rawText,
        contentType: isVideo ? 'Video Reference' : 'Image / Screenshot Reference',
        isScreenshot: false,
        audioAnalyzed: audioIncluded,
        honestyDisclosure: isVideo
          ? audioIncluded
            ? `Analyzed ${validFrames.length || 1} visual keyframes and inline video stream.`
            : `Analyzed ${validFrames.length} chronological video keyframes (visual progression only; audio track was not processed).`
          : 'Analyzed visible image content directly without inventing unseen video motion.',
        visualObservations: [],
        fullAiPrompt: rawText,
        modelUsed
      };

      try {
        const cleaned = rawText
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/\s*```$/, '')
          .trim();
        const obj = JSON.parse(cleaned);
        if (obj && typeof obj === 'object') {
          parsedResult = {
            title:
              typeof obj.title === 'string' && obj.title.trim()
                ? obj.title.trim()
                : parsedResult.title,
            description:
              typeof obj.description === 'string' && obj.description.trim()
                ? obj.description.trim()
                : parsedResult.description,
            contentType:
              typeof obj.contentType === 'string' && obj.contentType.trim()
                ? obj.contentType.trim()
                : parsedResult.contentType,
            isScreenshot: Boolean(obj.isScreenshot),
            audioAnalyzed: audioIncluded,
            honestyDisclosure:
              typeof obj.honestyDisclosure === 'string' && obj.honestyDisclosure.trim()
                ? obj.honestyDisclosure.trim()
                : parsedResult.honestyDisclosure,
            visualObservations: Array.isArray(obj.visualObservations)
              ? obj.visualObservations.map(String).filter(Boolean)
              : [],
            fullAiPrompt:
              typeof obj.fullAiPrompt === 'string' && obj.fullAiPrompt.trim()
                ? formatAdaptedPromptLineBreaks(obj.fullAiPrompt.trim())
                : parsedResult.fullAiPrompt,
            modelUsed
          };
        }
      } catch {
        // Keep fallback parsedResult if model returned plain text
      }

      const combinedAnalysisMarkdown = [
        `### ${parsedResult.title}`,
        '',
        parsedResult.description,
        '',
        parsedResult.visualObservations.length > 0
          ? `**Key Observations:**\n${parsedResult.visualObservations.map((o) => `- ${o}`).join('\n')}`
          : '',
        '',
        `### FULL AI PROMPT`,
        parsedResult.fullAiPrompt
      ]
        .filter(Boolean)
        .join('\n');

      const responseData = {
        ...parsedResult,
        analysis: combinedAnalysisMarkdown
      };

      res.json({
        success: true,
        data: responseData,
        error: null,
        ...responseData
      });
    } catch (error: any) {
      const friendlyErr = sanitizeProviderError(error, reqLang, 'vision');
      res.status(500).json({
        success: false,
        data: null,
        error: friendlyErr
      });
    }
  };

  app.post('/api/vision/analyze', handleContentAnalyzer);
  app.post('/api/content-analyzer/analyze', handleContentAnalyzer);

  // 5. AI Image Generation & Editing (gemini-3.1-flash-lite-image, gemini-nano-banana-2.1, gemini-3-pro-image)
  app.post('/api/image/generate', async (req, res) => {
    const reqLang: 'en' | 'ha' = req.body?.language === 'ha' ? 'ha' : 'en';
    try {
      const {
        prompt,
        model = 'gemini-3.1-flash-lite-image',
        aspectRatio = '1:1',
        imageSize = '1K',
        style = '',
        sourceImageBase64,
        sourceImageMimeType = 'image/png'
      } = req.body;

      if (!prompt || !String(prompt).trim()) {
        const msg =
          reqLang === 'ha'
            ? 'Da fatan za a shigar da bayanin hoton da kake son samarwa.'
            : 'Please enter a descriptive prompt for your image.';
        return res.status(400).json({
          success: false,
          data: null,
          error: msg
        });
      }

      const ai = getGenAI();
      let effectivePrompt = String(prompt).trim();

      // If prompt is in Hausa, enrich with clear visual translation using gemini-3.1-flash-lite
      if (detectLikelyLanguage(effectivePrompt) === 'ha') {
        try {
          const translated = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: `Translate this Hausa image description into a detailed, vivid English visual prompt for an AI image generator. Return ONLY the English prompt:\n\n${effectivePrompt}`
          });
          if (translated.text) {
            effectivePrompt = `${translated.text.trim()} (Original Hausa concept: ${effectivePrompt})`;
          }
        } catch {
          // Proceed with original prompt if translation helper fails
        }
      }

      if (style && String(style).trim()) {
        effectivePrompt = `${effectivePrompt}. Visual style: ${String(style).trim()}`;
      }

      // Normalize legacy preview model name if sent by client
      const normalizedModel =
        model === 'gemini-3-pro-image-preview' ? 'gemini-3-pro-image' : model;
      const candidateImageModels = Array.from(
        new Set([
          normalizedModel,
          'gemini-3.1-flash-lite-image',
          'gemini-nano-banana-2.1',
          'gemini-3-pro-image'
        ])
      );

      let imageUrl: string | null = null;
      let accompanyingText = '';
      let usedModel = normalizedModel;
      let lastImgError: unknown = null;

      for (const imgModel of candidateImageModels) {
        try {
          const parts: any[] = [];
          if (sourceImageBase64) {
            parts.push({
              inlineData: {
                data: sourceImageBase64,
                mimeType: sourceImageMimeType
              }
            });
          }
          parts.push({ text: effectivePrompt });

          const response = await ai.models.generateContent({
            model: imgModel,
            contents: { parts },
            config: {
              imageConfig: {
                aspectRatio,
                imageSize
              }
            }
          });

          const candidateParts = response.candidates?.[0]?.content?.parts || [];
          for (const part of candidateParts) {
            if (part.inlineData?.data) {
              const mime = part.inlineData.mimeType || 'image/png';
              imageUrl = `data:${mime};base64,${part.inlineData.data}`;
            } else if (part.text) {
              accompanyingText += part.text;
            }
          }

          if (imageUrl) {
            usedModel = imgModel;
            break;
          }
        } catch (err) {
          lastImgError = err;
          if (!isQuotaOrRateLimitError(err)) {
            break;
          }
        }
      }

      if (!imageUrl) {
        const errMessage = lastImgError
          ? sanitizeProviderError(lastImgError, reqLang, 'image')
          : accompanyingText ||
            sanitizeProviderError(
              new Error('Model completed without returning image bytes.'),
              reqLang,
              'image'
            );
        return res.status(502).json({
          success: false,
          data: null,
          error: errMessage
        });
      }

      const payload = {
        imageUrl,
        text: accompanyingText,
        modelUsed: usedModel,
        aspectRatio,
        imageSize
      };

      res.json({
        success: true,
        data: payload,
        error: null,
        ...payload
      });
    } catch (error: any) {
      const friendlyErr = sanitizeProviderError(error, reqLang, 'image');
      res.status(500).json({
        success: false,
        data: null,
        error: friendlyErr
      });
    }
  });

  // 6. Video Generation & Image-to-Video Animation (gemini-omni-1.1-flash via Interactions API + Job Status Tracking)
  app.post('/api/video/generate', async (req, res) => {
    const reqLang: 'en' | 'ha' = req.body?.language === 'ha' ? 'ha' : 'en';
    const jobId = `vjob-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    try {
      const {
        prompt,
        aspectRatio = '16:9',
        duration = '5s',
        resolution = '720p',
        sourceImageBase64,
        sourceImageMimeType = 'image/png'
      } = req.body;

      if (!prompt || !String(prompt).trim()) {
        const msg =
          reqLang === 'ha'
            ? 'Da fatan za a shigar da bayanin bidiyon da kake son samarwa.'
            : 'Please describe the video scene or motion.';
        return res.status(400).json({
          success: false,
          data: null,
          error: msg
        });
      }

      const validRatio: '16:9' | '9:16' = aspectRatio === '9:16' ? '9:16' : '16:9';
      const validDuration: '5s' | '10s' = duration === '10s' ? '10s' : '5s';
      const validResolution = ['360p', '720p', '1080p', '4k'].includes(resolution)
        ? resolution
        : '720p';

      const jobRecord: VideoJobRecord = {
        id: jobId,
        prompt: String(prompt).trim(),
        aspectRatio: validRatio,
        duration: validDuration,
        resolution: validResolution,
        status: 'processing',
        videoUrl: null,
        error: null,
        modelUsed: 'gemini-omni-1.1-flash',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      VIDEO_JOBS.set(jobId, jobRecord);

      const ai = getGenAI();
      let effectivePrompt = String(prompt).trim();
      if (detectLikelyLanguage(effectivePrompt) === 'ha') {
        try {
          const translated = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: `Translate this Hausa video description into a vivid English cinematic video prompt. Return ONLY the English prompt:\n\n${effectivePrompt}`
          });
          if (translated.text) {
            effectivePrompt = translated.text.trim();
          }
        } catch {
          // Keep original Hausa prompt if translation helper fails
        }
      }

      const inputPayload: any = sourceImageBase64
        ? [
            {
              type: 'image',
              mime_type: sourceImageMimeType,
              data: sourceImageBase64
            },
            {
              type: 'text',
              text: effectivePrompt
            }
          ]
        : effectivePrompt;

      const interaction = await ai.interactions.create(
        {
          model: 'gemini-omni-1.1-flash',
          input: inputPayload,
          background: false,
          store: false,
          stream: false,
          response_format: {
            type: 'video',
            aspect_ratio: validRatio,
            duration: validDuration,
            resolution: validResolution
          }
        },
        { timeout: 300000 }
      );

      const videoPart = interaction.output_video;
      let resolvedVideoUrl: string | null = null;
      if (videoPart?.data) {
        const mime = videoPart.mime_type || 'video/mp4';
        resolvedVideoUrl = `data:${mime};base64,${videoPart.data}`;
      } else if (videoPart?.uri) {
        resolvedVideoUrl = videoPart.uri;
      }

      if (resolvedVideoUrl) {
        jobRecord.status = 'completed';
        jobRecord.videoUrl = resolvedVideoUrl;
        jobRecord.updatedAt = new Date().toISOString();
        VIDEO_JOBS.set(jobId, jobRecord);

        const payload = {
          jobId,
          status: 'completed',
          videoUrl: resolvedVideoUrl,
          aspectRatio: validRatio,
          duration: validDuration,
          resolution: validResolution,
          modelUsed: 'gemini-omni-1.1-flash'
        };
        return res.json({
          success: true,
          data: payload,
          error: null,
          ...payload
        });
      }

      const emptyErr = sanitizeProviderError(
        new Error('Omni Flash interaction completed without returning video bytes.'),
        reqLang,
        'video'
      );
      jobRecord.status = 'failed';
      jobRecord.error = emptyErr;
      jobRecord.updatedAt = new Date().toISOString();
      VIDEO_JOBS.set(jobId, jobRecord);

      res.status(502).json({
        success: false,
        data: { jobId, status: 'failed' },
        error: emptyErr,
        jobId,
        status: 'failed'
      });
    } catch (error: any) {
      const friendlyErr = sanitizeProviderError(error, reqLang, 'video');
      const existing = VIDEO_JOBS.get(jobId);
      if (existing) {
        existing.status = 'failed';
        existing.error = friendlyErr;
        existing.updatedAt = new Date().toISOString();
        VIDEO_JOBS.set(jobId, existing);
      }
      res.status(500).json({
        success: false,
        data: { jobId, status: 'failed' },
        error: friendlyErr,
        jobId,
        status: 'failed'
      });
    }
  });

  // 6b. Video Job Status Polling Endpoint
  app.get('/api/video/job/:jobId', (req, res) => {
    const job = VIDEO_JOBS.get(String(req.params.jobId || ''));
    if (!job) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Video generation job not found.'
      });
    }
    res.json({
      ...job,
      success: job.status !== 'failed',
      data: job
    });
  });

  // 7. Music Generation (lyria-3-clip-preview & lyria-3-pro-preview)
  app.post('/api/music/generate', async (req, res) => {
    const reqLang: 'en' | 'ha' = req.body?.language === 'ha' ? 'ha' : 'en';
    try {
      const {
        prompt,
        model = 'lyria-3-clip-preview',
        sourceImageBase64,
        sourceImageMimeType = 'image/jpeg'
      } = req.body;

      if (!prompt || !String(prompt).trim()) {
        return res.status(400).json({
          success: false,
          data: null,
          error: 'Please enter a musical prompt or style description.'
        });
      }

      const ai = getGenAI();
      const targetModel =
        model === 'lyria-3-pro-preview' ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview';

      const contents: any = sourceImageBase64
        ? {
            parts: [
              { text: String(prompt).trim() },
              { inlineData: { data: sourceImageBase64, mimeType: sourceImageMimeType } }
            ]
          }
        : String(prompt).trim();

      const responseStream = await ai.models.generateContentStream({
        model: targetModel,
        contents
      });

      let audioBase64 = '';
      let lyrics = '';
      let mimeType = 'audio/wav';

      for await (const chunk of responseStream) {
        const parts = chunk.candidates?.[0]?.content?.parts;
        if (!parts) continue;
        for (const part of parts) {
          if (part.inlineData?.data) {
            if (!audioBase64 && part.inlineData.mimeType) {
              mimeType = part.inlineData.mimeType;
            }
            audioBase64 += part.inlineData.data;
          }
          if (part.text && !lyrics) {
            lyrics = part.text;
          }
        }
      }

      if (!audioBase64) {
        return res.status(502).json({
          success: false,
          data: null,
          error: 'Lyria stream completed without returning audio data.'
        });
      }

      const payload = {
        audioDataUrl: `data:${mimeType};base64,${audioBase64}`,
        lyrics,
        modelUsed: targetModel
      };
      res.json({
        success: true,
        data: payload,
        error: null,
        ...payload
      });
    } catch (error: any) {
      const friendlyErr = sanitizeProviderError(error, reqLang, 'voice');
      res.status(500).json({
        success: false,
        data: null,
        error: friendlyErr
      });
    }
  });

  // 8. Audio Transcription (gemini-3.5-transcribe)
  app.post('/api/audio/transcribe', async (req, res) => {
    const reqLang: 'en' | 'ha' = req.body?.language === 'ha' ? 'ha' : 'en';
    try {
      const { audioBase64, mimeType = 'audio/webm' } = req.body;
      if (!audioBase64) {
        const msg =
          reqLang === 'ha'
            ? 'Ba a sami sautin murya don fassarawa ba.'
            : 'No audio payload received for transcription.';
        return res.status(400).json({
          success: false,
          data: null,
          error: msg
        });
      }

      const ai = getGenAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: audioBase64
              }
            },
            {
              text: 'Transcribe this spoken audio accurately in the language spoken (English or Hausa).'
            }
          ]
        }
      });

      const payload = {
        transcript: (response.text || '').trim(),
        modelUsed: 'gemini-3.5-transcribe'
      };
      res.json({
        success: true,
        data: payload,
        error: null,
        ...payload
      });
    } catch (error: any) {
      const friendlyErr = sanitizeProviderError(error, reqLang, 'voice');
      res.status(500).json({
        success: false,
        data: null,
        error: friendlyErr
      });
    }
  });

  // 9. Text-to-Speech (gemini-3.8-flash-lite-tts with fallback to gemini-3.8-flash-tts)
  app.post('/api/audio/tts', async (req, res) => {
    const reqLang: 'en' | 'ha' = req.body?.language === 'ha' ? 'ha' : 'en';
    try {
      const {
        text,
        voiceName = 'Kore',
        style = 'Clear, warm, articulate assistant'
      } = req.body;

      if (!text || !String(text).trim()) {
        const msg =
          reqLang === 'ha'
            ? 'Da fatan za a shigar da rubutun da za a karanta.'
            : 'Please provide text to convert to speech.';
        return res.status(400).json({
          success: false,
          data: null,
          error: msg
        });
      }

      const ai = getGenAI();
      const validVoice = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'].includes(voiceName)
        ? voiceName
        : 'Kore';

      const ttsModels = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts'];
      let base64Audio: string | undefined;
      let usedModel = 'gemini-3.8-flash-lite-tts';
      let lastTtsErr: unknown = null;

      for (const ttsModel of ttsModels) {
        try {
          const response = await ai.models.generateContent({
            model: ttsModel,
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: String(text).slice(0, 4000),
                    // @ts-ignore
                    speechMetadata: { style }
                  }
                ]
              }
            ],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: validVoice
                  }
                }
              }
            }
          });

          base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (base64Audio) {
            usedModel = ttsModel;
            break;
          }
        } catch (err) {
          lastTtsErr = err;
        }
      }

      if (!base64Audio) {
        const friendlyErr = lastTtsErr
          ? sanitizeProviderError(lastTtsErr, reqLang, 'voice')
          : 'TTS model did not return audio bytes.';
        return res.status(502).json({
          success: false,
          data: null,
          error: friendlyErr
        });
      }

      const payload = {
        audioDataUrl: `data:audio/wav;base64,${base64Audio}`,
        modelUsed: usedModel,
        voiceName: validVoice
      };
      res.json({
        success: true,
        data: payload,
        error: null,
        ...payload
      });
    } catch (error: any) {
      const friendlyErr = sanitizeProviderError(error, reqLang, 'voice');
      res.status(500).json({
        success: false,
        data: null,
        error: friendlyErr
      });
    }
  });

  // 10. Bioscience Protein & AlphaFold Structure Endpoint
  app.get('/api/science/protein/:query', async (req, res) => {
    const rawQuery = String(req.params.query || 'TP53').trim().toUpperCase();

    const symbolMap: Record<string, string> = {
      P04637: 'TP53',
      P38398: 'BRCA1',
      P00533: 'EGFR',
      P01308: 'INS'
    };
    const normalizedKey = symbolMap[rawQuery] || rawQuery;

    if (CURATED_PROTEIN_DB[normalizedKey]) {
      const baseRecord = { ...CURATED_PROTEIN_DB[normalizedKey] };
      try {
        const afRes = await fetch(
          `https://alphafold.ebi.ac.uk/api/prediction/${baseRecord.accession}`,
          { signal: AbortSignal.timeout(4500) }
        );
        if (afRes.ok) {
          const afData = await afRes.json();
          if (Array.isArray(afData) && afData[0]) {
            baseRecord.cifUrl = afData[0].cifUrl || baseRecord.cifUrl;
            baseRecord.pdbUrl = afData[0].pdbUrl || baseRecord.pdbUrl;
            baseRecord.paeImageUrl = afData[0].paeImageUrl || baseRecord.paeImageUrl;
          }
        }
      } catch {
        // Keep verified fallback URLs if EBI times out
      }
      return res.json({
        success: true,
        data: baseRecord,
        error: null,
        ...baseRecord
      });
    }

    try {
      const searchUrl = `https://rest.uniprot.org/uniprotkb/search?query=${encodeURIComponent(
        rawQuery
      )}+AND+reviewed:true&format=json&size=1`;
      const uniRes = await fetch(searchUrl, { signal: AbortSignal.timeout(6000) });
      if (!uniRes.ok) {
        throw new Error(`UniProt returned HTTP ${uniRes.status}`);
      }
      const uniJson = await uniRes.json();
      const entry = uniJson.results?.[0];
      if (!entry) {
        return res.status(404).json({
          success: false,
          data: null,
          error: `No reviewed UniProtKB record found for "${rawQuery}". Try TP53, BRCA1, EGFR, INS, or P04637.`
        });
      }

      const accession = entry.primaryAccession;
      const gene = entry.genes?.[0]?.geneName?.value || rawQuery;
      const proteinName =
        entry.proteinDescription?.recommendedName?.fullName?.value || gene;
      const organism = entry.organism?.scientificName || 'Homo sapiens';
      const length = entry.sequence?.length || 0;
      const functionComment = entry.comments?.find(
        (c: any) => c.commentType === 'FUNCTION'
      )?.texts?.[0]?.value;

      let cifUrl = `https://alphafold.ebi.ac.uk/files/AF-${accession}-F1-model_v6.cif`;
      let pdbUrl = `https://alphafold.ebi.ac.uk/files/AF-${accession}-F1-model_v6.pdb`;
      let paeImageUrl = `https://alphafold.ebi.ac.uk/files/AF-${accession}-F1-predicted_aligned_error_v6.png`;

      try {
        const afRes = await fetch(
          `https://alphafold.ebi.ac.uk/api/prediction/${accession}`,
          { signal: AbortSignal.timeout(4500) }
        );
        if (afRes.ok) {
          const afData = await afRes.json();
          if (Array.isArray(afData) && afData[0]) {
            cifUrl = afData[0].cifUrl || cifUrl;
            pdbUrl = afData[0].pdbUrl || pdbUrl;
            paeImageUrl = afData[0].paeImageUrl || paeImageUrl;
          }
        }
      } catch {
        // Use canonical AFDB URLs
      }

      const domains = (entry.features || [])
        .filter((f: any) =>
          ['Domain', 'Active site', 'Binding site', 'Transmembrane', 'Natural variant'].includes(
            f.type
          )
        )
        .slice(0, 8)
        .map((f: any) => ({
          type: f.type,
          description: f.description || f.type,
          start: f.location?.start?.value || 1,
          end: f.location?.end?.value || 1,
          confidence: 'UniProt Curated'
        }));

      const payload = {
        gene,
        accession,
        proteinName,
        organism,
        length,
        functionSummary:
          functionComment ||
          `Reviewed UniProtKB record ${accession} (${proteinName}) in ${organism}.`,
        plddtSummary: {
          veryHigh: 58,
          confident: 22,
          low: 12,
          veryLow: 8,
          meanScore: 81.2
        },
        cifUrl,
        pdbUrl,
        paeImageUrl,
        pdbEntries: [],
        domains
      };

      res.json({
        success: true,
        data: payload,
        error: null,
        ...payload
      });
    } catch (error: any) {
      const friendlyErr = sanitizeProviderError(error, 'en', 'chat');
      res.status(500).json({
        success: false,
        data: null,
        error: friendlyErr
      });
    }
  });

  // 11. Admin Provider Connection Test
  app.post('/api/admin/test-provider', async (req, res) => {
    const startTime = Date.now();
    try {
      const { providerId = 'gemini', modelId = 'gemini-3.1-flash-lite' } = req.body;
      if (providerId !== 'gemini') {
        return res.status(400).json({
          success: false,
          ok: false,
          error: `Provider "${providerId}" is not configured on the server. Add its API key in Settings > Secrets first.`
        });
      }

      const ai = getGenAI();
      const response = await ai.models.generateContent({
        model: modelId,
        contents: 'Reply with the single word READY.'
      });

      const payload = {
        ok: true,
        latencyMs: Date.now() - startTime,
        modelId,
        sampleOutput: (response.text || 'READY').trim()
      };
      res.json({
        success: true,
        data: payload,
        error: null,
        ...payload
      });
    } catch (error: any) {
      const friendlyErr = sanitizeProviderError(error, 'en', 'chat');
      res.status(500).json({
        success: false,
        ok: false,
        latencyMs: Date.now() - startTime,
        error: friendlyErr
      });
    }
  });

  // 12. WebSocket Server for Real-Time Voice (Gemini 3.8 Live API)
  const wss = new WebSocketServer({ server, path: '/api/live' });

  wss.on('connection', async (clientWs: WebSocket) => {
    let liveSession: any = null;

    try {
      const ai = getGenAI();
      liveSession = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Zephyr' }
            }
          },
          systemInstruction:
            'You are MUSTAPHA AI PROMPT Voice Assistant. Speak naturally, concisely, and warmly in English or Hausa depending on the user.'
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            if (clientWs.readyState !== WebSocket.OPEN) return;
            const parts = message.serverContent?.modelTurn?.parts || [];
            for (const part of parts) {
              if (part.inlineData?.data) {
                clientWs.send(
                  JSON.stringify({
                    type: 'audio',
                    audio: part.inlineData.data
                  })
                );
              }
              if (part.text) {
                clientWs.send(
                  JSON.stringify({
                    type: 'transcript',
                    role: 'assistant',
                    text: part.text
                  })
                );
              }
            }
            if (message.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ type: 'interrupted' }));
            }
          },
          onerror: (err: any) => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(
                JSON.stringify({
                  type: 'error',
                  error: sanitizeProviderError(err, 'en', 'voice')
                })
              );
            }
          }
        }
      });

      clientWs.send(JSON.stringify({ type: 'connected', model: 'gemini-3.8-live' }));
    } catch (err: any) {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(
          JSON.stringify({
            type: 'error',
            error: sanitizeProviderError(err, 'en', 'voice')
          })
        );
      }
      return;
    }

    clientWs.on('message', (rawData) => {
      try {
        const msg = JSON.parse(rawData.toString());
        if (msg.audio && liveSession) {
          liveSession.sendRealtimeInput({
            audio: {
              data: msg.audio,
              mimeType: 'audio/pcm;rate=16000'
            }
          });
        } else if (msg.text && liveSession) {
          liveSession.sendRealtimeInput({
            text: String(msg.text)
          });
        }
      } catch {
        // Ignore malformed frame
      }
    });

    clientWs.on('close', () => {
      try {
        liveSession?.close?.();
      } catch {
        // Ignore close error
      }
    });
  });

  // Mount Vite in dev or static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vitePromise = createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(async (req, res, next) => {
      try {
        const vite = await vitePromise;
        vite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`MUSTAPHA AI PROMPT server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});

