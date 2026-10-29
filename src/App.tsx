import React, { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import {
  auth,
  db,
  signInWithGoogle,
  signOutUser,
  updateUserProfileSettings,
  deleteUserAccountAndData,
  handleFirestoreError,
  OperationType
} from './firebase';
import {
  MODEL_REGISTRY,
  AIModelConfig,
  SavedMasterPrompt,
  STARTER_MASTER_PROMPTS,
  PROMPT_CATEGORIES
} from './utils/modelRegistry';
import { sanitizeStringField, sanitizeProviderError } from './utils/promptEngine';
import { AppLanguage, getTranslations } from './utils/i18n';
import { BrandLogo } from './components/BrandLogo';
import { LoginView } from './components/LoginView';
import { MasterPromptStudio } from './components/MasterPromptStudio';
import { VisionStudio } from './components/VisionStudio';
import { MediaGeneratorStudio, SavedMediaItem } from './components/MediaGeneratorStudio';
import { VoiceAssistantStudio } from './components/VoiceAssistantStudio';
import { BioscienceWorkbench } from './components/BioscienceWorkbench';
import { AdminModelsHub } from './components/AdminModelsHub';
import {
  Plus,
  MessageSquare,
  Wand2,
  Eye,
  Image as ImageIcon,
  Film,
  Mic,
  BookOpen,
  Bookmark,
  History,
  FolderOpen,
  Cpu,
  Settings as SettingsIcon,
  HelpCircle,
  Sun,
  Moon,
  LogOut,
  Send,
  ArrowUp,
  Camera,
  ChevronRight,
  ChevronLeft,
  Gauge,
  PenLine,
  Square,
  RotateCcw,
  Copy,
  Check,
  Edit3,
  Trash2,
  Archive,
  Paperclip,
  Globe,
  Brain,
  Menu,
  X,
  Search,
  Dna,
  ShieldAlert,
  ExternalLink,
  Volume2,
  Languages,
  AlertCircle
} from 'lucide-react';

type ActiveSection =
  | 'chat'
  | 'image-gen'
  | 'video-gen'
  | 'vision'
  | 'studio'
  | 'voice'
  | 'library'
  | 'history'
  | 'settings'
  | 'bioscience'
  | 'files'
  | 'models'
  | 'help';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model: string;
  createdAt: string;
  groundingSources?: Array<{ title: string; uri: string }>;
}

