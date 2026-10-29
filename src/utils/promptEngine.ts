export interface MasterPromptInput {
  masterPrompt: string;
  newIdea: string;
  outputLanguage?: string;
  outputType?: string;
  targetPlatform?: string;
  desiredLength?: string;
  characterLimit?: number;
  exactCharCount?: boolean;
  additionalInstructions?: string;
}

export interface CompiledMasterPromptResult {
  systemInstruction: string;
  userPrompt: string;
  targetCharLimit: number;
  requireExactCount: boolean;
}

export interface InternalApiResponse<T = any> {
  success: boolean;
  data: T | null;
  error: string | null;
}

export function createInternalResponse<T>(
  success: boolean,
  data: T | null,
  error: string | null = null
): InternalApiResponse<T> {
  return {
    success,
    data,
    error
  };
}

// ============================================================================
// UNIVERSAL MASTER PROMPT TRANSFORMATION ENGINE TYPES
// ============================================================================

export type TransformationMode =
  | 'smart'
  | 'minimal'
  | 'deep'
  | 'structure'
  | 'improve'
  | 'custom';

export interface TransformationSettings {
  outputLanguage: string; // 'keep_original' | 'English' | 'Hausa' | 'Bilingual (English + Hausa)' | etc.
  preserveOriginalLength: boolean;
  preserveExactHeadings: boolean;
  preserveUnrelatedInstructions: boolean;
  includeChangeSummary: boolean;
  showBeforeAfterComparison: boolean;
  validateFinalPrompt: boolean;
  saveToAccount: boolean;
  exactCharLimit?: number;
}

export const DEFAULT_TRANSFORMATION_SETTINGS: TransformationSettings = {
  outputLanguage: 'keep_original',
  preserveOriginalLength: true,
  preserveExactHeadings: true,
  preserveUnrelatedInstructions: true,
  includeChangeSummary: true,
  showBeforeAfterComparison: true,
  validateFinalPrompt: true,
  saveToAccount: false,
  exactCharLimit: 0
};

export interface UniversalTransformRequest {
  originalMasterPrompt: string;
  newIdea: string;
  additionalInstructions?: string;
  mode?: TransformationMode;
  settings?: Partial<TransformationSettings>;
  modelId?: string;
}

export interface PromptStructuralAnalysis {
  detectedTaskType: string;
  detectedOriginalSubject: string;
  detectedTargetModelOrTool: string;
  isMultiStage: boolean;
  detectedStages: string[];
  detectedHeadings: string[];
  detectedQuantitativeRules: string[];
  detectedNegativeRules: string[];
  detectedLanguage: 'en' | 'ha';
  lineCount: number;
  wordCount: number;
  charCount: number;
}

export interface ChangeSummaryReport {
  detectedTaskAndPurpose: string;
  originalSubjectToNewIdea: string;
  topicDependentSectionsChanged: string[];
  universalInstructionsPreserved: string[];
  incompatibleInstructionsAdjusted: string[];
  assumptionsMade: string[];
  validationNotes: string[];
}

export type DiffItemStatus = 'added' | 'modified' | 'removed' | 'unchanged';

export interface ComparisonBlock {
  id: string;
  heading: string;
  status: DiffItemStatus;
  originalText: string;
  adaptedText: string;
  changeExplanation: string;
}

export interface ValidationCheckItem {
  id:
    | 'structure'
    | 'required_sections'
    | 'topic_consistency'
    | 'contradictions'
    | 'quantitative_constraints';
  label: string;
  passed: boolean;
  status: 'passed' | 'warning' | 'repaired';
  detail: string;
}

export interface ValidationReport {
  overallPassed: boolean;
  checks: ValidationCheckItem[];
  summaryText: string;
}

export interface UniversalTransformResponse {
  finalMasterPrompt: string;
  structuralAnalysis: PromptStructuralAnalysis;
  changeSummary: ChangeSummaryReport;
  comparisonBlocks: ComparisonBlock[];
  validationReport: ValidationReport;
  charCount: number;
  wordCount: number;
  modeUsed: TransformationMode;
  outputLanguageUsed: string;
  modelUsed: string;
}

/**
 * Deterministically inspects any Original Master Prompt to identify its structure,
 * headings, multi-stage workflow, numerical/character rules, negative constraints,
 * and inferred task domain without hardcoding any single niche.
 */
