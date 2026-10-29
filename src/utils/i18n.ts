export type AppLanguage = 'en' | 'ha';

export interface TranslationStrings {
  appName: string;
  tagline: string;
  nav: {
    chat: string;
    imageGen: string;
    videoGen: string;
    imageAnalyzer: string;
    studio: string;
    voice: string;
    savedPrompts: string;
    history: string;
    settings: string;
    newChat: string;
    signOut: string;
  };
  topBar: {
    activeModel: string;
    language: string;
    darkTheme: string;
    lightTheme: string;
  };
  auth: {
    welcomeTitle: string;
    welcomeSubtitle: string;
    continueWithGoogle: string;
    launchWorkspace: string;
    signingIn: string;
    protectedBy: string;
  };
  chat: {
    welcomeBack: string;
    whatToDo: string;
    subtitle: string;
    placeholder: string;
    send: string;
    stop: string;
    generating: string;
    retry: string;
    copy: string;
    copied: string;
    readAloud: string;
    stopAudio: string;
    edit: string;
    attachFile: string;
    highThinking: string;
    googleSearch: string;
    emptyChatHint: string;
    errorTitle: string;
    languageHint: string;
  };
  imageGen: {
    title: string;
    subtitle: string;
    promptLabel: string;
    promptPlaceholder: string;
    modelLabel: string;
    aspectRatioLabel: string;
    sizeLabel: string;
    styleLabel: string;
    generateBtn: string;
    generatingBtn: string;
    downloadBtn: string;
    regenerateBtn: string;
    copyPromptBtn: string;
    savePromptBtn: string;
    emptyCanvas: string;
    hausaTranslateHint: string;
  };
  videoGen: {
    title: string;
    subtitle: string;
    promptLabel: string;
    promptPlaceholder: string;
    aspectRatioLabel: string;
    durationLabel: string;
    resolutionLabel: string;
    generateBtn: string;
    generatingBtn: string;
    statusQueued: string;
    statusProcessing: string;
    statusCompleted: string;
    statusFailed: string;
    downloadVideoBtn: string;
    emptyVideo: string;
  };
  analyzer: {
    title: string;
    subtitle: string;
    uploadLabel: string;
    uploadHint: string;
    loadSampleBtn: string;
    removeImageBtn: string;
    questionLabel: string;
    questionPlaceholder: string;
    analyzeBtn: string;
    analyzingBtn: string;
    resultTitle: string;
    emptyResult: string;
    useInStudioBtn: string;
  };
  studio: {
    title: string;
    subtitle: string;
    step1Title: string;
    promptNameLabel: string;
    promptNamePlaceholder: string;
    masterPromptLabel: string;
    masterPromptPlaceholder: string;
    saveMasterPromptBtn: string;
    updateMasterPromptBtn: string;
    duplicatePromptBtn: string;
    deletePromptBtn: string;
    useMasterPromptBtn: string;
    step2Title: string;
    newIdeaLabel: string;
    newIdeaPlaceholder: string;
    extraInstructionsLabel: string;
    step3Title: string;
    combinedPreviewLabel: string;
    copyCombinedBtn: string;
    step4Title: string;
    outputTypeLabel: string;
    outputLanguageLabel: string;
    generateResultBtn: string;
    generatingResultBtn: string;
    step5Title: string;
    copyResultBtn: string;
    saveResultToHistoryBtn: string;
    editAndRegenerateBtn: string;
    promptOnlyBadge: string;
  };
  voice: {
    title: string;
    subtitle: string;
    startRecording: string;
    stopRecording: string;
    recordingActive: string;
    reviewTranscriptLabel: string;
    reviewTranscriptPlaceholder: string;
    sendVoiceBtn: string;
    speakOnlyBtn: string;
    stopPlaybackBtn: string;
    hausaNotice: string;
  };
  savedPrompts: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    useBtn: string;
    copyBtn: string;
    deleteBtn: string;
    emptyState: string;
  };
  history: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    openBtn: string;
    renameBtn: string;
    deleteBtn: string;
    confirmDeleteTitle: string;
    confirmDeleteMessage: string;
    confirmDeleteBtn: string;
    cancelBtn: string;
    emptyState: string;
  };
  settings: {
    title: string;
    subtitle: string;
    profileSection: string;
    displayNameLabel: string;
    languageSection: string;
    languageDescription: string;
    customInstructionsLabel: string;
    saveSettingsBtn: string;
    savedToast: string;
    providerStatusTitle: string;
  };
}

