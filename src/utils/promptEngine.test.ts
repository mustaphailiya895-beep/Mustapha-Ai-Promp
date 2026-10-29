import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compileMasterPrompt,
  verifyAndEnforceCharCount,
  sanitizeStringField,
  sanitizeProviderError,
  buildChatContextWindow,
  detectLikelyLanguage,
  createInternalResponse,
  analyzeMasterPromptStructure,
  buildUniversalTransformationPrompts,
  computeTruthfulComparison,
  validateTransformedMasterPrompt,
  getTransformationModeDirectives,
  splitMasterPromptIntoChunks,
  buildChunkTransformationPrompt,
  reassembleTransformedChunks,
  buildContentAnalyzerPrompts
} from './promptEngine';
import { countWordsAndCharsFast } from './draftStorage';
import { validateModelCapability } from './modelRegistry';

test('compileMasterPrompt combines Field A, Field B, and Field C settings', () => {
  const result = compileMasterPrompt({
    masterPrompt: 'Write a 3-shot cinematic trailer script about [TOPIC].',
    newIdea: 'A solar-powered airship crossing the Sahara',
    outputLanguage: 'English',
    outputType: 'Production Script',
    targetPlatform: 'Veo',
    desiredLength: 'Short',
    characterLimit: 240,
    exactCharCount: true,
    additionalInstructions: 'Include lens focal lengths.'
  });

  assert.equal(result.targetCharLimit, 240);
  assert.equal(result.requireExactCount, true);
  assert.ok(result.userPrompt.includes('A solar-powered airship crossing the Sahara'));
  assert.ok(result.userPrompt.includes('EXACTLY 240 characters'));
  assert.ok(result.userPrompt.includes('Include lens focal lengths.'));
});

test('compileMasterPrompt throws when Master Prompt or New Idea is missing', () => {
  assert.throws(() => {
    compileMasterPrompt({ masterPrompt: '', newIdea: 'Valid idea' });
  }, /Field A/);

  assert.throws(() => {
    compileMasterPrompt({ masterPrompt: 'Valid master prompt', newIdea: '   ' });
  }, /Field B/);
});

test('verifyAndEnforceCharCount enforces exact character counts accurately', () => {
  const shortSample = 'Cinematic wide shot of a desert observatory at twilight.';
  const exactRes = verifyAndEnforceCharCount(shortSample, 100, true);
  assert.equal(exactRes.charCount, 100);
  assert.equal(exactRes.text.length, 100);
  assert.equal(exactRes.verifiedExact, true);

  const longSample = 'A'.repeat(150);
  const trimmedRes = verifyAndEnforceCharCount(longSample, 100, true);
  assert.equal(trimmedRes.charCount, 100);
  assert.equal(trimmedRes.verifiedExact, true);
});

test('validateModelCapability verifies model capabilities and suggests valid fallback', () => {
  const validChat = validateModelCapability('gemini-3.1-flash-lite', 'chat');
  assert.equal(validChat.valid, true);

  const invalidImage = validateModelCapability('gemini-3.1-flash-lite', 'image_generation');
  assert.equal(invalidImage.valid, false);
  assert.equal(invalidImage.suggestedModelId, 'gemini-3.1-flash-lite-image');

  const unconfiguredExternal = validateModelCapability('unknown-model-id', 'chat');
  assert.equal(unconfiguredExternal.valid, false);
  assert.equal(unconfiguredExternal.suggestedModelId, 'gemini-3.1-flash-lite');
});

test('sanitizeStringField truncates strings to blueprint maxLength', () => {
  const input = 'x'.repeat(300);
  assert.equal(sanitizeStringField(input, 150).length, 150);
  assert.equal(sanitizeStringField('   ', 100, 'Untitled'), 'Untitled');
});