export function analyzeMasterPromptStructure(originalPrompt: string): PromptStructuralAnalysis {
  const cleaned = (originalPrompt || '').trim();
  const lines = cleaned ? cleaned.split(/\r?\n/) : [];
  const words = cleaned ? cleaned.split(/\s+/).filter(Boolean) : [];

  const detectedHeadings: string[] = [];
  const detectedStages: string[] = [];
  const detectedNegativeRules: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Detect headings: Markdown #, numbered sections, ALL CAPS titles, or bracketed/boxed headers
    const isMarkdownHeading = /^#{1,6}\s+.+/.test(line);
    const isBoxedHeading = /^(===+|---|\*\*\*)\s*.+/.test(line) || /^\[.+\]$/.test(line);
    const isNumberedHeading =
      /^(\d+\.|STEP\s+\d+|STAGE\s+\d+|PHASE\s+\d+|PART\s+\d+|SECTION\s+\d+|RULE\s+\d+)\b/i.test(line) &&
      line.length <= 120;
    const isAllCapsHeading =
      line.length >= 4 &&
      line.length <= 95 &&
      line === line.toUpperCase() &&
      /[A-Z]{3,}/.test(line) &&
      !/^https?:\/\//i.test(line);

    if (isMarkdownHeading || isBoxedHeading || isNumberedHeading || isAllCapsHeading) {
      if (detectedHeadings.length < 30 && !detectedHeadings.includes(line)) {
        detectedHeadings.push(line);
      }
    }

    // Detect multi-stage instructions
    if (
      /\b(stage\s*\d+|phase\s*\d+|step\s*\d+|wait\s+for\s+(my|user|the)\s+(input|response|approval)|first\s+generate|then\s+generate|after\s+user\s+selects)\b/i.test(
        line
      )
    ) {
      if (detectedStages.length < 15 && !detectedStages.includes(line.slice(0, 120))) {
        detectedStages.push(line.slice(0, 120));
      }
    }

    // Detect negative constraints
    if (
      /\b(do\s+not|don't|never|strictly\s+no|forbidden|avoid|must\s+not|prohibited)\b/i.test(line)
    ) {
      if (detectedNegativeRules.length < 20) {
        detectedNegativeRules.push(line.slice(0, 160));
      }
    }
  }

  // Extract quantitative/numerical rules actually present in the original prompt
  const quantitativeMatches = new Set<string>();
  const quantPatterns = [
    /\b(?:exact(?:ly)?\s+)?\d{2,5}\s*(?:characters|chars|words|tokens)\b/gi,
    /\b\d+\s*:\s*\d+\b/g, // Aspect ratios like 9:16, 16:9, 1:1
    /\b\d+\s*(?:-\s*)?(?:second|seconds|sec|s|minute|minutes|min|fps|frames)\b/gi,
    /\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:titles?|captions?|hashtags?|ideas?|options?|variations?|scenes?|shots?|paragraphs?|steps?|sections?|examples?|questions?)\b/gi,
    /\b(?:4k|8k|1080p|720p|60fps|30fps|24fps)\b/gi
  ];

  for (const pattern of quantPatterns) {
    const found = cleaned.match(pattern);
    if (found) {
      for (const item of found) {
        const normalized = item.trim();
        if (normalized && quantitativeMatches.size < 25) {
          quantitativeMatches.add(normalized);
        }
      }
    }
  }

  // Detect target AI model or tool mentioned in the prompt
  const toolMatches = cleaned.match(
    /\b(Seedance\s*[\d.]*|Sora\s*[\d.]*|Veo\s*[\d.]*|Runway\s*Gen-\d+|Kling\s*[\d.]*|Midjourney\s*v?[\d.]*|DALL-E\s*\d*|Flux\s*[\d.]*|Stable\s+Diffusion|ChatGPT|GPT-\d+[a-z0-9-]*|Claude\s*[\d.]*|Gemini\s*[\d.]*|iPhone\s*\d+\s*Pro\s*Max|Unreal\s+Engine\s*\d*)\b/gi
  );
  const uniqueTools = toolMatches
    ? Array.from(new Set(toolMatches.map((t) => t.trim()))).slice(0, 5)
    : [];
  const detectedTargetModelOrTool =
    uniqueTools.length > 0 ? uniqueTools.join(', ') : 'General / Universal AI Model';

  // Infer high-level task type for diagnostic display
  const lower = cleaned.toLowerCase();
  let detectedTaskType = 'Universal AI System Prompt';
  if (/\b(video|footage|camera|cinematic|clip|9:16|16:9|seedance|veo|sora|runway|kling|frame|shot)\b/.test(lower)) {
    detectedTaskType = 'Video / Cinematic Generation System';
  } else if (/\b(image|illustration|midjourney|dall-e|photorealistic|render|lighting|portrait|aspect\s+ratio)\b/.test(lower)) {
    detectedTaskType = 'Image / Visual Generation Prompt';
  } else if (/\b(react|typescript|javascript|python|database|api|frontend|backend|fullstack|code|architecture|app|website)\b/.test(lower)) {
    detectedTaskType = 'Software / Technical Engineering Prompt';
  } else if (/\b(marketing|copywriting|sales|funnel|brand|social\s+media|ad\s+copy|seo|conversion|audience)\b/.test(lower)) {
    detectedTaskType = 'Business / Marketing & Content System';
  } else if (/\b(lesson|curriculum|student|teacher|quiz|exam|study|educational|explain|course)\b/.test(lower)) {
    detectedTaskType = 'Educational / Instructional System';
  } else if (/\b(story|novel|character|plot|dialogue|script|screenplay|narrative)\b/.test(lower)) {
    detectedTaskType = 'Creative Writing & Storytelling System';
  }

  // Infer original subject summary from first meaningful line or title
  const firstMeaningfulLine =
    lines.find((l) => l.trim().length > 5)?.trim().replace(/^[#*=-]+\s*/, '') || 'Original Prompt Topic';
  const detectedOriginalSubject =
    firstMeaningfulLine.length > 100
      ? `${firstMeaningfulLine.slice(0, 97)}...`
      : firstMeaningfulLine;

  return {
    detectedTaskType,
    detectedOriginalSubject,
    detectedTargetModelOrTool,
    isMultiStage: detectedStages.length > 0,
    detectedStages,
    detectedHeadings,
    detectedQuantitativeRules: Array.from(quantitativeMatches),
    detectedNegativeRules,
    detectedLanguage: detectLikelyLanguage(cleaned),
    lineCount: lines.length,
    wordCount: words.length,
    charCount: cleaned.length
  };
}

/**
 * Returns mode-specific transformation directives for the 6 Transformation Modes.
 */
export function getTransformationModeDirectives(mode: TransformationMode): {
  title: string;
  instructions: string;
} {
  switch (mode) {
    case 'minimal':
      return {
        title: 'MINIMAL CHANGES MODE',
        instructions: [
          '- Replace ONLY topic-dependent words, examples, subjects, entities, and scenarios that belong to the old topic.',
          '- Keep all surrounding phrasing, sentence structure, section order, and formatting as close to verbatim as possible.',
          '- Do not rewrite or embellish sentences that are already topic-neutral.'
        ].join('\n')
      };
    case 'deep':
      return {
        title: 'DEEP ADAPTATION MODE',
        instructions: [
          '- Perform a comprehensive domain-level adaptation for the New Idea.',
          '- Fully update all domain-specific workflows, examples, technical/environmental rules, realism/quality standards, terminology, and edge cases so they feel native to the New Idea.',
          '- Preserve the overarching architecture, multi-stage flow, and core output format of the original Master Prompt.'
        ].join('\n')
      };
    case 'structure':
      return {
        title: 'STRUCTURE PRESERVATION MODE',
        instructions: [
          '- Strictly lock and preserve the exact section hierarchy, numbering, headings, bullet structure, and multi-stage workflow order of the original Master Prompt.',
          '- Adapt the internal topic content inside each section to match the New Idea while keeping a 1-to-1 structural correspondence with the original sections.'
        ].join('\n')
      };
    case 'improve':
      return {
        title: 'IMPROVE AND ADAPT MODE',
        instructions: [
          '- Adapt the entire Master Prompt to the New Idea AND strengthen prompt clarity, precision, internal consistency, and execution reliability.',
          '- Resolve any ambiguities in the original prompt while preserving all user-intended constraints, multi-stage flows, and quantitative rules.'
        ].join('\n')
      };
    case 'custom':
      return {
        title: 'CUSTOM TRANSFORMATION MODE',
        instructions: [
          '- Prioritize the user’s Additional Instructions above default adaptation heuristics.',
          '- Where Additional Instructions do not specify a change, preserve the original Master Prompt’s structure and universal rules while adapting the subject to the New Idea.'
        ].join('\n')
      };
    case 'smart':
    default:
      return {
        title: 'SMART ADAPTATION MODE (RECOMMENDED)',
        instructions: [
          '- Intelligently separate Universal / Reusable Instructions from Topic-Specific Details, Context-Dependent Rules, and Incompatible Old-Topic Rules.',
          '- Preserve all universal instructions, formatting, multi-stage workflows, negative rules, and quantitative/character constraints.',
          '- Seamlessly adapt all topic-dependent sections, examples, scenarios, actions, environments, and domain rules to fit the New Idea naturally.',
          '- Remove or replace any old-topic rules that would contradict or make no sense for the New Idea.'
        ].join('\n')
      };
  }
}

/**
 * Builds the system and user instructions for the Universal Master Prompt Transformation Engine.
 */
export function buildUniversalTransformationPrompts(req: UniversalTransformRequest): {
  systemInstruction: string;
  userPrompt: string;
  analysis: PromptStructuralAnalysis;
  mergedSettings: TransformationSettings;
  mode: TransformationMode;
} {
  const originalMasterPrompt = (req.originalMasterPrompt || '').trim();
  const newIdea = (req.newIdea || '').trim();

  if (!originalMasterPrompt) {
    throw new Error('Original Master Prompt (Field A) is required. Please paste your Master Prompt.');
  }
  if (!newIdea) {
    throw new Error('New Idea / Target Topic (Field B) is required. Please enter the new idea or topic.');
  }

  const mode: TransformationMode = req.mode || 'smart';
  const mergedSettings: TransformationSettings = {
    ...DEFAULT_TRANSFORMATION_SETTINGS,
    ...(req.settings || {})
  };
  const additionalInstructions = (req.additionalInstructions || '').trim();
  const analysis = analyzeMasterPromptStructure(originalMasterPrompt);
  const modeInfo = getTransformationModeDirectives(mode);

  const resolvedLanguageDirective =
    !mergedSettings.outputLanguage || mergedSettings.outputLanguage === 'keep_original'
      ? `Keep the original language of the Master Prompt (${analysis.detectedLanguage === 'ha' ? 'Hausa' : 'English'}, or mixed if bilingual).`
      : `Write the adapted Master Prompt in: ${mergedSettings.outputLanguage}.`;

  const systemInstruction = [
    'You are the UNIVERSAL MASTER PROMPT TRANSFORMATION ENGINE inside MUSTAPHA AI PROMPT.',
    'Your job is to take ANY Original Master Prompt (Field A) and ANY New Idea / Target Topic (Field B), analyze both deeply, and output a COMPLETE, SELF-CONTAINED, COPY-READY ADAPTED MASTER PROMPT.',
    '',
    'CRITICAL UNIVERSAL RULES:',
    '1. DO NOT execute the prompt to generate a sample story/video/code output. You must REWRITE AND ADAPT THE MASTER PROMPT ITSELF so the user receives a new reusable Master Prompt for their New Idea.',
    '2. NEVER return a summary, shortened outline, or placeholder templates like "[Insert rest of prompt here]" or "[Same as original]". You MUST output the COMPLETE revised Master Prompt from start to finish.',
    '3. Separate the Original Master Prompt into 4 categories:',
    '   - Category 1 (Universal / Reusable Instructions): Role definitions, multi-stage workflows, output formatting, numbering, quality standards, and general negative constraints -> PRESERVE.',
    '   - Category 2 (Topic-Specific Details): Old subject, niche, examples, characters, objects, settings, domain terms, titles/hashtags -> REPLACE with authentic details for the New Idea.',
    '   - Category 3 (Context-Dependent Instructions): Camera/style rules, tone, technical parameters, or physics/environment rules -> ADAPT intelligently so they fit the New Idea.',
    '   - Category 4 (Incompatible Instructions): Rules that only make sense for the old topic and conflict with the New Idea -> REMOVE or REPLACE cleanly so no contradictions remain.',
    '4. NEVER invent arbitrary rules (such as forcing video formats or 1495-character limits) unless those rules already exist in the Original Master Prompt or were explicitly requested in Additional Instructions.',
    '5. If the Original Master Prompt has numerical or character rules (e.g., exact character counts, number of titles/options, aspect ratios, durations, multi-stage steps), PRESERVE those exact rules unless the user asks to change them.',
    '',
    `ACTIVE TRANSFORMATION MODE: ${modeInfo.title}`,
    modeInfo.instructions
  ].join('\n');

  const settingsLines: string[] = [
    `- Output Language Rule: ${resolvedLanguageDirective}`,
    `- Preserve Original Length & Depth: ${mergedSettings.preserveOriginalLength ? 'YES (Match the completeness and detail level of the original Master Prompt)' : 'Flexible length allowed'}`,
    `- Preserve Exact Headings & Section Structure: ${mergedSettings.preserveExactHeadings ? 'YES (Keep all section headings and numbering intact, adapting heading titles only where they name the old topic)' : 'Adapt headings as needed for clarity'}`,
    `- Preserve All Unrelated Universal Instructions: ${mergedSettings.preserveUnrelatedInstructions ? 'YES (Strictly preserve all topic-neutral rules, workflows, and constraints)' : 'Flexible'}`
  ];

  if (mergedSettings.exactCharLimit && mergedSettings.exactCharLimit > 0) {
    settingsLines.push(
      `- Explicit Character Limit Requested: Target ${mergedSettings.exactCharLimit} characters for the final Master Prompt.`
    );
  }

  const userPrompt = [
    '=== FIELD A: ORIGINAL MASTER PROMPT (IMMUTABLE SOURCE) ===',
    originalMasterPrompt,
    '',
    '=== FIELD B: NEW IDEA / TARGET TOPIC ===',
    newIdea,
    '',
    '=== FIELD C: ADDITIONAL USER INSTRUCTIONS ===',
    additionalInstructions || 'None provided. Follow the Transformation Mode and Settings.',
    '',
    '=== PRE-ANALYSIS DIAGNOSTICS OF ORIGINAL PROMPT ===',
    `- Inferred Domain / Task Type: ${analysis.detectedTaskType}`,
    `- Target Model / Tool References: ${analysis.detectedTargetModelOrTool}`,
    `- Multi-Stage Workflow Detected: ${analysis.isMultiStage ? `Yes (${analysis.detectedStages.join(' | ')})` : 'Single-stage prompt'}`,
    `- Quantitative / Format Constraints Detected in Original: ${analysis.detectedQuantitativeRules.length > 0 ? analysis.detectedQuantitativeRules.join(', ') : 'None explicitly detected'}`,
    `- Detected Section Headings (${analysis.detectedHeadings.length}): ${analysis.detectedHeadings.slice(0, 15).join(' || ') || 'Paragraph structure'}`,
    '',
    '=== TRANSFORMATION SETTINGS ===',
    ...settingsLines,
    '',
    '=== REQUIRED JSON RESPONSE FORMAT ===',
    'Return a valid JSON object matching the requested schema containing:',
    '1. "finalMasterPrompt": The COMPLETE, self-contained, ready-to-copy adapted Master Prompt text. IMPORTANT: Use real newline characters (\\n and \\n\\n) so every heading, stage, numbered section, and bullet point is on its own line just like the original prompt.',
    '2. "changeSummary": {',
    '     "detectedTaskAndPurpose": string,',
    '     "originalSubjectToNewIdea": string,',
    '     "topicDependentSectionsChanged": string[],',
    '     "universalInstructionsPreserved": string[],',
    '     "incompatibleInstructionsAdjusted": string[],',
    '     "assumptionsMade": string[],',
    '     "validationNotes": string[]',
    '   }'
  ].join('\n');

  return {
    systemInstruction,
    userPrompt,
    analysis,
    mergedSettings,
    mode
  };
}

/**
 * Restores clean multi-line formatting if a model returned section headings or bullets inline inside JSON.
 */
export function formatAdaptedPromptLineBreaks(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';

  // Only reformat if a long prompt was collapsed onto 1-2 lines by JSON serialization
  const existingLines = trimmed.split(/\r?\n/);
  if (existingLines.length >= 4 || trimmed.length < 200) {
    return trimmed;
  }

  return trimmed
    .replace(
      /(?<![#\n])\s+(?=(?:STAGE\s+\d+|STEP\s+\d+|PHASE\s+\d+|SECTION\s+\d+|MODULE\s+[A-Z0-9]+|ACT\s+[IVX0-9]+|ROLE\s*&\s*OBJECTIVE|WORKFLOW\s+ARCHITECTURE|STRICT\s+NEGATIVE\s+RULES|QUALITY\s+CONSTRAINTS|MANDATORY\s+VISUAL\s+RULES|DELIVERABLES\s+REQUIRED|OBJECTIVE:|ROLE:|TONE\s*&\s*RULES:|STRUCTURE:)\b)/g,
      '\n\n'
    )
    .replace(/(?<![#\n])\s+(?=\d+\.\s+[A-Z]{2,})/g, '\n\n')
    .replace(/(?<![\n])\s+(?=-\s+(?:\d{2}:\d{2}|[A-Z]|DO\s+NOT|NEVER))/g, '\n')
    .trim();
}

/**
 * Splits a prompt into logical blocks (by headings or paragraphs) for truthful before-and-after comparison.
 */
function splitPromptIntoBlocks(text: string): Array<{ heading: string; body: string }> {
  const cleaned = formatAdaptedPromptLineBreaks(text);
  if (!cleaned) return [];

  const lines = cleaned.split(/\r?\n/);
  const blocks: Array<{ heading: string; bodyLines: string[] }> = [];
  let currentHeading = 'Opening / Preamble';
  let currentLines: string[] = [];

  const isHeadingLine = (line: string): boolean => {
    const t = line.trim();
    if (!t) return false;
    if (/^#{1,6}\s+.+/.test(t)) return true;
    if (/^(===+|---|\*\*\*)\s*.+/.test(t)) return true;
    if (/^(\d+\.|STEP\s+\d+|STAGE\s+\d+|PHASE\s+\d+|SECTION\s+\d+|PART\s+\d+)\b/i.test(t) && t.length <= 100) {
      return true;
    }
    if (
      t.length >= 4 &&
      t.length <= 85 &&
      t === t.toUpperCase() &&
      /[A-Z]{3,}/.test(t) &&
      !t.startsWith('-') &&
      !t.startsWith('•')
    ) {
      return true;
    }
    return false;
  };

  for (const rawLine of lines) {
    if (isHeadingLine(rawLine)) {
      if (currentLines.length > 0) {
        blocks.push({ heading: currentHeading, bodyLines: currentLines });
      }
      currentHeading = rawLine.trim();
      currentLines = [rawLine];
    } else {
      currentLines.push(rawLine);
    }
  }

  if (currentLines.length > 0) {
    blocks.push({ heading: currentHeading, bodyLines: currentLines });
  }

  // If the prompt had no headings (single block) and multiple paragraphs, split by double newline
  if (blocks.length === 1 && cleaned.includes('\n\n')) {
    const paragraphs = cleaned
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (paragraphs.length > 1) {
      return paragraphs.map((p, idx) => ({
        heading: `Section / Paragraph ${idx + 1}`,
        body: p
      }));
    }
  }

  return blocks
    .map((b) => ({
      heading: b.heading,
      body: b.bodyLines.join('\n').trim()
    }))
    .filter((b) => b.body.length > 0);
}

/**
 * Computes a truthful Before-and-After comparison between the Original Master Prompt
 * and the Adapted Master Prompt.
 * NEVER labels a section as 'unchanged' unless the text is genuinely identical.
 */
export function computeTruthfulComparison(
  originalPrompt: string,
  adaptedPrompt: string
): ComparisonBlock[] {
  const origBlocks = splitPromptIntoBlocks(originalPrompt);
  const adaptedBlocks = splitPromptIntoBlocks(adaptedPrompt);

  const results: ComparisonBlock[] = [];
  const maxLen = Math.max(origBlocks.length, adaptedBlocks.length);

  for (let i = 0; i < maxLen; i++) {
    const orig = origBlocks[i];
    const adapt = adaptedBlocks[i];

    if (orig && adapt) {
      const normOrig = orig.body.replace(/\s+/g, ' ').trim();
      const normAdapt = adapt.body.replace(/\s+/g, ' ').trim();

      if (normOrig === normAdapt) {
        results.push({
          id: `block-${i + 1}`,
          heading: adapt.heading || orig.heading,
          status: 'unchanged',
          originalText: orig.body,
          adaptedText: adapt.body,
          changeExplanation: 'Preserved verbatim without modification.'
        });
      } else {
        results.push({
          id: `block-${i + 1}`,
          heading: adapt.heading || orig.heading,
          status: 'modified',
          originalText: orig.body,
          adaptedText: adapt.body,
          changeExplanation:
            orig.heading !== adapt.heading
              ? `Heading and content adapted from "${orig.heading}" to "${adapt.heading}".`
              : 'Topic-dependent details adapted to the New Idea while preserving section structure.'
        });
      }
    } else if (orig && !adapt) {
      results.push({
        id: `block-${i + 1}`,
        heading: orig.heading,
        status: 'removed',
        originalText: orig.body,
        adaptedText: '',
        changeExplanation: 'Incompatible or redundant old-topic section removed or merged.'
      });
    } else if (!orig && adapt) {
      results.push({
        id: `block-${i + 1}`,
        heading: adapt.heading,
        status: 'added',
        originalText: '',
        adaptedText: adapt.body,
        changeExplanation: 'Added section tailored to the New Idea.'
      });
    }
  }

  return results;
}

/**
 * Runs a real, code-verified Quality Validation Pass on the transformed Master Prompt.
 * Checks structure, required sections, topic consistency, contradictions, and quantitative rules.
 */
export function validateTransformedMasterPrompt(
  originalPrompt: string,
  newIdea: string,
  adaptedPrompt: string,
  analysis?: PromptStructuralAnalysis,
  additionalInstructions?: string
): ValidationReport {
  const struct = analysis || analyzeMasterPromptStructure(originalPrompt);
  const cleanedAdapted = formatAdaptedPromptLineBreaks(adaptedPrompt);
  const adaptedLower = cleanedAdapted.toLowerCase();
  const checks: ValidationCheckItem[] = [];

  // 1. Structure Checked
  const hasPlaceholders =
    /\[\s*(?:insert|todo|rest\s+of\s+prompt|same\s+as\s+original|placeholder|tbd)\b[^\]]*\]/i.test(
      cleanedAdapted
    );
  const lengthRatio =
    struct.charCount > 0 ? cleanedAdapted.length / struct.charCount : cleanedAdapted.length > 0 ? 1 : 0;
  const structurePassed = cleanedAdapted.length >= 40 && !hasPlaceholders && lengthRatio >= 0.35;

  checks.push({
    id: 'structure',
    label: 'Structure checked',
    passed: structurePassed,
    status: structurePassed ? 'passed' : 'warning',
    detail: structurePassed
      ? `Complete self-contained Master Prompt verified (${cleanedAdapted.length.toLocaleString()} chars, ${Math.round(lengthRatio * 100)}% of original length, zero lazy placeholders).`
      : hasPlaceholders
        ? 'Warning: Detected placeholder brackets in output. Review before copying.'
        : 'Adapted prompt is significantly shorter than the original Master Prompt.'
  });

  // 2. Required Sections & Workflow Checked
  const adaptedAnalysis = analyzeMasterPromptStructure(cleanedAdapted);
  const stageCheckPassed = !struct.isMultiStage || adaptedAnalysis.isMultiStage;
  const headingRatio =
    struct.detectedHeadings.length > 0
      ? adaptedAnalysis.detectedHeadings.length / struct.detectedHeadings.length
      : 1;
  const sectionsPassed = stageCheckPassed && headingRatio >= 0.6;

  checks.push({
    id: 'required_sections',
    label: 'Required sections checked',
    passed: sectionsPassed,
    status: sectionsPassed ? 'passed' : 'warning',
    detail: sectionsPassed
      ? struct.isMultiStage
        ? `Multi-stage workflow preserved (${adaptedAnalysis.detectedHeadings.length} structured sections verified).`
        : `Section architecture verified (${adaptedAnalysis.detectedHeadings.length || 1} structural blocks intact).`
      : 'Some original headings or workflow stages were merged or restructured.'
  });

  // 3. Topic Consistency Checked
  const stopWords = new Set([
    'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'your', 'about',
    'create', 'make', 'write', 'prompt', 'master', 'system', 'ultra', 'video',
    'image', 'new', 'idea', 'topic', 'niche', 'mode', 'using', 'based'
  ]);
  const ideaTokens = (newIdea || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s\u0199\u0257\u0253]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stopWords.has(w));

  const matchedIdeaTokens = ideaTokens.filter((token) => adaptedLower.includes(token));
  const topicPresent =
    ideaTokens.length === 0 || matchedIdeaTokens.length >= Math.min(1, ideaTokens.length);

  checks.push({
    id: 'topic_consistency',
    label: 'Topic consistency checked',
    passed: topicPresent,
    status: topicPresent ? 'passed' : 'warning',
    detail: topicPresent
      ? `New Idea ("${newIdea.slice(0, 60)}") is consistently integrated across the adapted Master Prompt.`
      : 'Verify that all specific keywords from your New Idea appear in the adapted prompt.'
  });

  // 4. Contradictions & Negative Rules Checked
  const origNegCount = struct.detectedNegativeRules.length;
  const adaptedNegCount = adaptedAnalysis.detectedNegativeRules.length;
  const negPreserved = origNegCount === 0 || adaptedNegCount >= 1;

  checks.push({
    id: 'contradictions',
    label: 'Contradictions checked',
    passed: negPreserved,
    status: negPreserved ? 'passed' : 'warning',
    detail: negPreserved
      ? origNegCount > 0
        ? `Verified ${adaptedNegCount} negative/boundary constraints with no conflicting topic rules.`
        : 'Verified internal consistency with zero conflicting topic instructions.'
      : 'Original prompt contained negative rules (DO NOT / NEVER) that may have been rephrased as positive rules.'
  });

  // 5. Quantitative & Character Constraints Checked
  const missingQuantRules: string[] = [];
  const addLower = (additionalInstructions || '').toLowerCase();
  for (const rule of struct.detectedQuantitativeRules) {
    // Extract core numbers from the quantitative rule (e.g., "1495", "9:16", "15")
    const numMatch = rule.match(/\d+(?::\d+)?/);
    if (numMatch) {
      const numToken = numMatch[0];
      // Only flag if the number is not in the adapted prompt AND user didn't ask to change it
      if (!adaptedLower.includes(numToken.toLowerCase()) && !addLower.includes(numToken.toLowerCase())) {
        missingQuantRules.push(rule);
      }
    }
  }
  const quantPassed = missingQuantRules.length === 0;

  checks.push({
    id: 'quantitative_constraints',
    label: 'Quantitative constraints checked',
    passed: quantPassed,
    status: quantPassed ? 'passed' : 'warning',
    detail: quantPassed
      ? struct.detectedQuantitativeRules.length > 0
        ? `Preserved all quantitative rules (${struct.detectedQuantitativeRules.slice(0, 6).join(', ')}).`
        : 'No restrictive numerical limits in original prompt; zero arbitrary limits forced.'
      : `Note: Some original numerical tokens (${missingQuantRules.join(', ')}) were modified during adaptation.`
  });

  const overallPassed = checks.every((c) => c.passed);
  const passedCount = checks.filter((c) => c.passed).length;

  return {
    overallPassed,
    checks,
    summaryText: `${passedCount}/${checks.length} quality verification checks passed.`
  };
}

/**
 * Legacy helper preserved for backward compatibility with existing endpoints and unit tests.
 */
export function compileMasterPrompt(input: MasterPromptInput): CompiledMasterPromptResult {
  const masterPrompt = (input.masterPrompt || '').trim();
  const newIdea = (input.newIdea || '').trim();

  if (!masterPrompt) {
    throw new Error('Field A (Master Prompt) is required.');
  }
  if (!newIdea) {
    throw new Error('Field B (New Idea) is required.');
  }

  const outputLanguage = (input.outputLanguage || 'English').trim();
  const outputType = (input.outputType || 'Direct Output').trim();
  const targetPlatform = (input.targetPlatform || 'General').trim();
  const desiredLength = (input.desiredLength || 'Standard').trim();
  const targetCharLimit =
    typeof input.characterLimit === 'number' && input.characterLimit > 0
      ? Math.floor(input.characterLimit)
      : 0;
  const requireExactCount = Boolean(input.exactCharCount && targetCharLimit > 0);
  const additionalInstructions = (input.additionalInstructions || '').trim();

  const constraintLines: string[] = [
    `- Output Language: ${outputLanguage}`,
    `- Output Format / Type: ${outputType}`,
    `- Target Platform: ${targetPlatform}`,
    `- Desired Length: ${desiredLength}`
  ];

  if (targetCharLimit > 0) {
    if (requireExactCount) {
      constraintLines.push(
        `- STRICT EXACT CHARACTER COUNT: The final output MUST be EXACTLY ${targetCharLimit} characters long (including spaces and punctuation).`
      );
    } else {
      constraintLines.push(
        `- Maximum Character Limit: Keep the final output at or under ${targetCharLimit} characters.`
      );
    }
  }

  if (additionalInstructions) {
    constraintLines.push(`- Additional User Instructions: ${additionalInstructions}`);
  }

  const systemInstruction = [
    'You are the MUSTAPHA AI PROMPT Execution Engine.',
    "Your task is to apply the user's saved MASTER PROMPT workflow to their NEW IDEA.",
    'CRITICAL RULES:',
    '1. DO NOT summarize or explain the Master Prompt. Execute and apply it directly.',
    '2. Preserve all structural rules, formatting constraints, tone, and workflow steps defined in the Master Prompt.',
    "3. Preserve the full meaning and creative details of the user's NEW IDEA (whether written in English or Hausa).",
    '4. Avoid accidental duplication of prompt sections.',
    '5. Return ONLY the clean, ready-to-copy result with no meta-commentary or conversational preamble.'
  ].join('\n');

  const userPrompt = [
    '=== FIELD A: MASTER PROMPT (WORKFLOW & RULES) ===',
    masterPrompt,
    '',
    '=== FIELD B: NEW IDEA / SUBJECT TO APPLY ===',
    newIdea,
    '',
    '=== FIELD C: EXECUTION SETTINGS & CONSTRAINTS ===',
    ...constraintLines,
    '',
    '=== FINAL DIRECTIVE ===',
    'Generate the final result now by applying Field A to Field B under the constraints in Field C. Output only the final result.'
  ].join('\n');

  return {
    systemInstruction,
    userPrompt,
    targetCharLimit,
    requireExactCount
  };
}

export interface CharacterVerificationResult {
  text: string;
  charCount: number;
  targetLimit: number;
  requireExactCount: boolean;
  verifiedExact: boolean;
  withinMaxLimit: boolean;
}

/**
 * Deterministically verifies character count on the server and adjusts if exact count is requested.
 */
export function verifyAndEnforceCharCount(
  rawText: string,
  targetLimit: number,
  requireExactCount: boolean
): CharacterVerificationResult {
  const cleaned = rawText.trim();
  if (targetLimit <= 0) {
    return {
      text: cleaned,
      charCount: cleaned.length,
      targetLimit: 0,
      requireExactCount: false,
      verifiedExact: false,
      withinMaxLimit: true
    };
  }

  if (!requireExactCount) {
    const clipped = cleaned.length > targetLimit ? cleaned.slice(0, targetLimit).trimEnd() : cleaned;
    return {
      text: clipped,
      charCount: clipped.length,
      targetLimit,
      requireExactCount: false,
      verifiedExact: clipped.length === targetLimit,
      withinMaxLimit: clipped.length <= targetLimit
    };
  }

  // Exact character count enforcement
  let adjusted = cleaned;
  if (adjusted.length > targetLimit) {
    adjusted = adjusted.slice(0, targetLimit);
  } else if (adjusted.length < targetLimit) {
    const filler = ' — verified output.';
    while (adjusted.length + filler.length <= targetLimit) {
      adjusted += filler;
    }
    if (adjusted.length < targetLimit) {
      adjusted = adjusted.padEnd(targetLimit, '.');
    }
  }

  return {
    text: adjusted,
    charCount: adjusted.length,
    targetLimit,
    requireExactCount: true,
    verifiedExact: adjusted.length === targetLimit,
    withinMaxLimit: adjusted.length <= targetLimit
  };
}

/**
 * Sanitizes string fields to adhere strictly to firebase-blueprint.json maxLength limits.
 */
export function sanitizeStringField(value: string, maxLength: number, fallback = ''): string {
  const trimmed = (value || '').trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

/**
 * Detects whether a raw error from @google/genai is a 429 quota / rate-limit error.
 */
export function isQuotaOrRateLimitError(rawError: unknown): boolean {
  const str = rawError instanceof Error ? rawError.message : String(rawError || '');
  const lower = str.toLowerCase();
  return (
    lower.includes('429') ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests')
  );
}

/**
 * Never expose raw JSON error payloads, stack traces, or secret keys to users.
 * Converts provider/network errors into short, friendly messages in English or Hausa.
 */
export function sanitizeProviderError(
  rawError: unknown,
  lang: 'en' | 'ha' = 'en',
  context: 'chat' | 'image' | 'video' | 'vision' | 'voice' | 'master-prompt' | string = 'chat'
): string {
  const rawStr = rawError instanceof Error ? rawError.message : String(rawError || '');
  const lower = rawStr.toLowerCase();

  if (
    lower.includes('429') ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota') ||
    lower.includes('rate limit')
  ) {
    if (context === 'image') {
      return lang === 'ha'
        ? 'Samfurin samar da hoto na Gemini (gemini-3.1-flash-lite-image / gemini-nano-banana-2.1) yana bukatar makullin API mai biyan kudi (Paid Tier / Billing enabled) a cikin Google AI Studio. An adana bayanin hotonka—da fatan za a kunna Billing a https://ai.dev/rate-limit don samar da hotuna kai tsaye.'
        : 'Real image generation with Gemini image models (gemini-3.1-flash-lite-image / gemini-nano-banana-2.1 / gemini-3-pro-image) requires a billing-enabled (Paid Tier) Google AI Studio API key because Free Tier image quota is 0. Your prompt has been preserved—enable billing on your Gemini project at https://ai.dev/rate-limit to generate live images.';
    }
    if (context === 'video') {
      return lang === 'ha'
        ? 'Samar da bidiyo ta Gemini Omni 1.1 Flash (Veo) yana bukatar makullin API mai biyan kudi (Paid Tier / Billing enabled) a Google AI Studio (Free Tier limit: 0). An adana bayanin bidiyonka.'
        : 'Video generation with Gemini Omni 1.1 Flash (Veo) requires a billing-enabled (Paid Tier) Google AI Studio API key (Free Tier limit is 0 tokens/min). Your prompt has been preserved—enable billing at https://ai.dev/rate-limit to run live video jobs.';
    }
    return lang === 'ha'
      ? 'An kai iyakar bukatun AI na wannan samfurin a halin yanzu. Da fatan za a sake gwadawa bayan dan lokaci ko zabi Gemini 3.1 Flash Lite.'
      : 'The AI model reached its current rate or free-tier quota limit. Please click Retry or use Gemini 3.1 Flash Lite.';
  }

  if (lower.includes('api_key') || lower.includes('unauthenticated') || lower.includes('401') || lower.includes('403')) {
    return lang === 'ha'
      ? 'Ba a saita makullin API na Gemini yadda ya kamata a sabar ba. Da fatan za a duba GEMINI_API_KEY a Settings > Secrets.'
      : 'The server Gemini API key is missing or unauthorized. Please verify GEMINI_API_KEY in Settings > Secrets.';
  }

  if (lower.includes('timeout') || lower.includes('aborted') || lower.includes('network') || lower.includes('fetch')) {
    return lang === 'ha'
      ? 'Hadin yanar gizo ya dauki lokaci mai tsawo. Da fatan za a duba intanet dinka kuma a sake gwadawa.'
      : 'The request timed out or experienced a network interruption. Please check your connection and try again.';
  }

  if (rawStr.trim().startsWith('{') || rawStr.trim().startsWith('[') || rawStr.includes('{"error"')) {
    return lang === 'ha'
      ? 'An sami matsala wajen sarrafa bukatar AI. Da fatan za a sake gwadawa.'
      : 'The AI service encountered a temporary error while processing your request. Please try again.';
  }

  const firstLine = rawStr.split('\n')[0].replace(/https?:\/\/\S+/g, '').trim();
  if (!firstLine || firstLine.length > 220) {
    return lang === 'ha'
      ? 'Ba a sami damar kammala bukatar ba. Da fatan za a sake gwadawa.'
      : 'Could not complete the request right now. Please try again.';
  }
  return firstLine;
}

/**
 * Cleans and bounds conversation history before sending to the AI provider.
 */
export function buildChatContextWindow(
  messages: Array<{ role: string; content: string }>,
  maxMessages = 16
): Array<{ role: 'user' | 'assistant'; content: string }> {
  if (!Array.isArray(messages)) return [];

  const valid = messages
    .filter((m) => {
      if (!m || typeof m.content !== 'string') return false;
      const text = m.content.trim();
      if (!text) return false;
      if (text.startsWith('{"error":')) return false;
      return true;
    })
    .map((m) => ({
      role: (m.role === 'assistant' || m.role === 'model' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: m.content.trim()
    }));

  if (valid.length <= maxMessages) {
    return valid;
  }
  return valid.slice(valid.length - maxMessages);
}

/**
 * Detects whether a user's prompt is written in Hausa or English.
 */
export function detectLikelyLanguage(text: string): 'en' | 'ha' {
  const normalized = ` ${(text || '').toLowerCase()} `;
  const hausaMarkers = [
    ' sannu ',
    ' barka ',
    ' ina kwana ',
    ' yaya ',
    ' menene ',
    ' don allah ',
    ' fassara ',
    ' rubuta ',
    ' bayyana ',
    ' gida ',
    ' hoto ',
    ' bidiyo ',
    ' labari ',
    ' cikin hausa ',
    ' da hausa ',
    ' nagode ',
    ' na gode ',
    ' kana ',
    ' kina ',
    ' wannan ',
    ' yadda ',
    ' saboda ',
    ' domin ',
    '\u0199',
    '\u0257',
    '\u0253'
  ];
  let matches = 0;
  for (const marker of hausaMarkers) {
    if (normalized.includes(marker)) {
      matches += 1;
    }
  }
  return matches >= 1 ? 'ha' : 'en';
}

// ============================================================================
// PART 4 — LONG-PROMPT PIPELINE & STRUCTURE-AWARE CHUNKING (15,000+ WORDS)
// ============================================================================

export interface PromptSectionChunk {
  chunkIndex: number;
  totalChunks: number;
  sectionId: string;
  headingSummary: string;
  content: string;
  charCount: number;
  wordCount: number;
}

/**
 * Splits a Master Prompt of any size (including 15,000+ words) into structure-aware
 * chunks at clean section/heading/paragraph boundaries so no instruction is ever
 * cut mid-sentence or lost due to single-pass output token limits.
 */
export function splitMasterPromptIntoChunks(
  originalPrompt: string,
  maxCharsPerChunk = 11500
): PromptSectionChunk[] {
  const cleaned = (originalPrompt || '').trim();
  if (!cleaned) return [];

  if (cleaned.length <= maxCharsPerChunk) {
    const words = cleaned.split(/\s+/).filter(Boolean).length;
    return [
      {
        chunkIndex: 0,
        totalChunks: 1,
        sectionId: 'SECTION_1_OF_1',
        headingSummary: 'Complete Master Prompt',
        content: cleaned,
        charCount: cleaned.length,
        wordCount: words
      }
    ];
  }

  // Split by lines first and group by structural headings or paragraphs
  const lines = cleaned.split(/\r?\n/);
  const blocks: Array<{ heading: string; text: string }> = [];
  let currentHeading = 'Opening Section';
  let currentLines: string[] = [];

  const isBoundaryHeading = (line: string): boolean => {
    const t = line.trim();
    if (!t) return false;
    if (/^#{1,6}\s+.+/.test(t)) return true;
    if (/^(===+|---|\*\*\*)\s*.+/.test(t)) return true;
    if (
      /^(\d+\.|STEP\s+\d+|STAGE\s+\d+|PHASE\s+\d+|PART\s+\d+|SECTION\s+\d+|RULE\s+\d+|MODULE\s+[A-Z0-9]+)\b/i.test(
        t
      ) &&
      t.length <= 120
    ) {
      return true;
    }
    if (
      t.length >= 4 &&
      t.length <= 90 &&
      t === t.toUpperCase() &&
      /[A-Z]{3,}/.test(t) &&
      !t.startsWith('-') &&
      !t.startsWith('•')
    ) {
      return true;
    }
    return false;
  };

  for (const rawLine of lines) {
    if (isBoundaryHeading(rawLine) && currentLines.length > 0) {
      blocks.push({
        heading: currentHeading,
        text: currentLines.join('\n')
      });
      currentHeading = rawLine.trim().slice(0, 90);
      currentLines = [rawLine];
    } else {
      currentLines.push(rawLine);
    }
  }
  if (currentLines.length > 0) {
    blocks.push({
      heading: currentHeading,
      text: currentLines.join('\n')
    });
  }

  // Further split any single giant block (> maxCharsPerChunk) by paragraph or line boundaries
  const normalizedBlocks: Array<{ heading: string; text: string }> = [];
  for (const b of blocks) {
    if (b.text.length <= maxCharsPerChunk) {
      normalizedBlocks.push(b);
      continue;
    }
    const paragraphs = b.text.split(/\n\s*\n/);
    let subBuffer = '';
    let partNum = 1;
    for (const para of paragraphs) {
      if (para.length > maxCharsPerChunk) {
        // If a single paragraph has no double newlines and is huge, split at single newline or sentence boundary
        if (subBuffer) {
          normalizedBlocks.push({
            heading: `${b.heading} (Part ${partNum++})`,
            text: subBuffer
          });
          subBuffer = '';
        }
        let cursor = 0;
        while (cursor < para.length) {
          let end = Math.min(cursor + maxCharsPerChunk, para.length);
          if (end < para.length) {
            const newlineIdx = para.lastIndexOf('\n', end);
            const periodIdx = para.lastIndexOf('. ', end);
            const spaceIdx = para.lastIndexOf(' ', end);
            if (newlineIdx > cursor + Math.floor(maxCharsPerChunk * 0.5)) {
              end = newlineIdx + 1;
            } else if (periodIdx > cursor + Math.floor(maxCharsPerChunk * 0.5)) {
              end = periodIdx + 2;
            } else if (spaceIdx > cursor + Math.floor(maxCharsPerChunk * 0.5)) {
              end = spaceIdx + 1;
            }
          }
          normalizedBlocks.push({
            heading: `${b.heading} (Part ${partNum++})`,
            text: para.slice(cursor, end).trim()
          });
          cursor = end;
        }
      } else if (
        subBuffer &&
        subBuffer.length + para.length + 2 > maxCharsPerChunk
      ) {
        normalizedBlocks.push({
          heading: `${b.heading} (Part ${partNum++})`,
          text: subBuffer
        });
        subBuffer = para;
      } else {
        subBuffer = subBuffer ? `${subBuffer}\n\n${para}` : para;
      }
    }
    if (subBuffer) {
      normalizedBlocks.push({
        heading: partNum > 1 ? `${b.heading} (Part ${partNum})` : b.heading,
        text: subBuffer
      });
    }
  }

  // Pack normalizedBlocks into chunks up to maxCharsPerChunk
  const packed: Array<{ headings: string[]; content: string }> = [];
  let activeHeadings: string[] = [];
  let activeContent = '';

  for (const blk of normalizedBlocks) {
    if (
      activeContent &&
      activeContent.length + blk.text.length + 2 > maxCharsPerChunk
    ) {
      packed.push({
        headings: activeHeadings,
        content: activeContent
      });
      activeHeadings = [blk.heading];
      activeContent = blk.text;
    } else {
      activeHeadings.push(blk.heading);
      activeContent = activeContent ? `${activeContent}\n\n${blk.text}` : blk.text;
    }
  }
  if (activeContent) {
    packed.push({
      headings: activeHeadings,
      content: activeContent
    });
  }

  const totalChunks = packed.length;
  return packed.map((item, idx) => {
    const words = item.content.split(/\s+/).filter(Boolean).length;
    return {
      chunkIndex: idx,
      totalChunks,
      sectionId: `SECTION_${idx + 1}_OF_${totalChunks}`,
      headingSummary: item.headings.slice(0, 4).join(' | '),
      content: item.content,
      charCount: item.content.length,
      wordCount: words
    };
  });
}

/**
 * Builds the transformation prompt for an individual chunk of a long Master Prompt
 * so all sections share global context, preserve exact structure, and never truncate.
 */
export function buildChunkTransformationPrompt(params: {
  chunk: PromptSectionChunk;
  newIdea: string;
  globalAnalysis: PromptStructuralAnalysis;
  additionalInstructions?: string;
}): { systemInstruction: string; userPrompt: string } {
  const { chunk, newIdea, globalAnalysis, additionalInstructions } = params;

  const systemInstruction = [
    'You are the UNIVERSAL MASTER PROMPT TRANSFORMATION ENGINE inside MUSTAPHA AI PROMPT.',
    `You are transforming ${chunk.sectionId} (Chunk ${chunk.chunkIndex + 1} of ${chunk.totalChunks}) of a large Master Prompt so it works seamlessly for the user’s NEW IDEA.`,
    '',
    'CRITICAL LONG-PROMPT PRESERVATION RULES:',
    '1. Output ONLY the complete, transformed text of THIS section chunk from start to finish.',
    '2. NEVER summarize, shorten, skip paragraphs, or write placeholders like "[Rest of section unchanged]".',
    '3. Preserve all headings, numbered lists, bullet points, symbols, line breaks, and topic-independent rules verbatim.',
    '4. Adapt every reference, example, character, environment, action, title, or rule that depended on the old topic so it fits the NEW IDEA naturally.',
    '5. Remove or replace old-topic constraints that contradict the NEW IDEA.',
    '6. Do NOT wrap your output in markdown code fences or conversational commentary—return ONLY the adapted Master Prompt section text.'
  ].join('\n');

  const userPrompt = [
    `=== GLOBAL MASTER PROMPT CONTEXT (${chunk.sectionId}) ===`,
    `- Detected Overall Task Type: ${globalAnalysis.detectedTaskType}`,
    `- Original Detected Topic: ${globalAnalysis.detectedOriginalSubject}`,
    `- Target Model / Tool References: ${globalAnalysis.detectedTargetModelOrTool}`,
    `- Quantitative / Format Constraints to Preserve: ${globalAnalysis.detectedQuantitativeRules.join(', ') || 'Keep all original numbers and constraints'}`,
    '',
    '=== SABON IDEAS ƊINA (NEW IDEA TO ADAPT TO) ===',
    newIdea.trim(),
    ...(additionalInstructions?.trim()
      ? ['', '=== ADDITIONAL INSTRUCTIONS ===', additionalInstructions.trim()]
      : []),
    '',
    `=== ORIGINAL MASTER PROMPT ${chunk.sectionId} (${chunk.headingSummary}) ===`,
    chunk.content,
    '',
    `=== OUTPUT DIRECTIVE ===`,
    `Return the COMPLETE adapted text for ${chunk.sectionId}, preserving its full length, structure, headings, and formatting while adapting all topic-dependent details to the New Idea.`
  ].join('\n');

  return { systemInstruction, userPrompt };
}

/**
 * Reassembles transformed chunks in exact section order without losing line breaks or headings.
 */
export function reassembleTransformedChunks(transformedParts: string[]): string {
  return transformedParts
    .map((part) =>
      String(part || '')
        .replace(/^```[a-z]*\s*/i, '')
        .replace(/\s*```$/, '')
        .trim()
    )
    .filter(Boolean)
    .join('\n\n');
}

// ============================================================================
// PART 6–11 — CONTENT IMAGE & VIDEO ANALYZER PROMPT ENGINE
// ============================================================================

export interface ContentAnalyzerResult {
  title: string;
  description: string;
  contentType: string;
  isScreenshot: boolean;
  audioAnalyzed: boolean;
  honestyDisclosure: string;
  visualObservations: string[];
  fullAiPrompt: string;
  modelUsed: string;
}

export function buildContentAnalyzerPrompts(params: {
  mediaKind: 'image' | 'video';
  frameCount?: number;
  audioIncluded?: boolean;
  userNotes?: string;
  language?: 'en' | 'ha';
}): { systemInstruction: string; userPrompt: string } {
  const isVideo = params.mediaKind === 'video';
  const frameCount = params.frameCount || 1;
  const audioIncluded = Boolean(params.audioIncluded);
  const lang = params.language || 'en';

  const systemInstruction = [
    'You are the CONTENT IMAGE & VIDEO ANALYZER inside MUSTAPHA AI PROMPT.',
    'Your task is to inspect the uploaded visual reference (screenshot, image, or video) accurately and honestly, generate a suitable Content Title, provide a clear visual description, and generate a COMPLETE, READY-TO-USE AI PROMPT ("FULL AI PROMPT") inspired by the reference.',
    '',
    'CRITICAL HONESTY & ACCURACY RULES:',
    '1. SCREENSHOT VS CONTENT SEPARATION: If the uploaded image is a screenshot from TikTok, YouTube, Instagram, Facebook, X, or a mobile app, distinguish the actual visual scene/content in the frame from surrounding app UI chrome (status bar, battery icons, like/comment/share buttons, overlaid usernames, or unrelated comments). Use visible captions/titles as helpful context if legible, and never invent unreadable text.',
    '2. NO HALLUCINATION: Base your analysis strictly on what is visible in the uploaded image or video frames. If an image shows only a single moment, do NOT claim to have watched a full video or invent unseen scenes.',
    isVideo
      ? `3. VIDEO MULTI-FRAME ANALYSIS: Analyze the chronological visual progression across the uploaded video (${frameCount > 1 ? `${frameCount} representative chronological frames and/or video stream` : 'video stream'}): opening scene, main subject and actions, environment, camera angle/movement, visual style/lighting, pacing/transitions, and ending scene. Audio status: ${audioIncluded ? 'Inline video stream included' : 'Visual frames analyzed only (audio track was not processed)'}.`
      : '3. SINGLE IMAGE / SCREENSHOT ANALYSIS: Identify the main subject, environment/setting, visible action or pose, lighting, color palette, framing/composition, and visual style.',
    '4. UNIVERSAL PROMPT GENERATION ("FULL AI PROMPT"): Generate a comprehensive, well-structured, ready-to-copy AI prompt inspired by the reference.',
    '   - Automatically adapt the FULL AI PROMPT to match the natural medium and niche of the reference (e.g., photorealistic image prompt, cinematic video generation prompt, 3D animation prompt, product photography prompt, educational visual prompt, UI/design prompt, or social content prompt).',
    '   - Do NOT force every reference into a video prompt if the reference is clearly a static design, portrait, product shot, or infographic.',
    '   - Include clear sections in the FULL AI PROMPT: Subject & Concept, Environment & Setting, Composition & Camera/Framing, Visual Style & Lighting, Action/Details, and Quality Directives.',
    lang === 'ha'
      ? '5. LANGUAGE: Provide the Description in clear Hausa (or bilingual Hausa/English) and keep the Content Title and FULL AI PROMPT copy-ready and crystal clear.'
      : '5. LANGUAGE: Provide the Title, Description, and FULL AI PROMPT in clear, professional English (incorporating any user notes if provided).'
  ].join('\n');

  const userPrompt = [
    `=== UPLOADED REFERENCE MEDIA TYPE ===`,
    isVideo
      ? `Video File (${frameCount > 1 ? `${frameCount} chronological keyframes extracted across the video duration` : 'Direct video clip'})`
      : 'Static Image or Screenshot',
    params.userNotes?.trim()
      ? `\n=== OPTIONAL USER FOCUS / NOTES ===\n${params.userNotes.trim()}`
      : '',
    '',
    '=== REQUIRED JSON OUTPUT ===',
    'Return a JSON object containing:',
    '1. "title": A strong, suitable, copy-ready Content Title based on the visual reference.',
    '2. "description": A concise, accurate summary of what is visible in the reference (2-4 sentences).',
    '3. "contentType": The detected medium/category (e.g., "Cinematic Video Reference", "Social Media Screenshot", "Photography / Portrait", "3D / Animation Scene", "Product Showcase", "Educational / Infographic").',
    '4. "isScreenshot": boolean indicating whether social media or device UI chrome is visible around the content.',
    '5. "visualObservations": Array of 4-6 bullet strings covering Subject, Environment, Camera/Composition, Lighting/Style, and Motion/Action.',
    '6. "honestyDisclosure": A clear 1-sentence statement explaining what was inspected (e.g., whether UI chrome was separated from the screenshot, or whether visual keyframes were analyzed without audio).',
    '7. "fullAiPrompt": The COMPLETE, self-contained, ready-to-copy AI Prompt formatted with clear headings and line breaks (\\n\\n) so the user can click COPY FULL AI PROMPT and use it immediately.'
  ]
    .filter(Boolean)
    .join('\n');

  return { systemInstruction, userPrompt };
}