export const TRANSLATIONS: Record<AppLanguage, TranslationStrings> = {
  en: {
    appName: 'MUSTAPHA AI STUDIO',
    tagline: 'Mustapha Iliya Personal AI Assistant & Master Prompt Studio',
    nav: {
      chat: 'Chat',
      imageGen: 'Image Generator',
      videoGen: 'Video Generator',
      imageAnalyzer: 'Content Image & Video Analyzer',
      studio: 'Universal Master Prompt Studio',
      voice: 'Voice Assistant',
      savedPrompts: 'Saved Prompts',
      history: 'Chat History',
      settings: 'Settings',
      newChat: 'New Chat',
      signOut: 'Log out'
    },
    topBar: {
      activeModel: 'Model:',
      language: 'Language:',
      darkTheme: 'Dark',
      lightTheme: 'Light'
    },
    auth: {
      welcomeTitle: 'Save your best AI instructions once. Reuse them in seconds.',
      welcomeSubtitle:
        'MUSTAPHA AI STUDIO combines reliable English & Hausa AI chat, Universal Master Prompt Studio, image & video analysis, voice interaction, and media generation in one sleek workspace.',
      continueWithGoogle: 'Continue with Google',
      launchWorkspace: 'Open Mustapha AI Studio',
      signingIn: 'Signing in...',
      protectedBy: 'Protected by Firebase Auth & Per-User Security Rules'
    },
    chat: {
      welcomeBack: 'Hello, Mustapha',
      whatToDo: 'Hello, Mustapha 👋',
      subtitle: 'Your personal AI assistant is here to help you.',
      placeholder: 'Ask Mustapha AI',
      send: 'Send',
      stop: 'Stop',
      generating: 'Thinking...',
      retry: 'Retry',
      copy: 'Copy',
      copied: 'Copied',
      readAloud: 'Listen',
      stopAudio: 'Stop Audio',
      edit: 'Edit',
      attachFile: 'Attach Image',
      highThinking: 'Deep Reasoning',
      googleSearch: 'Web Search',
      emptyChatHint: 'Ask Mustapha AI anything in English or Hausa.',
      errorTitle: 'Could not complete request',
      languageHint: 'Supports English & Hausa — Mustapha AI replies in the language you use.'
    },
    imageGen: {
      title: 'AI Image Generator',
      subtitle: 'Generate images from English or Hausa descriptions with aspect ratio and resolution controls.',
      promptLabel: 'Image Description (English or Hausa)',
      promptPlaceholder: 'Generate a clear, realistic photograph of a beautiful modern house with a garden during daylight...',
      modelLabel: 'Image Generation Model',
      aspectRatioLabel: 'Aspect Ratio',
      sizeLabel: 'Resolution Quality',
      styleLabel: 'Visual Style',
      generateBtn: 'Generate Image',
      generatingBtn: 'Generating Image...',
      downloadBtn: 'Download Image',
      regenerateBtn: 'Regenerate',
      copyPromptBtn: 'Copy Prompt',
      savePromptBtn: 'Save to Master Prompts',
      emptyCanvas: 'Enter a prompt in English or Hausa and click Generate Image.',
      hausaTranslateHint: 'Hausa prompts are automatically enriched while preserving every visual detail.'
    },
    videoGen: {
      title: 'AI Video Generator',
      subtitle: 'Generate or animate videos from English or Hausa scene descriptions using Gemini Omni 1.1 Flash.',
      promptLabel: 'Video Scene, Subject & Camera Motion (English or Hausa)',
      promptPlaceholder: 'Describe the scene, subject movement, camera motion, lighting, and visual style...',
      aspectRatioLabel: 'Aspect Ratio',
      durationLabel: 'Duration',
      resolutionLabel: 'Resolution',
      generateBtn: 'Generate Video',
      generatingBtn: 'Processing Video Job...',
      statusQueued: 'Queued — Preparing video generation job...',
      statusProcessing: 'Processing — Rendering video frames...',
      statusCompleted: 'Completed — Video ready for playback and download',
      statusFailed: 'Video generation unavailable on current API tier',
      downloadVideoBtn: 'Download Video',
      emptyVideo: 'Configure your scene prompt, aspect ratio, and duration, then click Generate Video.'
    },
    analyzer: {
      title: 'Image Analyzer',
      subtitle: 'Upload an image and ask questions about it in English or Hausa using a real vision-capable model.',
      uploadLabel: '1. Upload Image to Inspect',
      uploadHint: 'Supports PNG, JPEG, WEBP, GIF up to 10MB',
      loadSampleBtn: 'Load Sample Image',
      removeImageBtn: 'Remove Image',
      questionLabel: '2. Ask a Question About This Image (English or Hausa)',
      questionPlaceholder: 'Ask what is in this image, read visible text, or request a prompt in English or Hausa...',
      analyzeBtn: 'Analyze Image',
      analyzingBtn: 'Analyzing Image...',
      resultTitle: 'Vision Analysis Result',
      emptyResult: 'Upload an image (or click Load Sample Image) and click Analyze Image.',
      useInStudioBtn: 'Use in Master Prompt Studio'
    },
    studio: {
      title: 'Master Prompt Studio',
      subtitle: 'Save your detailed Master Prompt once, enter only a new idea in English or Hausa, and generate your result.',
      step1Title: 'STEP 1 — CREATE OR SELECT MASTER PROMPT',
      promptNameLabel: 'Master Prompt Name',
      promptNamePlaceholder: 'e.g. Cinematic Video Director Blueprint',
      masterPromptLabel: 'Full Master Prompt Instructions',
      masterPromptPlaceholder: 'Paste your detailed reusable rules, formatting structure, and constraints here...',
      saveMasterPromptBtn: 'Save New Master Prompt',
      updateMasterPromptBtn: 'Update Saved Prompt',
      duplicatePromptBtn: 'Duplicate',
      deletePromptBtn: 'Delete',
      useMasterPromptBtn: 'Use Master Prompt',
      step2Title: 'STEP 2 — ENTER A NEW IDEA (ENGLISH OR HAUSA)',
      newIdeaLabel: 'New Idea, Topic, or Task',
      newIdeaPlaceholder: 'Enter your new idea in English or Hausa...',
      extraInstructionsLabel: 'Optional Additional Instructions',
      step3Title: 'STEP 3 — COMBINED PROMPT PREVIEW',
      combinedPreviewLabel: 'Combined Master Prompt + New Idea',
      copyCombinedBtn: 'Copy Combined Prompt',
      step4Title: 'STEP 4 — CHOOSE OUTPUT TYPE & GENERATE',
      outputTypeLabel: 'Output Type',
      outputLanguageLabel: 'Output Language',
      generateResultBtn: 'GENERATE MY RESULT',
      generatingResultBtn: 'GENERATING RESULT...',
      step5Title: 'STEP 5 — GENERATED RESULT & SAVING',
      copyResultBtn: 'Copy Result',
      saveResultToHistoryBtn: 'Save Result to History',
      editAndRegenerateBtn: 'Edit & Regenerate',
      promptOnlyBadge: 'Generated Prompt Output (Text / Blueprint)'
    },
    voice: {
      title: 'Voice Assistant',
      subtitle: 'Record voice input, review recognized text before sending, and listen to AI responses read aloud.',
      startRecording: 'Start Microphone Recording',
      stopRecording: 'Stop Recording & Review Text',
      recordingActive: 'Recording active... Speak clearly now',
      reviewTranscriptLabel: 'Review & Edit Recognized Text Before Sending (English or Hausa)',
      reviewTranscriptPlaceholder: 'Recognized speech appears here so you can review or edit it before sending, or type directly...',
      sendVoiceBtn: 'Send to AI & Read Reply Aloud',
      speakOnlyBtn: 'Read Text Aloud (TTS)',
      stopPlaybackBtn: 'Stop Playback',
      hausaNotice: 'Note: Speech recognition accuracy for Hausa depends on microphone clarity and browser audio support. You can always review and edit the recognized text before sending.'
    },
    savedPrompts: {
      title: 'Saved Prompts',
      subtitle: 'Search, copy, edit, or load your private saved Master Prompts.',
      searchPlaceholder: 'Search saved prompts by name, category, or content...',
      useBtn: 'Use Master Prompt',
      copyBtn: 'Copy Prompt',
      deleteBtn: 'Delete',
      emptyState: 'No saved prompts match your search.'
    },
    history: {
      title: 'Chat History',
      subtitle: 'Reopen previous conversations, rename chats, or start a fresh conversation.',
      searchPlaceholder: 'Search conversations...',
      openBtn: 'Open Chat',
      renameBtn: 'Rename',
      deleteBtn: 'Delete',
      confirmDeleteTitle: 'Delete Conversation?',
      confirmDeleteMessage: 'Are you sure you want to permanently delete this conversation? This action cannot be undone.',
      confirmDeleteBtn: 'Yes, Delete Conversation',
      cancelBtn: 'Cancel',
      emptyState: 'No saved conversations yet.'
    },
    settings: {
      title: 'Account and Settings',
      subtitle: 'Manage your Google account, interface language (English / Hausa), theme, and AI provider status.',
      profileSection: 'User Account & Profile',
      displayNameLabel: 'Display Name',
      languageSection: 'Interface & Assistant Language (English / Hausa)',
      languageDescription: 'Choose the language for buttons, navigation, and default AI responses.',
      customInstructionsLabel: 'Default Assistant Instructions',
      saveSettingsBtn: 'Save Preferences',
      savedToast: 'Preferences saved successfully.',
      providerStatusTitle: 'AI Models & Provider Configuration Status'
    }
  },
  ha: {
    appName: 'MUSTAPHA AI STUDIO',
    tagline: 'Mataimakin AI na Mustapha Iliya (Hausa da Turanci) & Master Prompt Studio',
    nav: {
      chat: 'Chat',
      imageGen: 'Image Generator',
      videoGen: 'Video Generator',
      imageAnalyzer: 'Content Image & Video Analyzer',
      studio: 'Universal Master Prompt Studio',
      voice: 'Mataimakin Murya',
      savedPrompts: 'Saved Prompts',
      history: 'Chat History',
      settings: 'Saituna (Settings)',
      newChat: 'Sabuwar Tattaunawa',
      signOut: 'Fita daga Asusu'
    },
    topBar: {
      activeModel: 'Samfuri:',
      language: 'Harshe:',
      darkTheme: 'Duhu',
      lightTheme: 'Haske'
    },
    auth: {
      welcomeTitle: 'Adana muhimman umarnin AI sau daya. Yi amfani da su cikin dakika.',
      welcomeSubtitle:
        'MUSTAPHA AI STUDIO yana hada tattaunawar AI cikin Hausa da Turanci, Universal Master Prompt Studio, binciken hoto da bidiyo, murya, da samar da hotuna a wuri daya.',
      continueWithGoogle: 'Ci gaba da Google',
      launchWorkspace: 'Shiga Mustapha AI Studio',
      signingIn: 'Ana shiga...',
      protectedBy: 'An kare shi da Firebase Auth & Dokokin Tsaro na Musamman'
    },
    chat: {
      welcomeBack: 'Sannu, Mustapha',
      whatToDo: 'Sannu, Mustapha 👋',
      subtitle: 'Mataimakin AI naka yana nan don taimaka maka.',
      placeholder: 'Tambayi Mustapha AI...',
      send: 'Aika',
      stop: 'Tsaya',
      generating: 'Ana shirya amsa...',
      retry: 'Sake Gwadawa',
      copy: 'Kwafi',
      copied: 'An Kwafa',
      readAloud: 'Saurara',
      stopAudio: 'Tsayar da Murya',
      edit: 'Gyara',
      attachFile: 'Hada Hoto',
      highThinking: 'Deep Reasoning',
      googleSearch: 'Web Search',
      emptyChatHint: 'Rubuta tambaya a kasa cikin Hausa ko Turanci.',
      errorTitle: 'Ba a sami damar kammala bukatar ba',
      languageHint: 'Yana goyan bayan Hausa da Turanci — Mustapha AI yana amsawa da harshen da ka yi amfani da shi.'
    },
    imageGen: {
      title: 'Mai Samar da Hoto na AI',
      subtitle: 'Kirkiri hotuna daga bayanin Hausa ko Turanci tare da zabin girma da inganci.',
      promptLabel: 'Bayanin Hoto (Hausa ko Turanci)',
      promptPlaceholder: 'Samar da hoto mai kyau na gida na zamani mai lambu da rana...',
      modelLabel: 'Samfurin Samar da Hoto',
      aspectRatioLabel: 'Kwatankwacin Girman Hoto',
      sizeLabel: 'Ingancin Hoto',
      styleLabel: 'Salon Hoto',
      generateBtn: 'Samar da Hoto',
      generatingBtn: 'Ana Samar da Hoto...',
      downloadBtn: 'Sauke Hoto',
      regenerateBtn: 'Sake Samarwa',
      copyPromptBtn: 'Kwafi Prompt',
      savePromptBtn: 'Adana a Master Prompts',
      emptyCanvas: 'Rubuta bayanin hoto cikin Hausa ko Turanci sannan danna Samar da Hoto.',
      hausaTranslateHint: 'Ana kiyaye dukkan cikakkun bayanai na Hausa yayin samar da hoto.'
    },
    videoGen: {
      title: 'Mai Samar da Bidiyo na AI',
      subtitle: 'Samar da bidiyo daga bayanin Hausa ko Turanci ta amfani da Gemini Omni 1.1 Flash.',
      promptLabel: 'Bayanin Bidiyo, Motsi da Kyamara (Hausa ko Turanci)',
      promptPlaceholder: 'Bayyana yanayin wurin, motsin abubuwa, motsin kyamara, da haske...',
      aspectRatioLabel: 'Girman Bidiyo',
      durationLabel: 'Tsawon Lokaci',
      resolutionLabel: 'Ingancin Bidiyo',
      generateBtn: 'Samar da Bidiyo',
      generatingBtn: 'Ana Sarrafa Bidiyo...',
      statusQueued: 'A Layi — Ana shirya aikin samar da bidiyo...',
      statusProcessing: 'Ana Aiki — Ana hada hotunan bidiyo...',
      statusCompleted: 'An Kammala — Bidiyo yana shirye don kallo da saukewa',
      statusFailed: 'Ba a sami damar samar da bidiyo a wannan matakin API ba',
      downloadVideoBtn: 'Sauke Bidiyo',
      emptyVideo: 'Rubuta bayanin bidiyo, zabi girma da tsawon lokaci, sannan danna Samar da Bidiyo.'
    },
    analyzer: {
      title: 'Mai Binciken Hoto',
      subtitle: 'Loda hoto kuma ka yi tambayoyi a kansa cikin Hausa ko Turanci.',
      uploadLabel: '1. Loda Hoton da Za a Bincika',
      uploadHint: 'Yana karbar PNG, JPEG, WEBP, GIF har zuwa 10MB',
      loadSampleBtn: 'Loda Hoton Misali',
      removeImageBtn: 'Cire Hoto',
      questionLabel: '2. Yi Tambaya Game da Wannan Hoto (Hausa ko Turanci)',
      questionPlaceholder: 'Tambayi abin da ke cikin hoton, karanta rubutun ciki, ko nemi cikakken bayani cikin Hausa ko Turanci...',
      analyzeBtn: 'Bincika Hoto',
      analyzingBtn: 'Ana Binciken Hoto...',
      resultTitle: 'Sakamakon Binciken Hoto',
      emptyResult: 'Loda hoto (ko danna Loda Hoton Misali) sannan danna Bincika Hoto.',
      useInStudioBtn: 'Yi Amfani da Shi a Master Prompt Studio'
    },
    studio: {
      title: 'Dakin Master Prompt',
      subtitle: 'Adana dogon Master Prompt sau daya, shigar da sabon ra’ayi kawai cikin Hausa ko Turanci, kuma samar da sakamako.',
      step1Title: 'MATAKI NA 1 — KIRKIRI KO ZABI MASTER PROMPT',
      promptNameLabel: 'Sunan Master Prompt',
      promptNamePlaceholder: 'Misali: Tsarin Umarnin Bidiyo na Fim',
      masterPromptLabel: 'Cikakken Umarnin Master Prompt',
      masterPromptPlaceholder: 'Lika cikakkun dokoki da tsarin Master Prompt dinka a nan...',
      saveMasterPromptBtn: 'Adana Sabon Master Prompt',
      updateMasterPromptBtn: 'Sabunta Master Prompt',
      duplicatePromptBtn: 'Kwafi Tagwai',
      deletePromptBtn: 'Goge',
      useMasterPromptBtn: 'Yi Amfani da Master Prompt',
      step2Title: 'MATAKI NA 2 — SHIGAR DA SABON RA’AYI (HAUSA KO TURANCI)',
      newIdeaLabel: 'Sabon Ra’ayi, Batu, ko Aiki',
      newIdeaPlaceholder: 'Rubuta sabon ra’ayinka cikin Hausa ko Turanci...',
      extraInstructionsLabel: 'Karin Umarni na Zabi',
      step3Title: 'MATAKI NA 3 — DUBA HADADDEN PROMPT',
      combinedPreviewLabel: 'Hadadden Master Prompt + Sabon Ra’ayi',
      copyCombinedBtn: 'Kwafi Hadadden Prompt',
      step4Title: 'MATAKI NA 4 — ZABI NAU’IN SAKAMAKO & SAMARWA',
      outputTypeLabel: 'Nau’in Sakamako',
      outputLanguageLabel: 'Harshen Sakamako',
      generateResultBtn: 'SAMAR DA SAKAMAKONA',
      generatingResultBtn: 'ANA SAMAR DA SAKAMAKO...',
      step5Title: 'MATAKI NA 5 — SAKAMAKO DA ADANAWA',
      copyResultBtn: 'Kwafi Sakamako',
      saveResultToHistoryBtn: 'Adana Sakamako a Tarihi',
      editAndRegenerateBtn: 'Gyara & Sake Samarwa',
      promptOnlyBadge: 'Sakamakon Prompt (Rubutu / Tsari)'
    },
    voice: {
      title: 'Mataimakin Murya',
      subtitle: 'Yi magana ta makirufo, duba rubutun da aka gane kafin aikawa, kuma saurari amsar AI da murya.',
      startRecording: 'Fara Daukar Murya',
      stopRecording: 'Tsayar da Dauka & Duba Rubutu',
      recordingActive: 'Ana daukar murya... Yi magana a sarari yanzu',
      reviewTranscriptLabel: 'Duba & Gyara Rubutun da Aka Gane Kafin Aikawa (Hausa ko Turanci)',
      reviewTranscriptPlaceholder: 'Rubutun muryarka zai bayyana a nan domin ka duba ko ka gyara kafin aikawa, ko ka rubuta kai tsaye...',
      sendVoiceBtn: 'Aika wa AI & Karanta Amsa da Murya',
      speakOnlyBtn: 'Karanta Rubutu da Murya (TTS)',
      stopPlaybackBtn: 'Tsayar da Murya',
      hausaNotice: 'Lura: Gane muryar Hausa yana dogara da ingancin makirufo da goyan bayan burauza. Kuna iya duba da gyara rubutun kafin aikawa.'
    },
    savedPrompts: {
      title: 'Prompts da Aka Adana',
      subtitle: 'Nemo, kwafa, gyara, ko loda Master Prompts naka masu zaman kansu.',
      searchPlaceholder: 'Nemo prompts da suna, rukuni, ko abun ciki...',
      useBtn: 'Yi Amfani da Master Prompt',
      copyBtn: 'Kwafi Prompt',
      deleteBtn: 'Goge',
      emptyState: 'Babu prompts da suka dace da bincikenka.'
    },
    history: {
      title: 'Tarihin Tattaunawa',
      subtitle: 'Bude tsoffin tattaunawa, sake musu suna, ko fara sabuwar tattaunawa.',
      searchPlaceholder: 'Nemo tattaunawa...',
      openBtn: 'Bude Tattaunawa',
      renameBtn: 'Sake Suna',
      deleteBtn: 'Goge',
      confirmDeleteTitle: 'Goge Wannan Tattaunawa?',
      confirmDeleteMessage: 'Ka tabbata kana son goge wannan tattaunawa gaba daya? Ba za a iya dawo da ita ba.',
      confirmDeleteBtn: 'Eh, Goge Tattaunawa',
      cancelBtn: 'Soke',
      emptyState: 'Babu tattaunawa da aka adana tukuna.'
    },
    settings: {
      title: 'Asusu da Saituna',
      subtitle: 'Sarrafa asusun Google, harshen manhaja (Hausa / Turanci), yanayin haske, da matsayin samfuran AI.',
      profileSection: 'Asusun Mai Amfani & Bayani',
      displayNameLabel: 'Sunan Mai Amfani',
      languageSection: 'Harshen Manhaja da AI (Hausa / Turanci)',
      languageDescription: 'Zabi harshen maballai, kewayawa, da amsoshin AI.',
      customInstructionsLabel: 'Umarnin Mataimakin AI na Yau da Kullum',
      saveSettingsBtn: 'Adana Saituna',
      savedToast: 'An adana saituna cikin nasara.',
      providerStatusTitle: 'Matsayin Samfuran AI & Hadin Sabar'
    }
  }
};