test('sanitizeProviderError strips raw JSON error payloads and translates to English or Hausa', () => {
  const rawGemini429 = new Error(
    '{"error":{"message":"{\\n  \\"error\\": {\\n    \\"code\\": 429,\\n    \\"message\\": \\"You exceeded your current quota\\",\\n    \\"status\\": \\"RESOURCE_EXHAUSTED\\"\\n  }\\n}","code":429}}'
  );

  const cleanEn = sanitizeProviderError(rawGemini429, 'en', 'chat');
  assert.ok(!cleanEn.includes('{"error"'));
  assert.ok(cleanEn.includes('quota') || cleanEn.includes('rate'));

  const cleanHa = sanitizeProviderError(rawGemini429, 'ha', 'chat');
  assert.ok(!cleanHa.includes('{"error"'));
  assert.ok(cleanHa.includes('bukatun AI'));

  const genericJsonErr = new Error('{"error":{"code":500,"details":[{"stack":"secret"}]}}');
  const cleanGeneric = sanitizeProviderError(genericJsonErr, 'en', 'chat');
  assert.ok(!cleanGeneric.includes('{'));
  assert.ok(!cleanGeneric.includes('secret'));
});

test('buildChatContextWindow removes empty or raw-JSON-corrupted messages and bounds length', () => {
  const dirtyHistory = [
    { role: 'user', content: 'Sannu! Ina kwana?' },
    { role: 'assistant', content: '' },
    { role: 'assistant', content: '{"error":{"code":429}}' },
    { role: 'user', content: 'Menene AI?' },
    { role: 'assistant', content: 'AI yana nufin Artificial Intelligence.' }
  ];

  const cleaned = buildChatContextWindow(dirtyHistory, 10);
  assert.equal(cleaned.length, 3);
  assert.equal(cleaned[0].content, 'Sannu! Ina kwana?');
  assert.equal(cleaned[1].content, 'Menene AI?');
  assert.equal(cleaned[2].content, 'AI yana nufin Artificial Intelligence.');
});

test('detectLikelyLanguage identifies Hausa and English inputs accurately', () => {
  assert.equal(detectLikelyLanguage('Sannu, don Allah bayyana min menene wannan hoto'), 'ha');
  assert.equal(detectLikelyLanguage('Ina kwana, yaya aiki?'), 'ha');
  assert.equal(detectLikelyLanguage('Explain how photosynthesis works in plants'), 'en');
});

test('createInternalResponse builds consistent internal response objects', () => {
  const okRes = createInternalResponse(true, { text: 'AI response' }, null);
  assert.equal(okRes.success, true);
  assert.deepEqual(okRes.data, { text: 'AI response' });
  assert.equal(okRes.error, null);
});

// ============================================================================
// UNIVERSAL MASTER PROMPT TRANSFORMATION ENGINE UNIT TESTS
// ============================================================================

test('analyzeMasterPromptStructure extracts multi-stage workflows, headings, quantitative rules, and negative rules dynamically', () => {
  const sampleVideoMasterPrompt = [
    'ULTRA MASTER PROMPT — USA VIRAL DOLPHIN RIDING & ADVENTURE VIDEO SYSTEM | SEEDANCE 2.5',
    'STAGE 1: GENERATE 5 VIRAL CONCEPT IDEAS',
    'Wait for user selection before moving to Stage 2.',
    'STAGE 2: FULL PRODUCTION PACKAGE',
    '- Camera: iPhone 18 Pro Max, vertical 9:16 format, 15-second duration.',
    '- Output 5 titles, 1 caption, and 10 hashtags.',
    '- Video prompt must be exactly 1495 characters.',
    '- DO NOT include cartoon filters or slow-motion glitches.',
    '- NEVER use artificial studio backgrounds.'
  ].join('\n');

  const analysis = analyzeMasterPromptStructure(sampleVideoMasterPrompt);
  assert.equal(analysis.detectedTaskType, 'Video / Cinematic Generation System');
  assert.equal(analysis.isMultiStage, true);
  assert.ok(analysis.detectedStages.length >= 2);
  assert.ok(analysis.detectedTargetModelOrTool.includes('SEEDANCE 2.5'));
  assert.ok(analysis.detectedTargetModelOrTool.includes('iPhone 18 Pro Max'));
  assert.ok(analysis.detectedQuantitativeRules.some((r) => r.includes('1495')));
  assert.ok(analysis.detectedQuantitativeRules.some((r) => r.includes('9:16')));
  assert.ok(analysis.detectedQuantitativeRules.some((r) => r.includes('15-second')));
  assert.ok(analysis.detectedNegativeRules.length >= 2);
});