export interface ConversationRecord {
  id: string;
  title: string;
  model: string;
  archived: boolean;
  messageCount: number;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface UploadedWorkspaceFile {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  dataBase64: string;
  previewUrl: string;
  uploadedAt: string;
}

export default function App() {
  // Auth & Session State
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isDemoSession, setIsDemoSession] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('login') === '1') return false;
    return true;
  });
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Language State (English 'en' / Hausa 'ha')
  const [lang, setLang] = useState<AppLanguage>(() => {
    const saved = localStorage.getItem('mustapha_language');
    return saved === 'ha' ? 'ha' : 'en';
  });
  const t = getTranslations(lang);

  // Theme & Navigation State (Default to crisp iOS Light Mode unless Dark is saved)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('mustapha_theme');
    return saved === 'dark' ? 'dark' : 'light';
  });
  const [activeSection, setActiveSection] = useState<ActiveSection>(() => {
    const sec = new URLSearchParams(window.location.search).get('section') as ActiveSection | null;
    const valid: ActiveSection[] = [
      'chat',
      'image-gen',
      'video-gen',
      'vision',
      'studio',
      'voice',
      'library',
      'history',
      'settings',
      'bioscience',
      'files',
      'models',
      'help'
    ];
    return sec && valid.includes(sec) ? sec : 'chat';
  });
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Models & Capabilities State (default to reliable gemini-3.1-flash-lite)
  const [models, setModels] = useState<AIModelConfig[]>(MODEL_REGISTRY);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.1-flash-lite');
  const [enableThinking, setEnableThinking] = useState<boolean>(false);
  const [enableSearch, setEnableSearch] = useState<boolean>(false);
  const [customInstructions, setCustomInstructions] = useState<string>(
    'Respond clearly, structure complex answers with concise headings, and prioritize actionable output.'
  );
  const [displayName, setDisplayName] = useState<string>('Mustapha Iliya');

  // Conversations & Messages State
  const [conversations, setConversations] = useState<ConversationRecord[]>([
    {
      id: 'conv-welcome-1',
      title: 'Tsarin Rubuta Labari da Fim na Hausa',
      model: 'gemini-3.1-flash-lite',
      archived: false,
      messageCount: 2,
      updatedAt: '2026-10-28T09:15:00.000Z',
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello good morning',
          model: 'gemini-3.1-flash-lite',
          createdAt: '2026-10-28T09:14:00.000Z'
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content:
            'Don Allah, ga tsari mai tsabta, natural-flowing text to help you with answers, Universal Master Prompts, and creative writing in English and Hausa.',
          model: 'gemini-3.1-flash-lite',
          createdAt: '2026-10-28T09:15:00.000Z'
        }
      ]
    },
    {
      id: 'conv-welcome-2',
      title: 'Product Launch Video Master Strategy',
      model: 'gemini-3.1-flash-lite',
      archived: false,
      messageCount: 2,
      updatedAt: '2026-10-24T09:15:00.000Z',
      messages: [
        {
          id: 'msg-3',
          role: 'user',
          content: 'How can I use Universal Master Prompt Studio so I never have to paste my 500-word video prompt rules again?',
          model: 'gemini-3.1-flash-lite',
          createdAt: '2026-10-24T09:14:00.000Z'
        },
        {
          id: 'msg-4',
          role: 'assistant',
          content:
            'Open **Universal Master Prompt Studio** from the sidebar, paste your full video production instructions into **Section 1 (Tsohon Master Prompt Ɗina)**, and enter your new video concept in **Section 2 (Sabon Ideas Ɗina)**—Mustapha AI Studio automatically adapts your entire prompt while preserving your structure.',
          model: 'gemini-3.1-flash-lite',
          createdAt: '2026-10-24T09:15:00.000Z'
        }
      ]
    }
  ]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>('conv-welcome-1');
  const [chatInput, setChatInput] = useState<string>('');
  const [isStreamingChat, setIsStreamingChat] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [lastFailedInput, setLastFailedInput] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<string>('');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<UploadedWorkspaceFile | null>(null);
  const [plusMenuOpen, setPlusMenuOpen] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const photosInputRef = useRef<HTMLInputElement | null>(null);
  const filesInputRef = useRef<HTMLInputElement | null>(null);
  const composerInputRef = useRef<HTMLInputElement | null>(null);
  const displayNameInputRef = useRef<HTMLInputElement | null>(null);

  // Chat Read-Aloud TTS State
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const chatAudioRef = useRef<HTMLAudioElement | null>(null);

  // Saved Master Prompts State
  const [savedPrompts, setSavedPrompts] = useState<SavedMasterPrompt[]>(STARTER_MASTER_PROMPTS);
  const [selectedPromptForStudio, setSelectedPromptForStudio] =
    useState<SavedMasterPrompt | null>(null);
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryCategoryFilter, setLibraryCategoryFilter] = useState<string>('All');
  const [editingPromptInLibrary, setEditingPromptInLibrary] = useState<SavedMasterPrompt | null>(null);

  // Chat History State & Confirmation Modal
  const [historySearch, setHistorySearch] = useState('');
  const [confirmDeleteConvId, setConfirmDeleteConvId] = useState<string | null>(null);
  const [renamingConvId, setRenamingConvId] = useState<string | null>(null);
  const [renamingTitle, setRenamingTitle] = useState<string>('');

  // Saved Media & Uploaded Files State
  const [savedMedia, setSavedMedia] = useState<SavedMediaItem[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedWorkspaceFile[]>([]);

  // Usage Tracking & Quotas
  const [usageStats, setUsageStats] = useState({
    textRequests: 4,
    imageGenerations: 1,
    voiceRequests: 1,
    videoGenerations: 0
  });
  const [dailyLimits, setDailyLimits] = useState({
    textLimit: 500,
    imageLimit: 100,
    voiceLimit: 100
  });

  // Account Deletion & Settings Save State
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [settingsSavedBanner, setSettingsSavedBanner] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  // Sync theme with document root
  useEffect(() => {
    localStorage.setItem('mustapha_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Sync language preference with localStorage
  useEffect(() => {
    localStorage.setItem('mustapha_language', lang);
  }, [lang]);

  // Listen for Firebase Auth state changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (user?.displayName) {
        setDisplayName(user.displayName);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Attach Firestore listeners when authenticated with Firebase
  useEffect(() => {
    if (!authReady || !firebaseUser) return;

    const uid = firebaseUser.uid;
    const promptsQuery = query(collection(db, 'prompts'), where('userId', '==', uid));
    const unsubPrompts = onSnapshot(
      promptsQuery,
      (snapshot) => {
        const userPrompts: SavedMasterPrompt[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            userId: data.userId,
            name: data.name,
            description: data.description,
            category: data.category,
            promptText: data.promptText,
            outputLanguage: data.outputLanguage,
            outputType: data.outputType,
            targetPlatform: data.targetPlatform,
            desiredLength: data.desiredLength,
            characterLimit: data.characterLimit || 0,
            exactCharCount: Boolean(data.exactCharCount),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
        });
        setSavedPrompts([...userPrompts, ...STARTER_MASTER_PROMPTS]);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'prompts');
      }
    );

    return () => {
      unsubPrompts();
    };
  }, [authReady, firebaseUser]);

  const handleGoogleLogin = async () => {
    setAuthError(null);
    try {
      const user = await signInWithGoogle();
      if (!user) {
        setIsDemoSession(true);
      }
    } catch (err: any) {
      const msg = String(err?.message || err || '');
      if (msg.includes('token-service') || msg.includes('securetoken') || msg.includes('popup')) {
        setIsDemoSession(true);
        return;
      }
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Google sign-in could not be completed. You can also launch the interactive workspace directly.'
      );
    }
  };

  const handleSignOut = async () => {
    if (firebaseUser) {
      await signOutUser();
    }
    setIsDemoSession(false);
  };

  const handleRecordUsage = (
    type: 'textRequests' | 'imageGenerations' | 'voiceRequests' | 'videoGenerations'
  ) => {
    setUsageStats((prev) => ({
      ...prev,
      [type]: prev[type] + 1
    }));
  };

  // Start a fresh conversation
  const handleStartNewChat = () => {
    abortControllerRef.current?.abort();
    setActiveConversationId(null);
    setChatInput('');
    setChatError(null);
    setLastFailedInput(null);
    setPendingAttachment(null);
    setActiveSection('chat');
    setMobileDrawerOpen(false);
  };

  const activeConversation = conversations.find((c) => c.id === activeConversationId) || null;

  // Send or Stream a message in AI Chat with clean error recovery & empty-placeholder removal
  const handleSendChatMessage = async (
    overrideInput?: string,
    overrideHistory?: ChatMessage[]
  ) => {
    const textToSend = (overrideInput !== undefined ? overrideInput : chatInput).trim();
    if (!textToSend || isStreamingChat) return;

    setChatError(null);
    setLastFailedInput(null);
    if (overrideInput === undefined) {
      setChatInput('');
    }

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      content: textToSend,
      model: selectedModel,
      createdAt: new Date().toISOString()
    };

    const assistantMsgId = `msg-${Date.now()}-a`;
    const placeholderAssistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      model: enableThinking ? 'gemini-4-argon' : selectedModel,
      createdAt: new Date().toISOString()
    };

    let targetConvId = activeConversationId;
    // Strip any empty assistant placeholders from prior history before building turn
    const rawBaseMessages =
      overrideHistory !== undefined
        ? overrideHistory
        : activeConversation
        ? activeConversation.messages
        : [];
    const baseMessages = rawBaseMessages.filter((m) => m.content && m.content.trim().length > 0);

    const updatedMessages = [...baseMessages, userMsg, placeholderAssistantMsg];

    if (!targetConvId) {
      targetConvId = `conv-${Date.now()}`;
      const newConv: ConversationRecord = {
        id: targetConvId,
        title: sanitizeStringField(textToSend, 60, 'New Conversation'),
        model: selectedModel,
        archived: false,
        messageCount: 2,
        updatedAt: new Date().toISOString(),
        messages: updatedMessages
      };
      setConversations((prev) => [newConv, ...prev]);
      setActiveConversationId(targetConvId);

      if (firebaseUser) {
        try {
          await setDoc(doc(db, 'conversations', targetConvId), {
            userId: firebaseUser.uid,
            title: sanitizeStringField(textToSend, 200, 'New Conversation'),
            model: sanitizeStringField(selectedModel, 80, 'gemini-3.1-flash-lite'),
            archived: false,
            messageCount: 2,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `conversations/${targetConvId}`);
        }
      }
    } else {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === targetConvId
            ? {
                ...c,
                messages: updatedMessages,
                messageCount: updatedMessages.length,
                updatedAt: new Date().toISOString()
              }
            : c
        )
      );
    }

    const attachmentToSend = pendingAttachment;
    setPendingAttachment(null);
    setIsStreamingChat(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: [...baseMessages, userMsg].map((m) => ({
            role: m.role,
            content: m.content
          })),
          model: selectedModel,
          systemInstruction: customInstructions,
          enableThinking,
          enableSearch,
          language: lang,
          attachment: attachmentToSend
            ? {
                data: attachmentToSend.dataBase64,
                mimeType: attachmentToSend.mimeType
              }
            : undefined
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Request failed with status ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';
      let actualModelUsed = enableThinking ? 'gemini-4-argon' : selectedModel;
      let groundingSources: Array<{ title: string; uri: string }> = [];

      if (reader) {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const jsonStr = trimmed.replace(/^data:\s*/, '');
            let parsed: any = null;
            try {
              parsed = JSON.parse(jsonStr);
            } catch {
              continue;
            }
            if (parsed.error) {
              throw new Error(parsed.error);
            }
            if (parsed.modelUsed) {
              actualModelUsed = parsed.modelUsed;
            }
            if (parsed.text) {
              accumulatedText += parsed.text;
              setConversations((prev) =>
                prev.map((c) =>
                  c.id === targetConvId
                    ? {
                        ...c,
                        messages: c.messages.map((m) =>
                          m.id === assistantMsgId ? { ...m, content: accumulatedText } : m
                        )
                      }
                    : c
                )
              );
            }
            if (parsed.groundingSources) {
              groundingSources = parsed.groundingSources;
            }
          }
        }
      }

      if (!accumulatedText.trim()) {
        throw new Error(
          lang === 'ha'
            ? 'Ba a sami amsa daga AI ba. Da fatan za a sake gwadawa.'
            : 'The AI returned an empty response. Please click Retry.'
        );
      }

      setConversations((prev) =>
        prev.map((c) =>
          c.id === targetConvId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        content: accumulatedText,
                        model: actualModelUsed,
                        groundingSources
                      }
                    : m
                )
              }
            : c
        )
      );
      handleRecordUsage('textRequests');
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === targetConvId
              ? {
                  ...c,
                  messages: c.messages
                    .map((m) =>
                      m.id === assistantMsgId && m.content
                        ? { ...m, content: m.content + ' [Stopped]' }
                        : m
                    )
                    .filter((m) => m.id !== assistantMsgId || Boolean(m.content.trim()))
                }
              : c
          )
        );
      } else {
        // Remove empty assistant placeholder so previous messages remain clean and intact!
        setConversations((prev) =>
          prev.map((c) =>
            c.id === targetConvId
              ? {
                  ...c,
                  messages: c.messages.filter(
                    (m) => m.id !== assistantMsgId || Boolean(m.content.trim())
                  )
                }
              : c
          )
        );
        const cleanMsg = sanitizeProviderError(err, lang, 'chat');
        setChatError(cleanMsg);
        setLastFailedInput(textToSend);
      }
    } finally {
      setIsStreamingChat(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopGeneration = () => {
    abortControllerRef.current?.abort();
    setIsStreamingChat(false);
  };

  const handleRegenerateLastResponse = () => {
    if (!activeConversation || activeConversation.messages.length === 0) {
      if (lastFailedInput) {
        handleSendChatMessage(lastFailedInput, []);
      }
      return;
    }
    const msgs = [...activeConversation.messages];
    let lastUserIdx = -1;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'user') {
        lastUserIdx = i;
        break;
      }
    }
    if (lastUserIdx === -1) return;
    const targetUserMessage = msgs[lastUserIdx];
    const priorHistory = msgs.slice(0, lastUserIdx);
    handleSendChatMessage(targetUserMessage.content, priorHistory);
  };

  const handleSpeakChatMessage = async (msg: ChatMessage) => {
    if (speakingMessageId === msg.id) {
      chatAudioRef.current?.pause();
      setSpeakingMessageId(null);
      return;
    }
    setSpeakingMessageId(msg.id);
    try {
      const res = await fetch('/api/audio/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: msg.content.slice(0, 1500),
          voiceName: 'Kore',
          language: lang
        })
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.error || 'TTS failed');
      }
      const audioUrl = data.audioDataUrl || data.data?.audioDataUrl;
      if (audioUrl) {
        if (chatAudioRef.current) {
          chatAudioRef.current.pause();
        }
        const audio = new Audio(audioUrl);
        chatAudioRef.current = audio;
        audio.onended = () => setSpeakingMessageId(null);
        audio.onerror = () => setSpeakingMessageId(null);
        await audio.play();
        handleRecordUsage('voiceRequests');
      } else {
        setSpeakingMessageId(null);
      }
    } catch {
      setSpeakingMessageId(null);
    }
  };

  const handleSaveEditedMessage = (msgId: string) => {
    if (!activeConversation || !editingContent.trim()) return;
    const idx = activeConversation.messages.findIndex((m) => m.id === msgId);
    if (idx === -1) return;
    const priorHistory = activeConversation.messages.slice(0, idx);
    const updatedText = editingContent.trim();
    setEditingMessageId(null);
    setEditingContent('');
    handleSendChatMessage(updatedText, priorHistory);
  };

  const handleUploadChatAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setChatError('Attachment exceeds 10MB limit.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const b64 = dataUrl.split(',')[1] || '';
      const uploaded: UploadedWorkspaceFile = {
        id: `file-${Date.now()}`,
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        dataBase64: b64,
        previewUrl: dataUrl,
        uploadedAt: new Date().toISOString()
      };
      setPendingAttachment(uploaded);
      setUploadedFiles((prev) => [uploaded, ...prev]);
    };
    reader.readAsDataURL(file);
  };

  // Save Master Prompt to Library (and Firestore when signed in)
  const handleSaveMasterPrompt = async (
    newPrompt: Omit<SavedMasterPrompt, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => {
    const promptId = `prompt-${Date.now()}`;
    const record: SavedMasterPrompt = {
      ...newPrompt,
      id: promptId,
      userId: firebaseUser?.uid || 'local-user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setSavedPrompts((prev) => [record, ...prev]);

    if (firebaseUser) {
      try {
        await setDoc(doc(db, 'prompts', promptId), {
          userId: firebaseUser.uid,
          name: sanitizeStringField(newPrompt.name, 150, 'Untitled Master Prompt'),
          description: sanitizeStringField(newPrompt.description, 500, ''),
          category: sanitizeStringField(newPrompt.category, 80, 'General Productivity'),
          promptText: sanitizeStringField(newPrompt.promptText, 30000, ''),
          outputLanguage: sanitizeStringField(newPrompt.outputLanguage, 60, 'English'),
          outputType: sanitizeStringField(newPrompt.outputType, 80, 'Direct Output'),
          targetPlatform: sanitizeStringField(newPrompt.targetPlatform, 80, 'General'),
          desiredLength: sanitizeStringField(newPrompt.desiredLength, 60, 'Standard'),
          characterLimit: Math.max(0, Math.min(100000, Number(newPrompt.characterLimit) || 0)),
          exactCharCount: Boolean(newPrompt.exactCharCount),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `prompts/${promptId}`);
      }
    }
  };

  const handleUpdatePromptInLibrary = async (updated: SavedMasterPrompt) => {
    setSavedPrompts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setEditingPromptInLibrary(null);
    if (firebaseUser && !updated.id.startsWith('starter-')) {
      try {
        await setDoc(
          doc(db, 'prompts', updated.id),
          {
            userId: firebaseUser.uid,
            name: sanitizeStringField(updated.name, 150, 'Master Prompt'),
            description: sanitizeStringField(updated.description, 500, ''),
            category: sanitizeStringField(updated.category, 80, 'General Productivity'),
            promptText: sanitizeStringField(updated.promptText, 30000, ''),
            outputLanguage: sanitizeStringField(updated.outputLanguage, 60, 'English'),
            outputType: sanitizeStringField(updated.outputType, 80, 'Direct Output'),
            targetPlatform: sanitizeStringField(updated.targetPlatform, 80, 'General'),
            desiredLength: sanitizeStringField(updated.desiredLength, 60, 'Standard'),
            characterLimit: Math.max(0, Math.min(100000, Number(updated.characterLimit) || 0)),
            exactCharCount: Boolean(updated.exactCharCount),
            updatedAt: serverTimestamp()
          },
          { merge: true }
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `prompts/${updated.id}`);
      }
    }
  };

  const handleDuplicatePrompt = async (prompt: SavedMasterPrompt) => {
    await handleSaveMasterPrompt({
      name: `${prompt.name} (Copy)`,
      description: prompt.description,
      category: prompt.category,
      promptText: prompt.promptText,
      outputLanguage: prompt.outputLanguage,
      outputType: prompt.outputType,
      targetPlatform: prompt.targetPlatform,
      desiredLength: prompt.desiredLength,
      characterLimit: prompt.characterLimit,
      exactCharCount: prompt.exactCharCount
    });
  };

  const handleDeletePrompt = async (promptId: string) => {
    setSavedPrompts((prev) => prev.filter((p) => p.id !== promptId));
    if (firebaseUser && !promptId.startsWith('starter-')) {
      try {
        await deleteDoc(doc(db, 'prompts', promptId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `prompts/${promptId}`);
      }
    }
  };

  // Save generated image/media
  const handleSaveGeneratedMedia = async (
    item: Omit<SavedMediaItem, 'id' | 'createdAt'>
  ) => {
    const id = `media-${Date.now()}`;
    const fullItem: SavedMediaItem = {
      ...item,
      id,
      createdAt: new Date().toISOString()
    };
    setSavedMedia((prev) => [fullItem, ...prev]);

    if (firebaseUser && item.previewData.length < 750000) {
      try {
        await setDoc(doc(db, 'generated_images', id), {
          userId: firebaseUser.uid,
          prompt: sanitizeStringField(item.prompt, 4000, 'Prompt'),
          model: sanitizeStringField(item.model, 80, 'gemini-3.1-flash-lite-image'),
          aspectRatio: sanitizeStringField(item.aspectRatio, 20, '1:1'),
          imageSize: sanitizeStringField(item.imageSize, 20, '1K'),
          mediaType: item.mediaType,
          previewData: item.previewData,
          createdAt: serverTimestamp()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `generated_images/${id}`);
      }
    }
  };

  const handleDeleteMedia = async (id: string) => {
    setSavedMedia((prev) => prev.filter((m) => m.id !== id));
    if (firebaseUser) {
      try {
        await deleteDoc(doc(db, 'generated_images', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `generated_images/${id}`);
      }
    }
  };

  // Show Login View if unauthenticated and not in interactive session
  if (!firebaseUser && !isDemoSession) {
    return (
      <LoginView
        onGoogleLogin={handleGoogleLogin}
        onEnterDemoMode={() => setIsDemoSession(true)}
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
        authError={authError}
      />
    );
  }

  const isDark = theme === 'dark';
  const isAdminUser =
    firebaseUser?.email === 'mustaphailiya895@gmail.com' || isDemoSession;

  const userFullName = firebaseUser?.displayName || displayName || 'Mustapha Iliya';
  const userInitials =
    userFullName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'MI';

  // Primary iOS Sidebar Tools (matching Mockup 2 order + full workspace tools)
  const sidebarItems: Array<{
    id: ActiveSection;
    label: string;
    icon: React.FC<{ className?: string }>;
  }> = [
    { id: 'image-gen', label: t.navImageGen, icon: ImageIcon },
    { id: 'video-gen', label: t.navVideoGen, icon: Film },
    { id: 'vision', label: t.navImageAnalyzer, icon: Eye },
    { id: 'studio', label: t.navStudio, icon: Wand2 },
    { id: 'library', label: t.navSavedPrompts, icon: Bookmark },
    { id: 'voice', label: t.navVoice, icon: Mic },
    { id: 'bioscience', label: t.navBioscience, icon: Dna },
    { id: 'files', label: t.navFiles, icon: FolderOpen },
    { id: 'models', label: t.navModels, icon: Cpu },
    { id: 'settings', label: t.navSettings, icon: SettingsIcon },
    { id: 'help', label: t.navHelp, icon: HelpCircle }
  ];

  const sectionTitles: Record<ActiveSection, string> = {
    chat: 'MUSTAPHA AI STUDIO',
    'image-gen': t.navImageGen,
    'video-gen': t.navVideoGen,
    vision: t.navImageAnalyzer,
    studio: t.navStudio,
    voice: t.navVoice,
    library: t.navSavedPrompts,
    history: t.navHistory,
    settings: t.navSettings,
    bioscience: t.navBioscience,
    files: t.navFiles,
    models: t.navModels,
    help: t.navHelp
  };

  const filteredLibraryPrompts = savedPrompts.filter((p) => {
    const matchesCategory =
      libraryCategoryFilter === 'All' || p.category === libraryCategoryFilter;
    const matchesQuery =
      !librarySearch.trim() ||
      p.name.toLowerCase().includes(librarySearch.toLowerCase()) ||
      p.description.toLowerCase().includes(librarySearch.toLowerCase()) ||
      p.promptText.toLowerCase().includes(librarySearch.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  const filteredConversations = conversations.filter((c) =>
    !historySearch.trim()
      ? true
      : c.title.toLowerCase().includes(historySearch.toLowerCase())
  );

  const chatCapableModels = models.filter(
    (m) => m.capabilities.includes('chat') && m.configured && m.enabled
  );

  return (
    <div
      className={`h-dvh overflow-hidden flex flex-col md:flex-row transition-colors ${
        isDark ? 'dark bg-[#000000] text-[#F2F2F7]' : 'bg-[#F2F2F7] text-[#1C1C1E]'
      }`}
    >
      {/* Mobile Backdrop Overlay */}
      {mobileDrawerOpen && (
        <div
          aria-hidden="true"
          onClick={() => setMobileDrawerOpen(false)}
          className="fixed inset-0 z-40 bg-black/45 backdrop-blur-xs md:hidden"
        />
      )}

      {/* LEFT SIDEBAR NAVIGATION (iOS Sheet / Sidebar Style matching Mockup 2) */}
      <aside
        aria-label="Workspace Sidebar Navigation"
        className={`${
          mobileDrawerOpen ? 'fixed inset-y-0 left-0 z-50 w-[82%] max-w-[310px] flex shadow-2xl' : 'hidden md:flex'
        } md:w-72 h-full shrink-0 flex-col border-r transition-colors ${
          isDark
            ? 'bg-[#141416]/95 border-white/[0.08] text-[#F2F2F7]'
            : 'bg-white/95 border-black/[0.07] text-[#1C1C1E]'
        } ios-glass`}
      >
        {/* Sidebar Header: Clean MUSTAPHA AI STUDIO Logo (No bulky green + New Chat button) */}
        <div
          className={`px-5 py-4 flex items-center justify-between border-b ${
            isDark ? 'border-white/[0.08]' : 'border-black/[0.06]'
          }`}
        >
          <BrandLogo size="sm" stacked={true} />
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setMobileDrawerOpen(false)}
            className="md:hidden w-9 h-9 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable iOS Menu List + Chat History Section */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
          <nav aria-label="AI Studio Tools" className="space-y-1">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveSection(item.id);
                    setMobileDrawerOpen(false);
                  }}
                  className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-[14px] font-medium transition-all cursor-pointer text-left ${
                    isActive
                      ? isDark
                        ? 'bg-white/[0.12] text-white font-semibold'
                        : 'bg-[#14967F]/12 text-[#0F6E66] font-semibold'
                      : isDark
                      ? 'text-[#E5E5EA] hover:bg-white/[0.06]'
                      : 'text-[#1C1C1E] hover:bg-black/[0.04]'
                  }`}
                >
                  <Icon
                    className={`w-[19px] h-[19px] shrink-0 ${
                      isActive ? 'text-[#14967F] dark:text-[#2DD4BF]' : 'opacity-80'
                    }`}
                  />
                  <span className="leading-snug">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Hairline Divider & CHAT HISTORY Section (Matching Mockup 2) */}
          <div
            className={`pt-4 border-t space-y-2 ${
              isDark ? 'border-white/[0.08]' : 'border-black/[0.07]'
            }`}
          >
            <div className="px-3.5 flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-[0.08em] uppercase opacity-50">
                CHAT HISTORY
              </span>
              <button
                type="button"
                onClick={() => {
                  setActiveSection('history');
                  setMobileDrawerOpen(false);
                }}
                className="text-[11px] font-medium text-[#14967F] dark:text-[#2DD4BF] hover:underline cursor-pointer"
              >
                {lang === 'ha' ? 'Duka' : 'See all'}
              </button>
            </div>

            <div className="space-y-0.5">
              {conversations
                .filter((c) => !c.archived)
                .slice(0, 5)
                .map((c) => {
                  const isCurrentChat =
                    activeSection === 'chat' && activeConversationId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setActiveConversationId(c.id);
                        setActiveSection('chat');
                        setMobileDrawerOpen(false);
                      }}
                      className={`w-full text-left px-3.5 py-2 rounded-xl text-[13.5px] truncate transition-colors cursor-pointer ${
                        isCurrentChat
                          ? isDark
                            ? 'bg-white/[0.1] text-white font-medium'
                            : 'bg-black/[0.06] text-[#1C1C1E] font-medium'
                          : 'opacity-80 hover:opacity-100 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
                      }`}
                    >
                      {c.title}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Fixed Bottom Anchor: "Chat" Pill Button + Circular "MI" Profile Icon (Matching Mockup 2) */}
        <div
          className={`p-4 border-t flex items-center justify-between gap-3 ${
            isDark
              ? 'border-white/[0.08] bg-[#141416]/90'
              : 'border-black/[0.07] bg-white/90'
          }`}
        >
          <button
            type="button"
            onClick={() => {
              setActiveSection('chat');
              setMobileDrawerOpen(false);
            }}
            aria-label="Open AI Chat"
            className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-[#8CE9BF] hover:bg-[#76DFB0] text-[#0B291E] font-semibold text-sm shadow-xs transition-transform active:scale-95 cursor-pointer"
          >
            <MessageSquare className="w-4 h-4 stroke-[2.2]" />
            <span>Chat</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSection('settings');
              setMobileDrawerOpen(false);
            }}
            aria-label="Open Mustapha Iliya Profile and Settings"
            title={`${userFullName} · Settings`}
            className="w-10 h-10 rounded-full bg-[#6E56CF] hover:bg-[#5E46BF] text-white font-bold text-xs flex items-center justify-center shadow-xs transition-transform active:scale-95 cursor-pointer shrink-0"
          >
            {userInitials}
          </button>
        </div>
      </aside>

      {/* MAIN WORKSPACE COLUMN */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* iOS GLASSMORPHIC TOP NAVIGATION BAR (Matching Mockup 1) */}
        <header
          className={`flex items-center justify-between gap-4 px-4 sm:px-6 h-14 border-b sticky top-0 z-30 ios-glass ${
            isDark
              ? 'bg-[#000000]/80 border-white/[0.08]'
              : 'bg-white/85 border-black/[0.06]'
          }`}
        >
          {/* Left Zone: Hamburger Trigger (Mobile) + New Chat Trigger */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              aria-label="Open navigation menu"
              onClick={() => setMobileDrawerOpen(true)}
              className="md:hidden w-10 h-10 -ml-1 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>

            {activeSection === 'chat' ? (
              <button
                type="button"
                onClick={handleStartNewChat}
                aria-label={t.newChat}
                title={t.newChat}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-[#1C1C1E] hover:bg-[#2C2C2E] text-[#E5E5EA]'
                    : 'bg-[#EFEFF4] hover:bg-[#E5E5EA] text-[#1C1C1E]'
                }`}
              >
                <Plus className="w-3.5 h-3.5 text-[#14967F]" />
                <span className="hidden sm:inline">{t.newChat}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveSection('chat')}
                className="inline-flex items-center gap-1 text-sm font-medium text-[#007AFF] hover:opacity-80 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Chat</span>
              </button>
            )}
          </div>

          {/* Center Zone: MUSTAPHA AI STUDIO Brand Mark (Matching Mockup 1) */}
          <div className="flex items-center justify-center min-w-0">
            <BrandLogo size="sm" stacked={true} />
          </div>

          {/* Right Zone: Language, Theme & Circular "MI" Profile Avatar with Status Dot */}
          <div className="flex items-center gap-2 shrink-0">
            <select
              aria-label={t.languageLabel}
              value={lang}
              onChange={(e) => setLang(e.target.value === 'ha' ? 'ha' : 'en')}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold cursor-pointer border ${
                isDark
                  ? 'bg-[#1C1C1E] border-white/[0.1] text-[#F2F2F7]'
                  : 'bg-[#EFEFF4] border-black/[0.06] text-[#1C1C1E]'
              }`}
            >
              <option value="en">EN</option>
              <option value="ha">HA</option>
            </select>

            <button
              type="button"
              onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
              aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
              className={`w-8 h-8 rounded-full flex items-center justify-center border transition-colors cursor-pointer ${
                isDark
                  ? 'border-white/[0.1] bg-[#1C1C1E] hover:bg-[#2C2C2E] text-[#F2F2F7]'
                  : 'border-black/[0.06] bg-[#EFEFF4] hover:bg-[#E5E5EA] text-[#1C1C1E]'
              }`}
            >
              {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('settings')}
              aria-label="Account and Settings"
              className="relative w-9 h-9 rounded-full bg-[#3A4D59] hover:bg-[#2E3F4A] text-white font-semibold text-xs flex items-center justify-center shadow-xs cursor-pointer shrink-0"
            >
              <span>{userInitials}</span>
              <span
                aria-hidden="true"
                className="w-2.5 h-2.5 rounded-full bg-[#34C759] border-2 border-white dark:border-black absolute -bottom-0.5 -right-0.5"
              />
            </button>
          </div>
        </header>

        {/* WORKSPACE VIEWPORT */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {/* 1. iOS AI CHAT & PERSONAL ASSISTANT HOME (Matching Mockup 1) */}
          {activeSection === 'chat' && (
            <div className="max-w-3xl mx-auto flex flex-col min-h-full justify-between gap-6">
              <div className="space-y-6 pt-2 pb-4">
                {/* Centered Greeting & iOS Quick-Action List (Matching Mockup 1) */}
                <div className="text-center space-y-2 pt-2">
                  <h1
                    className="font-display text-2xl sm:text-3xl font-bold tracking-tight"
                    style={{ textWrap: 'balance' }}
                  >
                    {lang === 'ha' ? 'Sannu, Mustapha 👋' : 'Hello, Mustapha 👋'}
                  </h1>
                  <p
                    className={`text-sm sm:text-base max-w-md mx-auto leading-snug ${
                      isDark ? 'text-[#8E8E93]' : 'text-[#636366]'
                    }`}
                  >
                    {t.welcomeSubtitle}
                  </p>
                </div>

                {/* iOS Rounded Action Rows (Create an image or sticker, Write or edit, Universal Master Prompt Studio) */}
                <div className="space-y-2.5 max-w-xl mx-auto w-full">
                  <button
                    type="button"
                    onClick={() => setActiveSection('image-gen')}
                    className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border transition-all cursor-pointer shadow-2xs active:scale-[0.99] ${
                      isDark
                        ? 'bg-[#1C1C1E] border-white/[0.08] hover:bg-[#2C2C2E]'
                        : 'bg-white border-black/[0.06] hover:bg-black/[0.01]'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <ImageIcon className="w-5 h-5 text-[#14967F] shrink-0" />
                      <span className="text-[15px] font-medium">
                        {lang === 'ha'
                          ? 'Samar da hoto ko sticker'
                          : 'Create an image or sticker'}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-40 shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      composerInputRef.current?.focus();
                    }}
                    className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border transition-all cursor-pointer shadow-2xs active:scale-[0.99] ${
                      isDark
                        ? 'bg-[#1C1C1E] border-white/[0.08] hover:bg-[#2C2C2E]'
                        : 'bg-white border-black/[0.06] hover:bg-black/[0.01]'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <PenLine className="w-5 h-5 text-[#14967F] shrink-0" />
                      <span className="text-[15px] font-medium">
                        {lang === 'ha' ? 'Rubuta ko gyara rubutu' : 'Write or edit'}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-40 shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSection('studio')}
                    className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border transition-all cursor-pointer shadow-2xs active:scale-[0.99] ${
                      isDark
                        ? 'bg-[#1C1C1E] border-white/[0.08] hover:bg-[#2C2C2E]'
                        : 'bg-white border-black/[0.06] hover:bg-black/[0.01]'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <Wand2 className="w-5 h-5 text-[#1C1C1E] dark:text-[#F2F2F7] shrink-0" />
                      <span className="text-[15px] font-medium">
                        Universal Master Prompt Studio
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-40 shrink-0" />
                  </button>
                </div>

                {/* iOS Conversation Message Bubbles Thread */}
                {activeConversation && activeConversation.messages.length > 0 && (
                  <div className="space-y-4 pt-2 max-w-2xl mx-auto w-full">
                    {activeConversation.messages.map((msg) => {
                      const isUser = msg.role === 'user';
                      return (
                        <div
                          key={msg.id}
                          data-testid={`chat-msg-${msg.role}`}
                          className={`flex flex-col ${
                            isUser ? 'items-end' : 'items-start'
                          }`}
                        >
                          <div
                            className={`relative px-4 py-3 text-[15px] leading-relaxed transition-all ${
                              isUser
                                ? 'bg-[#2B5B73] dark:bg-[#0A84FF] text-white rounded-[22px] rounded-br-[6px] max-w-[85%] sm:max-w-[75%] shadow-xs'
                                : isDark
                                ? 'bg-[#1C1C1E] text-[#F2F2F7] border border-white/[0.07] rounded-[22px] rounded-bl-[6px] max-w-[90%] sm:max-w-[82%]'
                                : 'bg-[#E9E9EB] text-[#1C1C1E] rounded-[22px] rounded-bl-[6px] max-w-[90%] sm:max-w-[82%]'
                            }`}
                          >
                            {editingMessageId === msg.id ? (
                              <div className="space-y-2 min-w-[240px]">
                                <textarea
                                  rows={3}
                                  value={editingContent}
                                  onChange={(e) => setEditingContent(e.target.value)}
                                  className="w-full rounded-xl border border-white/20 bg-black/20 p-2.5 text-sm text-white focus:outline-none"
                                />
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setEditingMessageId(null)}
                                    className="px-3 py-1 text-xs rounded-full bg-white/15 text-white cursor-pointer"
                                  >
                                    {t.cancel}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditedMessage(msg.id)}
                                    className="px-3 py-1 text-xs rounded-full bg-white text-[#1C1C1E] font-semibold cursor-pointer"
                                  >
                                    {t.saveAndRegenerate}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="whitespace-pre-wrap">
                                {msg.content || (isStreamingChat ? t.thinking : '')}
                              </div>
                            )}

                            {msg.groundingSources && msg.groundingSources.length > 0 && (
                              <div className="mt-2.5 pt-2.5 border-t border-black/10 dark:border-white/10 text-xs space-y-1">
                                <div className="font-semibold opacity-75">
                                  Web Sources:
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {msg.groundingSources.map((src, i) => (
                                    <a
                                      key={i}
                                      href={src.uri}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 text-[#007AFF] dark:text-[#5AC8FA] hover:underline"
                                    >
                                      <span>{src.title}</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Subtle Action Row Below Bubble */}
                          <div className="flex items-center gap-3 mt-1 px-2 text-[11px] opacity-65">
                            {isUser ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingMessageId(msg.id);
                                  setEditingContent(msg.content);
                                }}
                                aria-label={t.edit}
                                className="hover:opacity-100 inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>{t.edit}</span>
                              </button>
                            ) : (
                              msg.content && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleSpeakChatMessage(msg)}
                                    aria-label={
                                      speakingMessageId === msg.id ? t.stopSpeech : t.readAloud
                                    }
                                    className="hover:opacity-100 inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    {speakingMessageId === msg.id ? (
                                      <Square className="w-3 h-3 text-red-500" />
                                    ) : (
                                      <Volume2 className="w-3 h-3" />
                                    )}
                                    <span>
                                      {speakingMessageId === msg.id ? t.stopSpeech : t.readAloud}
                                    </span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(msg.content);
                                      setCopiedMessageId(msg.id);
                                      setTimeout(() => setCopiedMessageId(null), 1500);
                                    }}
                                    aria-label={t.copy}
                                    className="hover:opacity-100 inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    {copiedMessageId === msg.id ? (
                                      <Check className="w-3 h-3 text-[#34C759]" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                    <span>{copiedMessageId === msg.id ? t.copied : t.copy}</span>
                                  </button>
                                </>
                              )
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {activeConversation.messages.length > 0 && !isStreamingChat && (
                      <div className="flex items-center justify-start pt-1">
                        <button
                          type="button"
                          onClick={handleRegenerateLastResponse}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium cursor-pointer ${
                            isDark
                              ? 'bg-[#1C1C1E] hover:bg-[#2C2C2E] text-[#8E8E93]'
                              : 'bg-white/80 hover:bg-white text-[#636366] shadow-2xs'
                          }`}
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>{t.regenerateResponse}</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* BOTTOM PILL COMPOSER & iMESSAGE STYLE '+' POPUP MENU (Matching Mockup 1) */}
              <div className="sticky bottom-0 pb-1 pt-2 z-30 max-w-2xl mx-auto w-full space-y-2 relative">
                {/* Hidden File Inputs Bound to Existing Upload Handler */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleUploadChatAttachment}
                  className="hidden"
                />
                <input
                  ref={photosInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleUploadChatAttachment}
                  className="hidden"
                />
                <input
                  ref={filesInputRef}
                  type="file"
                  accept="image/*,application/pdf,text/plain"
                  onChange={handleUploadChatAttachment}
                  className="hidden"
                />

                {chatError && (
                  <div
                    role="alert"
                    className="p-3 rounded-2xl border border-red-500/40 bg-red-500/10 text-xs text-red-600 dark:text-red-300 flex items-center justify-between gap-3 ios-glass"
                  >
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{chatError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRegenerateLastResponse}
                      className="px-3 py-1 rounded-full bg-[#FF3B30] text-white font-semibold hover:opacity-90 shrink-0 cursor-pointer"
                    >
                      {t.retry}
                    </button>
                  </div>
                )}

                {/* Active Attachment or Mode Indicators */}
                {(pendingAttachment || enableThinking || enableSearch) && (
                  <div className="flex flex-wrap items-center gap-2 px-2">
                    {pendingAttachment && (
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#14967F]/15 text-[#0F6E66] dark:text-[#2DD4BF] text-xs font-medium">
                        <Paperclip className="w-3 h-3" />
                        <span className="truncate max-w-[180px]">{pendingAttachment.name}</span>
                        <button
                          type="button"
                          onClick={() => setPendingAttachment(null)}
                          className="text-[#FF3B30] hover:underline ml-1 cursor-pointer"
                        >
                          ×
                        </button>
                      </div>
                    )}
                    {enableThinking && (
                      <button
                        type="button"
                        onClick={() => setEnableThinking(false)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#007AFF]/15 text-[#007AFF] dark:text-[#5AC8FA] text-xs font-medium cursor-pointer"
                      >
                        <Brain className="w-3 h-3" />
                        <span>Deep Reasoning: On ×</span>
                      </button>
                    )}
                    {enableSearch && (
                      <button
                        type="button"
                        onClick={() => setEnableSearch(false)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#34C759]/15 text-[#248A3D] dark:text-[#30D158] text-xs font-medium cursor-pointer"
                      >
                        <Globe className="w-3 h-3" />
                        <span>Web Search: On ×</span>
                      </button>
                    )}
                  </div>
                )}

                {/* iOS Popup Action Sheet Menu (Floating above the '+' button) */}
                {plusMenuOpen && (
                  <div
                    role="menu"
                    aria-label="Attachment and AI Tools Menu"
                    className={`absolute bottom-full left-0 mb-2.5 z-40 w-64 rounded-[24px] py-2 shadow-2xl border ios-glass transition-all ${
                      isDark
                        ? 'bg-[#1C1C1E]/95 border-white/[0.12] text-[#F2F2F7]'
                        : 'bg-white/95 border-black/[0.08] text-[#1C1C1E]'
                    }`}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setPlusMenuOpen(false);
                        cameraInputRef.current?.click();
                      }}
                      className="w-full flex items-center gap-3.5 px-4 py-2.5 text-[15px] font-medium hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer text-left"
                    >
                      <span
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          isDark ? 'bg-[#2C2C2E]' : 'bg-[#F2F2F7]'
                        }`}
                      >
                        <Camera className="w-4 h-4" />
                      </span>
                      <span>Camera</span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setPlusMenuOpen(false);
                        photosInputRef.current?.click();
                      }}
                      className="w-full flex items-center gap-3.5 px-4 py-2.5 text-[15px] font-medium hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer text-left"
                    >
                      <span
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          isDark ? 'bg-[#2C2C2E]' : 'bg-[#F2F2F7]'
                        }`}
                      >
                        <ImageIcon className="w-4 h-4" />
                      </span>
                      <span>Photos</span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setPlusMenuOpen(false);
                        filesInputRef.current?.click();
                      }}
                      className="w-full flex items-center gap-3.5 px-4 py-2.5 text-[15px] font-medium hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer text-left"
                    >
                      <span
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          isDark ? 'bg-[#2C2C2E]' : 'bg-[#F2F2F7]'
                        }`}
                      >
                        <Paperclip className="w-4 h-4" />
                      </span>
                      <span>Files</span>
                    </button>

                    <div
                      className={`my-1.5 border-t ${
                        isDark ? 'border-white/[0.1]' : 'border-black/[0.08]'
                      }`}
                    />

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setEnableThinking((v) => !v);
                        setPlusMenuOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-[15px] font-medium hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-3.5">
                        <span
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            enableThinking
                              ? 'bg-[#007AFF] text-white'
                              : isDark
                              ? 'bg-[#2C2C2E]'
                              : 'bg-[#F2F2F7]'
                          }`}
                        >
                          <Brain className="w-4 h-4" />
                        </span>
                        <span>Deep Reasoning</span>
                      </div>
                      {enableThinking && <Check className="w-4 h-4 text-[#007AFF]" />}
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setEnableSearch((v) => !v);
                        setPlusMenuOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-[15px] font-medium hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-3.5">
                        <span
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            enableSearch
                              ? 'bg-[#34C759] text-white'
                              : isDark
                              ? 'bg-[#2C2C2E]'
                              : 'bg-[#F2F2F7]'
                          }`}
                        >
                          <Globe className="w-4 h-4" />
                        </span>
                        <span>Web Search</span>
                      </div>
                      {enableSearch && <Check className="w-4 h-4 text-[#34C759]" />}
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setPlusMenuOpen(false);
                        setActiveSection('studio');
                      }}
                      className="w-full flex items-center gap-3.5 px-4 py-2.5 text-[15px] font-medium hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer text-left"
                    >
                      <span
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          isDark ? 'bg-[#2C2C2E]' : 'bg-[#F2F2F7]'
                        }`}
                      >
                        <Gauge className="w-4 h-4" />
                      </span>
                      <span>Plugins</span>
                    </button>
                  </div>
                )}

                {/* Fixed-Bottom Pill-Shaped Composer (Left to Right: '+', Text Input, Mic, Circular Upward Arrow) */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setPlusMenuOpen(false);
                    handleSendChatMessage();
                  }}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-full border shadow-lg ios-glass transition-all ${
                    isDark
                      ? 'bg-[#1C1C1E]/95 border-white/[0.12]'
                      : 'bg-white/95 border-black/[0.08]'
                  }`}
                >
                  <button
                    type="button"
                    aria-label="Open attachment and tools menu"
                    aria-expanded={plusMenuOpen}
                    onClick={() => setPlusMenuOpen((prev) => !prev)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform cursor-pointer ${
                      isDark
                        ? 'bg-[#2C2C2E] hover:bg-[#3A3A3C] text-[#F2F2F7]'
                        : 'bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#1C1C1E]'
                    }`}
                  >
                    <Plus
                      className={`w-5 h-5 transition-transform duration-150 ${
                        plusMenuOpen ? 'rotate-45' : ''
                      }`}
                    />
                  </button>

                  <input
                    ref={composerInputRef}
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={t.chatPlaceholder}
                    aria-label="Ask Mustapha AI"
                    className={`flex-1 bg-transparent px-1 py-2 text-[15px] focus:outline-none ${
                      isDark
                        ? 'text-[#F2F2F7] placeholder-[#8E8E93]'
                        : 'text-[#1C1C1E] placeholder-[#8E8E93]'
                    }`}
                  />

                  <button
                    type="button"
                    onClick={() => setActiveSection('voice')}
                    aria-label="Voice input"
                    title={t.navVoice}
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 opacity-75 hover:opacity-100 cursor-pointer"
                  >
                    <Mic className="w-5 h-5" />
                  </button>

                  {isStreamingChat ? (
                    <button
                      type="button"
                      onClick={handleStopGeneration}
                      aria-label={t.stopGenerating}
                      className="w-10 h-10 rounded-full bg-[#FF3B30] hover:opacity-90 text-white flex items-center justify-center shrink-0 cursor-pointer"
                    >
                      <Square className="w-4 h-4 fill-current" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!chatInput.trim()}
                      aria-label={t.sendMessage}
                      className="w-10 h-10 rounded-full bg-[#245263] dark:bg-[#0A84FF] hover:opacity-95 text-white flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-40 transition-opacity"
                    >
                      <ArrowUp className="w-5 h-5 stroke-[2.4]" />
                    </button>
                  )}
                </form>
              </div>
            </div>
          )}

          {/* 2. IMAGE GENERATOR */}
          {activeSection === 'image-gen' && (
            <MediaGeneratorStudio
              theme={theme}
              lang={lang}
              initialTab="image"
              savedMedia={savedMedia}
              onSaveMedia={handleSaveGeneratedMedia}
              onDeleteMedia={handleDeleteMedia}
              onSavePromptToLibrary={async (promptText, category) => {
                await handleSaveMasterPrompt({
                  name: `${category} Prompt (${new Date().toLocaleDateString()})`,
                  description: 'Saved from Image Generator Studio',
                  category,
                  promptText,
                  outputLanguage: lang === 'ha' ? 'Hausa' : 'English',
                  outputType: 'Image prompt',
                  targetPlatform: 'Gemini Image Generator',
                  desiredLength: 'Medium (200-350 words)',
                  characterLimit: 0,
                  exactCharCount: false
                });
              }}
              onRecordUsage={handleRecordUsage}
            />
          )}

          {/* 3. VIDEO GENERATOR */}
          {activeSection === 'video-gen' && (
            <MediaGeneratorStudio
              theme={theme}
              lang={lang}
              initialTab="video"
              savedMedia={savedMedia}
              onSaveMedia={handleSaveGeneratedMedia}
              onDeleteMedia={handleDeleteMedia}
              onRecordUsage={handleRecordUsage}
            />
          )}

          {/* 4. IMAGE ANALYZER */}
          {activeSection === 'vision' && (
            <VisionStudio
              theme={theme}
              lang={lang}
              onSendPromptToStudio={(promptText) => {
                setSelectedPromptForStudio({
                  ...STARTER_MASTER_PROMPTS[1],
                  id: `extracted-${Date.now()}`,
                  name: 'Extracted Vision Master Prompt',
                  promptText
                });
                setActiveSection('studio');
              }}
              onRecordUsage={handleRecordUsage}
            />
          )}

          {/* 5. MASTER PROMPT STUDIO */}
          {activeSection === 'studio' && (
            <MasterPromptStudio
              savedPrompts={savedPrompts}
              selectedPrompt={selectedPromptForStudio}
              onSelectPrompt={(p) => setSelectedPromptForStudio(p as SavedMasterPrompt)}
              onSavePrompt={handleSaveMasterPrompt}
              onSendResultToChat={(output) => {
                setActiveSection('chat');
                setChatInput(output);
              }}
              selectedModel={selectedModel}
              theme={theme}
              lang={lang}
              onRecordUsage={handleRecordUsage}
              currentUserId={firebaseUser?.uid || null}
            />
          )}

          {/* 6. VOICE ASSISTANT */}
          {activeSection === 'voice' && (
            <VoiceAssistantStudio
              theme={theme}
              lang={lang}
              onRecordUsage={handleRecordUsage}
            />
          )}

          {/* 7. SAVED PROMPTS LIBRARY */}
          {activeSection === 'library' && (
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl font-bold tracking-tight">
                    {t.savedPromptsTitle}
                  </h2>
                  <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    {t.savedPromptsSubtitle}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 opacity-50" />
                    <input
                      type="text"
                      value={librarySearch}
                      onChange={(e) => setLibrarySearch(e.target.value)}
                      placeholder={t.searchPrompts}
                      aria-label={t.searchPrompts}
                      className={`pl-8 pr-3 py-2 rounded-lg border text-xs ${
                        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Category Filter Bar */}
              <div className="flex flex-wrap gap-1.5">
                {['All', ...PROMPT_CATEGORIES].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setLibraryCategoryFilter(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                      libraryCategoryFilter === cat
                        ? 'bg-teal-600 text-white border-teal-600'
                        : isDark
                        ? 'bg-slate-900 border-slate-800 text-slate-300'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredLibraryPrompts.map((p) => (
                  <div
                    key={p.id}
                    className={`p-5 rounded-xl border flex flex-col justify-between space-y-4 ${
                      isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="text-xs font-mono text-teal-600 dark:text-teal-400">
                        {p.category} · {p.targetPlatform}
                      </div>
                      <h3 className="font-display text-base font-bold">{p.name}</h3>
                      <p className="text-xs opacity-75">{p.description}</p>
                      <pre
                        className={`p-3 rounded-lg border text-[11px] font-mono line-clamp-3 whitespace-pre-wrap ${
                          isDark
                            ? 'bg-slate-950 border-slate-800 text-slate-300'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        {p.promptText}
                      </pre>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPromptForStudio(p);
                          setActiveSection('studio');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-medium cursor-pointer"
                      >
                        {t.useMasterPrompt}
                      </button>

                      <div className="flex items-center gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => setEditingPromptInLibrary(p)}
                          className="px-2.5 py-1 rounded border border-slate-500/30 hover:bg-slate-500/10 cursor-pointer"
                        >
                          {t.edit}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicatePrompt(p)}
                          className="px-2.5 py-1 rounded border border-slate-500/30 hover:bg-slate-500/10 cursor-pointer"
                        >
                          {t.duplicatePrompt}
                        </button>
                        {!p.id.startsWith('starter-') && (
                          <button
                            type="button"
                            onClick={() => handleDeletePrompt(p.id)}
                            className="px-2.5 py-1 rounded border border-red-500/30 text-red-500 hover:bg-red-500/10 cursor-pointer"
                          >
                            {t.deletePrompt}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Edit Saved Master Prompt Modal */}
              {editingPromptInLibrary && (
                <div
                  role="dialog"
                  aria-modal="true"
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
                >
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleUpdatePromptInLibrary(editingPromptInLibrary);
                    }}
                    className={`max-w-lg w-full rounded-xl border p-6 space-y-4 ${
                      isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
                    }`}
                  >
                    <h3 className="font-display text-base font-bold">
                      {t.edit} Master Prompt
                    </h3>
                    <div>
                      <label className="block text-xs font-medium mb-1">Name</label>
                      <input
                        type="text"
                        required
                        value={editingPromptInLibrary.name}
                        onChange={(e) =>
                          setEditingPromptInLibrary({
                            ...editingPromptInLibrary,
                            name: e.target.value
                          })
                        }
                        className={`w-full rounded-lg border px-3 py-2 text-xs ${
                          isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-300'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Description</label>
                      <input
                        type="text"
                        value={editingPromptInLibrary.description}
                        onChange={(e) =>
                          setEditingPromptInLibrary({
                            ...editingPromptInLibrary,
                            description: e.target.value
                          })
                        }
                        className={`w-full rounded-lg border px-3 py-2 text-xs ${
                          isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-300'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Master Prompt Instructions</label>
                      <textarea
                        rows={5}
                        required
                        value={editingPromptInLibrary.promptText}
                        onChange={(e) =>
                          setEditingPromptInLibrary({
                            ...editingPromptInLibrary,
                            promptText: e.target.value
                          })
                        }
                        className={`w-full rounded-lg border p-3 text-xs font-mono ${
                          isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-300'
                        }`}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingPromptInLibrary(null)}
                        className="px-3.5 py-2 text-xs rounded-lg border border-slate-500/30 cursor-pointer"
                      >
                        {t.cancel}
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 text-xs font-medium rounded-lg bg-teal-600 text-white hover:bg-teal-500 cursor-pointer"
                      >
                        {t.savePreferences}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* 8. CHAT HISTORY */}
          {activeSection === 'history' && (
            <div className="max-w-5xl mx-auto space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl font-bold tracking-tight">
                    {t.historyTitle}
                  </h2>
                  <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    {t.historySubtitle}
                  </p>
                </div>
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search conversation titles..."
                  aria-label="Search conversation titles"
                  className={`px-3 py-2 rounded-lg border text-xs ${
                    isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
                  }`}
                />
              </div>

              <div className="space-y-3">
                {filteredConversations.map((c) => (
                  <div
                    key={c.id}
                    className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="space-y-1 flex-1">
                      {renamingConvId === c.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={renamingTitle}
                            onChange={(e) => setRenamingTitle(e.target.value)}
                            className={`px-2.5 py-1 rounded border text-xs ${
                              isDark ? 'bg-slate-950 border-slate-700' : 'bg-white border-slate-300'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (renamingTitle.trim()) {
                                setConversations((prev) =>
                                  prev.map((item) =>
                                    item.id === c.id
                                      ? { ...item, title: renamingTitle.trim() }
                                      : item
                                  )
                                );
                              }
                              setRenamingConvId(null);
                            }}
                            className="px-2.5 py-1 rounded bg-teal-600 text-white text-xs cursor-pointer"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <div className="font-display font-semibold text-sm">
                          {c.title} {c.archived && <span className="opacity-60">(Archived)</span>}
                        </div>
                      )}
                      <div className="text-xs font-mono opacity-65 tabular-nums">
                        Model: {c.model} · {c.messages.length} messages · Updated{' '}
                        {new Date(c.updatedAt).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveConversationId(c.id);
                          setActiveSection('chat');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-medium cursor-pointer"
                      >
                        {t.reopenChat}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingConvId(c.id);
                          setRenamingTitle(c.title);
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-500/30 text-xs inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{t.edit}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setConversations((prev) =>
                            prev.map((item) =>
                              item.id === c.id ? { ...item, archived: !item.archived } : item
                            )
                          )
                        }
                        className="px-2.5 py-1.5 rounded-lg border border-slate-500/30 text-xs inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        <span>{c.archived ? 'Unarchive' : t.archive}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteConvId(c.id)}
                        className="px-2.5 py-1.5 rounded-lg border border-red-500/30 text-red-500 text-xs inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{t.delete}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Confirmation Modal Before Deleting a Conversation */}
              {confirmDeleteConvId && (
                <div
                  role="dialog"
                  aria-modal="true"
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
                >
                  <div
                    className={`max-w-sm w-full rounded-xl border p-6 space-y-4 ${
                      isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
                    }`}
                  >
                    <h3 className="font-display text-base font-bold text-red-500">
                      {t.confirmDeleteTitle}
                    </h3>
                    <p className="text-xs opacity-80">
                      {lang === 'ha'
                        ? 'Wannan matakin zai goge wannan tattaunawar gaba daya.'
                        : 'This conversation will be removed from your history.'}
                    </p>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteConvId(null)}
                        className="px-3.5 py-2 text-xs rounded-lg border border-slate-500/30 cursor-pointer"
                      >
                        {t.cancel}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConversations((prev) =>
                            prev.filter((item) => item.id !== confirmDeleteConvId)
                          );
                          if (activeConversationId === confirmDeleteConvId) {
                            setActiveConversationId(null);
                          }
                          setConfirmDeleteConvId(null);
                        }}
                        className="px-4 py-2 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-500 cursor-pointer"
                      >
                        {t.delete}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 9. ACCOUNT AND SETTINGS (iOS SETTINGS APP INSET GROUPED LAYOUT) */}
          {activeSection === 'settings' && (
            <div className="max-w-2xl mx-auto space-y-6 pb-8">
              {/* Top Navigation Row: Back Arrow on Left + Centered Title */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setActiveSection('chat')}
                  className="inline-flex items-center gap-1 text-[15px] font-medium text-[#007AFF] hover:opacity-80 cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span>Back</span>
                </button>
                <h2 className="font-display text-lg font-semibold tracking-tight">
                  {t.settingsTitle}
                </h2>
                <div className="w-14" aria-hidden="true" />
              </div>

              {/* Centered User Profile Avatar with Edit Icon */}
              <div className="flex flex-col items-center text-center space-y-2.5 py-2">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#5856D6] to-[#7D7AFF] text-white font-display font-bold text-3xl flex items-center justify-center shadow-md select-none">
                    {userInitials}
                  </div>
                  <button
                    type="button"
                    onClick={() => displayNameInputRef.current?.focus()}
                    aria-label="Edit profile name"
                    className={`w-8 h-8 rounded-full flex items-center justify-center shadow-md border absolute -bottom-0.5 -right-0.5 cursor-pointer ${
                      isDark
                        ? 'bg-[#2C2C2E] border-white/15 text-white'
                        : 'bg-white border-black/10 text-[#1C1C1E]'
                    }`}
                  >
                    <PenLine className="w-3.5 h-3.5 text-[#007AFF]" />
                  </button>
                </div>
                <div>
                  <h3 className="font-display text-xl font-bold tracking-tight">
                    {userFullName}
                  </h3>
                  <p className="text-xs text-[#8E8E93]">
                    {firebaseUser?.email || 'mustaphailiya895@gmail.com · Mustapha AI Studio'}
                  </p>
                </div>
              </div>

              {settingsSavedBanner && (
                <div
                  role="status"
                  className="p-3 rounded-2xl bg-[#34C759]/15 border border-[#34C759]/30 text-center text-xs font-semibold text-[#248A3D] dark:text-[#30D158]"
                >
                  {lang === 'ha'
                    ? 'An adana saituna cikin nasara!'
                    : 'Preferences saved to Mustapha AI Studio!'}
                </div>
              )}

              {/* GROUP 1: PERSONALIZATION (iOS Inset Grouped Card) */}
              <div className="space-y-1.5">
                <div className="px-4 text-[11px] font-semibold tracking-wider uppercase text-[#8E8E93]">
                  Personalization
                </div>
                <div
                  className={`rounded-2xl overflow-hidden border divide-y ${
                    isDark
                      ? 'bg-[#1C1C1E] border-white/[0.08] divide-white/[0.08]'
                      : 'bg-white border-black/[0.06] divide-black/[0.06] shadow-2xs'
                  }`}
                >
                  {/* Display Name Row */}
                  <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                    <label
                      htmlFor="settings-display-name"
                      className="text-[15px] font-medium shrink-0"
                    >
                      {t.displayNameLabel}
                    </label>
                    <input
                      ref={displayNameInputRef}
                      id="settings-display-name"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="text-[15px] text-right bg-transparent text-[#8E8E93] focus:text-[#007AFF] focus:outline-none w-full max-w-[220px]"
                    />
                  </div>

                  {/* Language Selector Row */}
                  <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                    <label
                      htmlFor="settings-language-select"
                      className="text-[15px] font-medium shrink-0"
                    >
                      {t.languageLabel}
                    </label>
                    <div className="flex items-center gap-1.5">
                      <select
                        id="settings-language-select"
                        value={lang}
                        onChange={(e) => setLang(e.target.value === 'ha' ? 'ha' : 'en')}
                        className="text-[15px] bg-transparent text-[#007AFF] font-medium focus:outline-none cursor-pointer text-right"
                      >
                        <option value="en">English</option>
                        <option value="ha">Hausa</option>
                      </select>
                      <ChevronRight className="w-4 h-4 text-[#8E8E93]" />
                    </div>
                  </div>

                  {/* Default AI Model Selector Row */}
                  <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                    <label
                      htmlFor="settings-default-model"
                      className="text-[15px] font-medium shrink-0"
                    >
                      {t.defaultModelLabel}
                    </label>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <select
                        id="settings-default-model"
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="text-[14px] bg-transparent text-[#007AFF] font-medium focus:outline-none cursor-pointer text-right truncate max-w-[210px]"
                      >
                        {chatCapableModels.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.displayName}
                          </option>
                        ))}
                      </select>
                      <ChevronRight className="w-4 h-4 text-[#8E8E93] shrink-0" />
                    </div>
                  </div>

                  {/* Custom Assistant Instructions Row */}
                  <div className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="settings-custom-instructions"
                        className="text-[15px] font-medium"
                      >
                        {t.customInstructionsLabel}
                      </label>
                      <button
                        type="button"
                        onClick={async () => {
                          localStorage.setItem('mustapha_language', lang);
                          localStorage.setItem('mustapha_theme', theme);
                          setSettingsSavedBanner(true);
                          setTimeout(() => setSettingsSavedBanner(false), 2000);
                          if (firebaseUser) {
                            await updateUserProfileSettings(firebaseUser.uid, {
                              displayName,
                              theme,
                              language: lang,
                              defaultModel: selectedModel,
                              customInstructions
                            });
                          }
                        }}
                        className="px-3.5 py-1 rounded-full bg-[#007AFF] hover:opacity-90 text-white text-xs font-semibold cursor-pointer"
                      >
                        {t.savePreferences}
                      </button>
                    </div>
                    <textarea
                      id="settings-custom-instructions"
                      rows={3}
                      value={customInstructions}
                      onChange={(e) => setCustomInstructions(e.target.value)}
                      className={`w-full rounded-xl border p-3 text-xs leading-relaxed focus:outline-none ${
                        isDark
                          ? 'bg-[#2C2C2E] border-white/[0.08] text-[#F2F2F7]'
                          : 'bg-[#F2F2F7] border-black/[0.06] text-[#1C1C1E]'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* GROUP 2: ACCOUNT (iOS Inset Grouped Card) */}
              <div className="space-y-1.5">
                <div className="px-4 text-[11px] font-semibold tracking-wider uppercase text-[#8E8E93]">
                  Account
                </div>
                <div
                  className={`rounded-2xl overflow-hidden border divide-y ${
                    isDark
                      ? 'bg-[#1C1C1E] border-white/[0.08] divide-white/[0.08]'
                      : 'bg-white border-black/[0.06] divide-black/[0.06] shadow-2xs'
                  }`}
                >
                  <div className="flex items-center justify-between px-4 py-3.5">
                    <span className="text-[15px] font-medium">Workspace Owner</span>
                    <span className="text-[14px] text-[#8E8E93]">Mustapha Iliya</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveSection('library')}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.04] cursor-pointer text-left"
                  >
                    <span className="text-[15px] font-medium">{t.navSavedPrompts}</span>
                    <div className="flex items-center gap-1.5 text-[14px] text-[#8E8E93] font-mono tabular-nums">
                      <span>{savedPrompts.length}</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSection('files')}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.04] cursor-pointer text-left"
                  >
                    <span className="text-[15px] font-medium">{t.navFiles}</span>
                    <div className="flex items-center gap-1.5 text-[14px] text-[#8E8E93] font-mono tabular-nums">
                      <span>{savedMedia.length + uploadedFiles.length}</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSection('models')}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.04] cursor-pointer text-left"
                  >
                    <span className="text-[15px] font-medium">{t.navModels}</span>
                    <div className="flex items-center gap-1.5 text-[14px] text-[#8E8E93]">
                      <span>Configure</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </button>
                </div>
              </div>

              {/* GROUP 3: GENERAL (iOS Inset Grouped Card) */}
              <div className="space-y-1.5">
                <div className="px-4 text-[11px] font-semibold tracking-wider uppercase text-[#8E8E93]">
                  General
                </div>
                <div
                  className={`rounded-2xl overflow-hidden border divide-y ${
                    isDark
                      ? 'bg-[#1C1C1E] border-white/[0.08] divide-white/[0.08]'
                      : 'bg-white border-black/[0.06] divide-black/[0.06] shadow-2xs'
                  }`}
                >
                  {/* Appearance Mode Row */}
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-[15px] font-medium">Appearance</span>
                    <div
                      className={`inline-flex p-1 rounded-xl ${
                        isDark ? 'bg-[#2C2C2E]' : 'bg-[#EFEFF4]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setTheme('light')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          !isDark
                            ? 'bg-white text-[#1C1C1E] shadow-xs'
                            : 'text-[#8E8E93] hover:text-white'
                        }`}
                      >
                        Light
                      </button>
                      <button
                        type="button"
                        onClick={() => setTheme('dark')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          isDark
                            ? 'bg-[#1C1C1E] text-white shadow-xs'
                            : 'text-[#8E8E93] hover:text-[#1C1C1E]'
                        }`}
                      >
                        Dark
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveSection('help')}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.04] cursor-pointer text-left"
                  >
                    <span className="text-[15px] font-medium">{t.navHelp}</span>
                    <ChevronRight className="w-4 h-4 text-[#8E8E93]" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setConversations([]);
                      setSavedMedia([]);
                      setUploadedFiles([]);
                    }}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.04] cursor-pointer text-left"
                  >
                    <span className="text-[15px] font-medium text-[#007AFF]">
                      {t.clearLocalHistory}
                    </span>
                  </button>
                </div>
              </div>

              {/* BOTTOM DESTRUCTIVE GROUP: LOG OUT & DELETE ACCOUNT (iOS Red List Items) */}
              <div
                className={`rounded-2xl overflow-hidden border divide-y ${
                  isDark
                    ? 'bg-[#1C1C1E] border-white/[0.08] divide-white/[0.08]'
                    : 'bg-white border-black/[0.06] divide-black/[0.06] shadow-2xs'
                }`}
              >
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full px-4 py-3.5 text-center text-[15px] font-semibold text-[#FF3B30] hover:bg-[#FF3B30]/5 transition-colors cursor-pointer"
                >
                  Log out
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteAccountModal(true)}
                  className="w-full px-4 py-3 text-center text-xs font-medium text-[#FF3B30]/80 hover:bg-[#FF3B30]/5 transition-colors cursor-pointer"
                >
                  {t.deleteAccountBtn}
                </button>
              </div>
            </div>
          )}

          {/* 10. BIOSCIENCE WORKBENCH */}
          {activeSection === 'bioscience' && (
            <BioscienceWorkbench theme={theme} onRecordUsage={handleRecordUsage} />
          )}

          {/* 11. MY FILES & SAVED MEDIA */}
          {activeSection === 'files' && (
            <div className="max-w-5xl mx-auto space-y-6">
              <div>
                <h2 className="font-display text-2xl font-bold tracking-tight">
                  My Files &amp; Saved Generations
                </h2>
                <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Private workspace repository for your uploaded attachments and AI-generated
                  images.
                </p>
              </div>

              {uploadedFiles.length === 0 && savedMedia.length === 0 ? (
                <div
                  className={`p-12 rounded-xl border text-center space-y-3 ${
                    isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                  }`}
                >
                  <FolderOpen className="w-8 h-8 text-teal-500 mx-auto" />
                  <h3 className="font-display text-sm font-semibold">
                    Your private file vault is empty
                  </h3>
                  <p className="text-xs opacity-70 max-w-sm mx-auto">
                    Files you attach in AI Chat or images you create in the AI Image
                    Generator will appear here.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveSection('image-gen')}
                    className="px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-medium cursor-pointer"
                  >
                    {t.navImageGen}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {savedMedia.map((m) => (
                    <div
                      key={m.id}
                      className={`p-4 rounded-xl border space-y-2 ${
                        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                      }`}
                    >
                      <img
                        src={m.previewData}
                        alt={m.prompt}
                        referrerPolicy="no-referrer"
                        className="w-full h-40 object-cover rounded-lg"
                      />
                      <p className="text-xs line-clamp-2">{m.prompt}</p>
                      <div className="flex items-center justify-between text-[11px] font-mono opacity-70">
                        <span>{m.model}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteMedia(m.id)}
                          className="text-red-500 hover:underline"
                        >
                          {t.delete}
                        </button>
                      </div>
                    </div>
                  ))}
                  {uploadedFiles.map((f) => (
                    <div
                      key={f.id}
                      className={`p-4 rounded-xl border space-y-2 ${
                        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="font-mono text-xs font-semibold truncate">{f.name}</div>
                      <div className="text-[11px] opacity-70 font-mono tabular-nums">
                        {f.mimeType} · {Math.round(f.sizeBytes / 1024)} KB
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 12. AI MODELS & ADMIN HUB */}
          {activeSection === 'models' && (
            <AdminModelsHub
              models={models}
              onToggleModelEnabled={(id) =>
                setModels((prev) =>
                  prev.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m))
                )
              }
              usageStats={usageStats}
              dailyLimits={dailyLimits}
              onUpdateLimits={setDailyLimits}
              isAdminUser={isAdminUser}
              theme={theme}
            />
          )}

          {/* 13. HELP AND FEEDBACK */}
          {activeSection === 'help' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div>
                <h2 className="font-display text-2xl font-bold tracking-tight">
                  Help, Configuration Guide &amp; Feedback
                </h2>
                <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Quick reference for Master Prompt workflows, Hausa &amp; English usage, and
                  deployment.
                </p>
              </div>

              <div
                className={`p-6 rounded-xl border space-y-4 text-xs leading-relaxed ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <h3 className="font-display text-base font-semibold">
                  How Master Prompt Studio Works
                </h3>
                <ol className="list-decimal pl-5 space-y-1.5">
                  <li>
                    <strong>Paste or Load Field A (Master Prompt):</strong> Store your
                    detailed instructions, formatting rules, and persona once.
                  </li>
                  <li>
                    <strong>Enter Field B (New Idea):</strong> Type only the new topic or
                    video/product concept you want to generate in English or Hausa.
                  </li>
                  <li>
                    <strong>Configure Field C (Optional Settings):</strong> Choose language
                    (English or Hausa), output type, and optional exact server-verified
                    character limits, then click <strong>GENERATE MY RESULT</strong>.
                  </li>
                </ol>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!feedbackText.trim()) return;
                  setFeedbackSubmitted(true);
                  setFeedbackText('');
                }}
                className={`p-6 rounded-xl border space-y-4 ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <h3 className="font-display text-base font-semibold">
                  Send Workspace Feedback
                </h3>
                <textarea
                  rows={3}
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Share feature requests, bug reports, or workflow suggestions..."
                  className={`w-full rounded-lg border p-3 text-xs ${
                    isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-300'
                  }`}
                />
                {feedbackSubmitted && (
                  <div className="text-xs text-emerald-500 font-medium">
                    Thank you! Your feedback has been recorded.
                  </div>
                )}
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-medium cursor-pointer"
                >
                  Submit Feedback
                </button>
              </form>
            </div>
          )}
        </main>
      </div>

      {/* Destructive Account Deletion Confirmation Modal */}
      {showDeleteAccountModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
        >
          <div
            className={`max-w-md w-full rounded-xl border p-6 space-y-4 ${
              isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <h3 id="delete-account-title" className="font-display text-base font-bold text-red-500">
              Permanently Delete Account &amp; All Saved Data?
            </h3>
            <p className="text-xs leading-relaxed opacity-85">
              This action permanently deletes your user profile, private PII document, all
              saved Master Prompts, and all chat conversations from Firestore. This cannot be
              undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteAccountModal(false)}
                className="px-3.5 py-2 text-xs rounded-lg border border-slate-500/30 cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowDeleteAccountModal(false);
                  if (firebaseUser) {
                    await deleteUserAccountAndData(firebaseUser);
                  }
                  setIsDemoSession(false);
                }}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-500 cursor-pointer"
              >
                Confirm Permanent Deletion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