export function getTranslations(lang: AppLanguage = 'en') {
  const tr = TRANSLATIONS[lang] || TRANSLATIONS.en;
  return {
    ...tr,
    // Navigation flat aliases
    navChat: tr.nav.chat,
    navImageGen: tr.nav.imageGen,
    navVideoGen: tr.nav.videoGen,
    navImageAnalyzer: tr.nav.imageAnalyzer,
    navStudio: tr.nav.studio,
    navVoice: tr.nav.voice,
    navSavedPrompts: tr.nav.savedPrompts,
    navHistory: tr.nav.history,
    navSettings: tr.nav.settings,
    navBioscience: lang === 'ha' ? 'Binciken Kimiyya (Bioscience)' : 'Bioscience Workbench',
    navFiles: lang === 'ha' ? 'Fayilolina' : 'My Files',
    navModels: lang === 'ha' ? 'Samfuran AI' : 'AI Models',
    navHelp: lang === 'ha' ? 'Taimako da Ra’ayi' : 'Help and Feedback',
    newChat: tr.nav.newChat,
    signOut: tr.nav.signOut,

    // Top bar flat aliases
    activeModel: tr.topBar.activeModel.replace(':', ''),
    languageLabel: tr.topBar.language.replace(':', ''),
    darkTheme: tr.topBar.darkTheme,
    lightTheme: tr.topBar.lightTheme,

    // Chat flat aliases
    welcomeBack: tr.chat.welcomeBack,
    whatWouldYouLikeToDo: tr.chat.whatToDo,
    welcomeSubtitle: tr.chat.subtitle,
    chatPlaceholder: tr.chat.placeholder,
    sendMessage: tr.chat.send,
    stopGenerating: tr.chat.stop,
    thinking: tr.chat.generating,
    retry: tr.chat.retry,
    copy: tr.chat.copy,
    copied: tr.chat.copied,
    readAloud: tr.chat.readAloud,
    stopSpeech: tr.chat.stopAudio,
    edit: tr.chat.edit,
    cancel: tr.history.cancelBtn,
    saveAndRegenerate: lang === 'ha' ? 'Adana & Sake Samarwa' : 'Save & Regenerate',
    regenerateResponse: lang === 'ha' ? 'Sake Samar da Amsa' : 'Regenerate Response',
    attachFile: tr.chat.attachFile,
    highThinking: tr.chat.highThinking,
    googleSearch: tr.chat.googleSearch,

    // Studio flat aliases
    studioTitle: tr.studio.title,
    studioSubtitle: tr.studio.subtitle,
    saveMasterPrompt: tr.studio.saveMasterPromptBtn,
    useMasterPrompt: tr.studio.useMasterPromptBtn,
    fieldAMasterPrompt: `FIELD A — ${tr.studio.masterPromptLabel.toUpperCase()}`,
    fieldBNewIdea: `FIELD B — ${tr.studio.newIdeaLabel.toUpperCase()}`,
    fieldCOptionalSettings:
      lang === 'ha'
        ? 'FILIN C — SAITUNA DA SHARUDDAN SAKAMAKO'
        : 'FIELD C — OPTIONAL SETTINGS & CONSTRAINTS',
    outputLanguage: tr.studio.outputLanguageLabel,
    outputType: tr.studio.outputTypeLabel,
    targetPlatform: lang === 'ha' ? 'Dandalin da Ake Nufi' : 'Target Platform',
    desiredLength: lang === 'ha' ? 'Tsawon Sakamako' : 'Desired Length',
    charLimit: lang === 'ha' ? 'Iyakar Haruffa (0 = Babu Iyaka)' : 'Character Limit (0 = No Limit)',
    enforceExactChar:
      lang === 'ha'
        ? 'Tabbatar da Yawan Haruffa Daidai a Sabar'
        : 'Enforce Exact Server-Verified Character Count',
    generateMyResult: tr.studio.generateResultBtn,
    applyingMasterPrompt: tr.studio.generatingResultBtn,
    generatedOutput: tr.studio.step5Title,
    copyResult: tr.studio.copyResultBtn,
    continueInChat: lang === 'ha' ? 'Ci gaba a Tattaunawar AI' : 'Continue in AI Chat',
    saveResultToHistory: tr.studio.saveResultToHistoryBtn,
    combinedPromptPreview: tr.studio.combinedPreviewLabel,
    copyCombinedPrompt: tr.studio.copyCombinedBtn,

    // Image & Video Generator flat aliases
    imageGenTitle: tr.imageGen.title,
    imageGenSubtitle: tr.imageGen.subtitle,
    imagePromptLabel: tr.imageGen.promptLabel,
    aspectRatio: tr.imageGen.aspectRatioLabel,
    outputResolution: tr.imageGen.sizeLabel,
    generateImageBtn: tr.imageGen.generateBtn,
    generatingImage: tr.imageGen.generatingBtn,
    downloadImage: tr.imageGen.downloadBtn,
    regenerateImage: tr.imageGen.regenerateBtn,
    copyPrompt: tr.imageGen.copyPromptBtn,
    savePrompt: tr.imageGen.savePromptBtn,
    videoGenTitle: tr.videoGen.title,
    videoGenSubtitle: tr.videoGen.subtitle,
    videoPromptLabel: tr.videoGen.promptLabel,
    videoDuration: tr.videoGen.durationLabel,
    generateVideoBtn: tr.videoGen.generateBtn,
    generatingVideo: tr.videoGen.generatingBtn,

    // Vision Analyzer flat aliases
    visionTitle: tr.analyzer.title,
    visionSubtitle: tr.analyzer.subtitle,
    uploadImagePrompt: tr.analyzer.uploadLabel,
    loadSampleDiagram: tr.analyzer.loadSampleBtn,
    removeImage: tr.analyzer.removeImageBtn,
    analysisInstructions: tr.analyzer.questionLabel,
    analyzeImageBtn: tr.analyzer.analyzeBtn,
    analyzingImage: tr.analyzer.analyzingBtn,
    useInStudio: tr.analyzer.useInStudioBtn,

    // Voice Assistant flat aliases
    voiceTitle: tr.voice.title,
    voiceSubtitle: tr.voice.subtitle,
    startRecording: tr.voice.startRecording,
    stopAndTranscribe: tr.voice.stopRecording,
    transcribedSpeechLabel: tr.voice.reviewTranscriptLabel,
    askAndSpeakBtn: tr.voice.sendVoiceBtn,
    convertTextToSpeechBtn: tr.voice.speakOnlyBtn,
    startLiveSession:
      lang === 'ha'
        ? 'Fara Tattaunawar Murya Kai Tsaye (Live)'
        : 'Start Real-Time Live Voice Session',
    endLiveSession: lang === 'ha' ? 'Kammala Zaman Murya' : 'End Live Session',
    errMicPermission:
      lang === 'ha'
        ? 'An hana izinin makirufo ko kuma ba ya samuwa a wannan burauzar. Kuna iya amfani da akwatin rubutu a kasa.'
        : 'Microphone access was denied or is unavailable in this browser. You can use the text fallback input below.',

    // Saved Prompts & History & Settings flat aliases
    savedPromptsTitle: tr.savedPrompts.title,
    savedPromptsSubtitle: tr.savedPrompts.subtitle,
    searchPrompts: tr.savedPrompts.searchPlaceholder,
    duplicatePrompt: tr.studio.duplicatePromptBtn,
    deletePrompt: tr.savedPrompts.deleteBtn,
    historyTitle: tr.history.title,
    historySubtitle: tr.history.subtitle,
    reopenChat: tr.history.openBtn,
    archive: lang === 'ha' ? 'Ajiye a Taska' : 'Archive',
    delete: tr.history.deleteBtn,
    confirmDeleteTitle: tr.history.confirmDeleteTitle,
    settingsTitle: tr.settings.title,
    settingsSubtitle: tr.settings.subtitle,
    displayNameLabel: tr.settings.displayNameLabel,
    defaultModelLabel: lang === 'ha' ? 'Samfurin AI na Farko' : 'Default AI Model',
    customInstructionsLabel: tr.settings.customInstructionsLabel,
    savePreferences: tr.settings.saveSettingsBtn,
    clearLocalHistory:
      lang === 'ha' ? 'Goge Tarihin Wannan Zama' : 'Clear Local Session History',
    deleteAccountBtn:
      lang === 'ha'
        ? 'Goge Asusu & Dukkan Bayanai'
        : 'Delete Account & All Saved Data'
  };
}