test('analyzeMasterPromptStructure does not force video or 1495-char rules onto software or marketing prompts', () => {
  const codingPrompt = [
    '# FULL-STACK WEB APPLICATION ARCHITECT PROMPT',
    '1. SYSTEM ARCHITECTURE',
    'Design a responsive restaurant table booking website using React, TypeScript, and PostgreSQL.',
    '2. API ENDPOINTS',
    'Provide 4 REST endpoints with validation and authentication.',
    'NEVER expose database credentials in client bundles.'
  ].join('\n');

  const analysis = analyzeMasterPromptStructure(codingPrompt);
  assert.equal(analysis.detectedTaskType, 'Software / Technical Engineering Prompt');
  assert.equal(analysis.isMultiStage, false);
  assert.ok(!analysis.detectedQuantitativeRules.some((r) => r.includes('1495')));
  assert.ok(!analysis.detectedQuantitativeRules.some((r) => r.includes('9:16')));
  assert.equal(analysis.detectedNegativeRules.length, 1);
});

test('buildUniversalTransformationPrompts supports all 6 modes and validates required inputs', () => {
  assert.throws(() => {
    buildUniversalTransformationPrompts({
      originalMasterPrompt: '   ',
      newIdea: 'Water Challenge'
    });
  }, /Original Master Prompt/);

  assert.throws(() => {
    buildUniversalTransformationPrompts({
      originalMasterPrompt: 'Valid Master Prompt',
      newIdea: ''
    });
  }, /New Idea/);

  const modes = ['smart', 'minimal', 'deep', 'structure', 'improve', 'custom'] as const;
  for (const mode of modes) {
    const directives = getTransformationModeDirectives(mode);
    assert.ok(directives.title.length > 5);
    assert.ok(directives.instructions.length > 20);
  }

  const built = buildUniversalTransformationPrompts({
    originalMasterPrompt: 'STAGE 1: Create 3 lesson plans for High School Chemistry.\nSTAGE 2: Create a 10-question quiz.',
    newIdea: 'Introduction to Astrophysics & Exoplanets',
    additionalInstructions: 'Keep the 10-question quiz format and add 1 hands-on telescope activity.',
    mode: 'structure',
    settings: {
      outputLanguage: 'keep_original',
      preserveExactHeadings: true
    }
  });

  assert.equal(built.mode, 'structure');
  assert.ok(built.systemInstruction.includes('STRUCTURE PRESERVATION MODE'));
  assert.ok(built.userPrompt.includes('Introduction to Astrophysics & Exoplanets'));
  assert.ok(built.userPrompt.includes('Keep the 10-question quiz format'));
});

test('computeTruthfulComparison truthfully distinguishes unchanged, modified, added, and removed blocks', () => {
  const original = [
    '# SECTION 1: UNIVERSAL WORKFLOW',
    'Follow these steps carefully and wait for user confirmation.',
    '# SECTION 2: TOPIC RULES',
    'Focus on luxury mechanical Swiss watches with macro studio lighting.',
    '# SECTION 3: OLD NICHE BONUS',
    'Include watchmaker loupe reflections.'
  ].join('\n');

  const adapted = [
    '# SECTION 1: UNIVERSAL WORKFLOW',
    'Follow these steps carefully and wait for user confirmation.',
    '# SECTION 2: TOPIC RULES',
    'Focus on dynamic anime character poster design with cel-shaded lighting.'
  ].join('\n');

  const blocks = computeTruthfulComparison(original, adapted);
  assert.equal(blocks.length, 3);
  assert.equal(blocks[0].status, 'unchanged');
  assert.equal(blocks[1].status, 'modified');
  assert.equal(blocks[2].status, 'removed');
});

test('validateTransformedMasterPrompt verifies structure, sections, topic consistency, contradictions, and quantitative rules', () => {
  const original = [
    'ULTRA MASTER PROMPT — DOLPHIN RIDING VIDEO SYSTEM | SEEDANCE 2.5',
    'STAGE 1: 5 VIRAL IDEAS',
    'STAGE 2: PRODUCTION',
    'Format: vertical 9:16, 15-second clip, iPhone 18 Pro Max.',
    'Generate 5 titles and an exact 1495 characters video prompt.',
    'DO NOT use cartoon effects.'
  ].join('\n');

  const adaptedGood = [
    'ULTRA MASTER PROMPT — WATER CHALLENGE / WIPEOUT VIDEO SYSTEM | SEEDANCE 2.5',
    'STAGE 1: 5 VIRAL IDEAS',
    'Generate 5 high-energy water obstacle course and wipeout challenge concepts.',
    'STAGE 2: PRODUCTION',
    'Format: vertical 9:16, 15-second clip, iPhone 18 Pro Max.',
    'Generate 5 titles and an exact 1495 characters video prompt capturing splashes and obstacle wipeouts.',
    'DO NOT use cartoon effects.'
  ].join('\n');

  const reportGood = validateTransformedMasterPrompt(
    original,
    'WATER CHALLENGE / WIPEOUT',
    adaptedGood
  );
  assert.equal(reportGood.overallPassed, true);
  assert.equal(reportGood.checks.length, 5);
  assert.ok(reportGood.checks.every((c) => c.passed));

  // Verify placeholder or missing quantitative rule triggers warning
  const adaptedBad = 'Short summary: [Insert rest of prompt here] for water challenge.';
  const reportBad = validateTransformedMasterPrompt(
    original,
    'WATER CHALLENGE / WIPEOUT',
    adaptedBad
  );
  assert.equal(reportBad.overallPassed, false);
  const structCheck = reportBad.checks.find((c) => c.id === 'structure');
  const quantCheck = reportBad.checks.find((c) => c.id === 'quantitative_constraints');
  assert.equal(structCheck?.passed, false);
  assert.equal(quantCheck?.passed, false);
});

test('splitMasterPromptIntoChunks & reassembleTransformedChunks handle 15,000+ word prompts without truncation', () => {
  // Build a structured 15,500+ word Master Prompt with 15 sections (1,050 words each)
  const sections: string[] = [];
  for (let s = 1; s <= 15; s++) {
    const paragraphWords = Array.from(
      { length: 1050 },
      (_, idx) => `word_${s}_${idx + 1}`
    ).join(' ');
    sections.push(`# SECTION ${s}: ARCHITECTURAL MODULE ${s}\n${paragraphWords}`);
  }
  const giantPrompt = sections.join('\n\n');

  const stats = countWordsAndCharsFast(giantPrompt);
  assert.ok(stats.words >= 15500, `Expected >= 15,500 words, got ${stats.words}`);

  const chunks = splitMasterPromptIntoChunks(giantPrompt, 11500);
  assert.ok(chunks.length >= 6, `Expected multiple structure-aware chunks, got ${chunks.length}`);

  const analysis = analyzeMasterPromptStructure(giantPrompt);
  const firstChunkPrompt = buildChunkTransformationPrompt({
    chunk: chunks[0],
    newIdea: 'Autonomous Agricultural Drone Fleet Management System',
    globalAnalysis: analysis
  });
  assert.ok(firstChunkPrompt.userPrompt.includes('Autonomous Agricultural Drone Fleet Management System'));
  assert.ok(firstChunkPrompt.systemInstruction.includes('SECTION_1_OF_'));

  const reassembled = reassembleTransformedChunks(chunks.map((c) => c.content));
  const reassembledStats = countWordsAndCharsFast(reassembled);
  assert.equal(
    reassembledStats.words,
    stats.words,
    'Reassembled 15,500+ word Master Prompt must preserve every single word without silent truncation'
  );
  assert.ok(reassembled.includes('# SECTION 1: ARCHITECTURAL MODULE 1'));
  assert.ok(reassembled.includes('# SECTION 15: ARCHITECTURAL MODULE 15'));
});

test('buildContentAnalyzerPrompts builds honest screenshot/image and multi-frame video analyzer prompts', () => {
  const imgPrompts = buildContentAnalyzerPrompts({
    mediaKind: 'image',
    language: 'en',
    userNotes: 'Focus on luxury product lighting'
  });
  assert.ok(imgPrompts.systemInstruction.includes('SCREENSHOT VS CONTENT SEPARATION'));
  assert.ok(imgPrompts.userPrompt.includes('Focus on luxury product lighting'));
  assert.ok(imgPrompts.userPrompt.includes('fullAiPrompt'));

  const videoPrompts = buildContentAnalyzerPrompts({
    mediaKind: 'video',
    frameCount: 6,
    audioIncluded: false,
    language: 'ha'
  });
  assert.ok(videoPrompts.systemInstruction.includes('6 representative chronological frames'));
  assert.ok(videoPrompts.systemInstruction.includes('audio track was not processed'));
});

