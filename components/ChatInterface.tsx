'use client';

import React, { useState, useRef, useEffect } from 'react';
import { DocumentInfo } from './DocumentList';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FileText, RotateCcw, Sparkles, BookOpen, Key, ListChecks, ArrowLeftRight, Bot, Loader2, Copy, BookOpenText, Paperclip, Mic, Send } from 'lucide-react';
import { authFetch } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';

export interface Citation {
  id: string;
  documentId: string;
  filename: string;
  pageNumber: number;
  content: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  error?: boolean;
  time?: string;
}

interface ChatInterfaceProps {
  selectedDocIds: string[];
  documentsCount: number;
  activeChatId: string | null;
  onChatCreated: (chatId: string) => void;
  onChatsChanged?: () => void;
  onAttachFile?: () => void;
  documents: DocumentInfo[];
}

export default function ChatInterface({ 
  selectedDocIds, 
  documentsCount, 
  activeChatId, 
  onChatCreated,
  onChatsChanged,
  onAttachFile,
  documents
}: ChatInterfaceProps) {
  const { userName } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const activeDocument = documents.find(d => selectedDocIds.includes(d.id)) || null;

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Load chat messages when activeChatId changes
  useEffect(() => {
    const fetchChatMessages = async () => {
      if (!activeChatId) {
        setMessages([]);
        return;
      }
      setIsLoading(true);
      try {
        const response = await authFetch(`/api/chats/${activeChatId}`);
        if (response.ok) {
          const data = await response.json();
          const formattedMessages = data.map((msg: any) => ({
            id: msg.id,
            role: msg.role === 'model' ? 'assistant' : 'user',
            content: msg.content,
            citations: msg.citations || [],
            time: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }));
          setMessages(formattedMessages);
        } else {
          setMessages([]);
        }
      } catch (err) {
        console.error('Error loading chat messages:', err);
        setMessages([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchChatMessages();
  }, [activeChatId]);

  const getCurrentTime = () => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const submitQuestion = async (questionText: string) => {
    if (!questionText.trim() || isLoading) return;

    setIsLoading(true);
    setInput('');

    let currentChatId = activeChatId;

    if (!currentChatId) {
      try {
        const response = await authFetch('/api/chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Naming...' }),
        });
        if (response.ok) {
          const newChat = await response.json();
          currentChatId = newChat.id;
          onChatCreated(newChat.id);
        } else {
          throw new Error('Failed to initialize a new chat session');
        }
      } catch (err: any) {
        console.error(err);
        setIsLoading(false);
        return;
      }
    }

    const userMessageId = crypto.randomUUID();
    const assistantMessageId = crypto.randomUUID();
    const messageTime = getCurrentTime();

    setMessages((prev) => [
      ...prev,
      { id: userMessageId, role: 'user', content: questionText, time: messageTime },
    ]);

    setMessages((prev) => [
      ...prev,
      { id: assistantMessageId, role: 'assistant', content: '', time: messageTime },
    ]);

    try {
      const response = await authFetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: questionText,
          document_ids: selectedDocIds,
          chat_id: currentChatId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Server returned an error');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Streaming response body is unreadable');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let receivedText = '';
      let receivedCitations: Citation[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          if (!part.trim()) continue;

          const lines = part.split('\n');
          let eventType = '';
          let dataString = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.substring(7);
            } else if (line.startsWith('data: ')) {
              dataString = line.substring(6);
            }
          }

          if (eventType === 'citations') {
            try {
              receivedCitations = JSON.parse(dataString);
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, citations: receivedCitations }
                    : msg
                )
              );
            } catch (err) {
              console.error('Error parsing citations event:', err);
            }
          } else if (eventType === 'text') {
            try {
              const textData = JSON.parse(dataString);
              receivedText += textData.text;
              
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: receivedText }
                    : msg
                )
              );
            } catch (err) {
              console.error('Error parsing text event:', err);
            }
          } else if (eventType === 'error') {
            try {
              const errorData = JSON.parse(dataString);
              throw new Error(errorData.message || 'Stream generation failed');
            } catch (err: any) {
              throw err;
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Chat execution error:', error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: `An error occurred: ${error.message || 'Unable to retrieve answer.'}`,
                error: true,
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
      // Refresh sidebar chat list so the auto-renamed title appears
      if (onChatsChanged) onChatsChanged();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitQuestion(input);
  };

  const handleSuggestionClick = (prompt: string) => {
    if (documentsCount === 0) return;
    submitQuestion(prompt);
  };

  const suggestionIcons: Record<string, React.ReactNode> = {
    auto_stories: <BookOpen size={14} />,
    key: <Key size={14} />,
    checklist: <ListChecks size={14} />,
    compare_arrows: <ArrowLeftRight size={14} />,
  };

  const suggestions = [
    {
      title: "Summarize",
      icon: "auto_stories",
      color: "text-primary",
      prompt: "Summarize the document"
    },
    {
      title: "Key Points",
      icon: "key",
      color: "text-secondary",
      prompt: "What are the key points?"
    },
    {
      title: "List Features",
      icon: "checklist",
      color: "text-tertiary",
      prompt: "List all features mentioned in this document"
    },
    {
      title: "Compare",
      icon: "compare_arrows",
      color: "text-error",
      prompt: "Compare sections and find discrepancies"
    }
  ];

  return (
    <div className="flex flex-col h-full flex-1 w-full bg-surface-container-lowest/30 rounded-2xl overflow-hidden shadow-2xl relative select-none">
      
      {/* 1. Chat Header */}
      <header 
        style={{ boxShadow: 'inset 0 -1px 0 0 rgba(255, 255, 255, 0.04)' }}
        className="p-3.5 lg:p-4 border-b border-outline-variant/30 flex items-center justify-between bg-surface-container-lowest/40 backdrop-blur-xl"
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-on-surface truncate">
              {activeDocument ? activeDocument.filename : 'All Documents Context'}
            </h3>
            <p className="text-[10px] text-on-surface-variant mt-0.5 font-medium select-none">
              {activeDocument ? 'Scoped Q&A session' : 'Cross-document Q&A session'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setMessages([])}
            disabled={messages.length === 0}
            className="p-2 hover:bg-surface-variant/50 rounded-lg transition-all text-on-surface-variant hover:text-on-surface cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
            title="Clear Chat History"
          >
            <RotateCcw size={18} />
          </button>
        </div>
      </header>

      {/* 2. Messages / Context Canvas */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6 custom-scrollbar relative"
      >
        {/* Background Atmospheric Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-primary/10 blur-[130px] rounded-full pointer-events-none z-0"></div>

        {messages.length === 0 ? (
          /* Empty Welcome State - Compact (70% less clutter) */
          <div className="relative z-10 h-full flex flex-col items-center justify-center text-center max-w-md mx-auto py-8">
            <h4 className="text-base font-bold text-on-surface mb-1.5 flex items-center gap-2 justify-center select-none">
              <span>Hello, {userName || 'Gigi'}!</span>
              <Sparkles size={16} className="text-primary animate-pulse" />
            </h4>
            <p className="text-xs text-on-surface-variant mb-6 leading-relaxed select-none">
              Your AI document companion. Upload files, ask questions, and discover insights grounded in your documents.
            </p>

            {/* Pill-style suggestion buttons in a single inline wrap */}
            <div className="flex flex-wrap items-center justify-center gap-2 max-w-sm">
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestionClick(s.prompt)}
                  disabled={documentsCount === 0}
                  className="px-3.5 py-1.5 bg-[#1b1b1f]/40 hover:bg-[#25252b]/60 border border-white/5 hover:border-primary/20 rounded-full text-[11px] text-on-surface-variant hover:text-primary transition-all cursor-pointer font-semibold disabled:opacity-40 disabled:pointer-events-none shadow-sm flex items-center gap-1.5"
                >
                  <span className={`${s.color}`}>{suggestionIcons[s.icon]}</span>
                  <span>{s.title}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Conversation Thread */
          <div className="relative z-10 space-y-6">
            <div className="flex items-center justify-center my-4">
              <span className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant/60 bg-surface-container-low/80 px-3.5 py-1.5 rounded-full border border-white/5 shadow-sm select-none">
                Today
              </span>
            </div>

            {messages.map((message) => {
              const isBot = message.role === 'assistant';
              return (
                <div 
                  key={message.id} 
                  className={`flex gap-4 ${isBot ? 'justify-start' : 'justify-end'}`}
                >
                  {isBot && (
                    <div className="w-9 h-9 rounded-xl bg-primary-container flex items-center justify-center text-on-primary-container shrink-0 mt-0.5 shadow-md border border-white/5">
                      <Bot size={20} />
                    </div>
                  )}

                  <div className="max-w-[75%] space-y-1.5">
                    <div 
                      className={`rounded-2xl px-4 py-3.5 text-xs md:text-sm leading-relaxed ${
                        isBot
                          ? message.error
                            ? 'bg-error-container/20 border border-error/25 text-error shadow-sm'
                            : 'bg-surface-container-high/60 border border-white/5 text-on-surface shadow-md'
                          : 'bg-primary text-on-primary rounded-tr-none shadow-md shadow-primary/15 font-medium border border-white/10'
                      }`}
                    >
                      {message.content === '' && isBot ? (
                        <div className="flex items-center gap-2 text-on-surface-variant py-1 font-medium">
                          <Loader2 size={18} className="text-primary animate-spin" />
                          <span>Searching knowledge base...</span>
                        </div>
                      ) : isBot ? (
                        <div className="prose-ai">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      )}

                      {/* Sources inline panel */}
                      {isBot && message.citations && message.citations.length > 0 && (
                        <div className="mt-4 pt-3.5 border-t border-outline-variant/30">
                          <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest mb-2 select-none">Sources:</p>
                          <div className="flex flex-wrap gap-2">
                            {message.citations.map((citation) => (
                              <button
                                key={citation.id}
                                onClick={() => setActiveCitation(citation)}
                                className="bg-surface-container-low/80 hover:bg-surface-container-high border border-outline-variant/30 hover:border-primary/45 px-3 py-1 rounded-lg text-[10px] text-on-surface-variant hover:text-primary transition-all truncate max-w-[190px] font-semibold cursor-pointer shadow-sm"
                                title={`${citation.filename} (Page ${citation.pageNumber})`}
                              >
                                {citation.filename.slice(0, 15)}... Page {citation.pageNumber}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Footer Details */}
                    <div className={`flex items-center gap-3 px-1 text-[10px] text-on-surface-variant/50 ${!isBot ? 'justify-end' : 'justify-start'}`}>
                      <span>{message.time || getCurrentTime()}</span>
                      {!isBot && <span className="text-primary font-bold select-none">✓✓</span>}
                      
                      {isBot && message.content !== '' && (
                        <div className="flex items-center gap-2.5 ml-1 select-none">
                          <button
                            onClick={() => copyToClipboard(message.content)}
                            className="hover:text-on-surface transition-colors cursor-pointer"
                            title="Copy response"
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Loading Bubble */}
        {isLoading && messages.length > 0 && messages[messages.length - 1]?.role === 'user' && (
          <div className="relative z-10 flex gap-4 justify-start">
            <div className="w-9 h-9 rounded-xl bg-primary-container flex items-center justify-center text-on-primary-container shrink-0 mt-0.5 shadow-sm border border-white/5">
              <Bot size={20} />
            </div>
            <div className="max-w-[75%] rounded-2xl px-4 py-3 bg-surface-container-high/40 border border-white/5 text-on-surface-variant text-xs flex items-center gap-2 select-none shadow-md">
              <Loader2 size={18} className="text-primary animate-spin" />
              Retrieving context embeddings and drafting answer...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 3. Citation snippet modal */}
      {activeCitation && (
        <div className="absolute inset-0 bg-black/70 z-30 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#131317] border border-white/10 rounded-2xl p-5 shadow-2xl flex flex-col gap-3 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2">
              <span className="text-xs font-semibold text-primary flex items-center gap-1.5 uppercase tracking-wide">
                <BookOpenText size={14} />
                Source Citation
              </span>
              <button 
                onClick={() => setActiveCitation(null)}
                className="text-xs text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
            <div className="flex flex-col gap-1 text-[11px] text-on-surface-variant">
              <p className="truncate"><span className="text-on-surface-variant/50 font-medium">Document:</span> {activeCitation.filename}</p>
              <p><span className="text-on-surface-variant/50 font-medium">Page Reference:</span> {activeCitation.pageNumber}</p>
            </div>
            <div className="max-h-48 overflow-y-auto text-xs text-on-surface/90 leading-relaxed font-serif bg-surface-container-lowest p-3.5 rounded-xl border border-white/5 shadow-inner">
              "{activeCitation.content}"
            </div>
          </div>
        </div>
      )}

      {/* 4. Bottom message input form */}
      <footer 
        style={{ boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.04)' }}
        className="p-3 lg:p-4 bg-surface-container-lowest/80 backdrop-blur-xl border-t border-white/5"
      >
        <form onSubmit={handleSubmit} className="relative max-w-4xl mx-auto group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 via-secondary/20 to-tertiary/20 rounded-[26px] blur-[8px] opacity-0 group-focus-within:opacity-100 transition-opacity duration-500"></div>
          
          <div className="relative flex items-center gap-3 bg-[#25252b]/55 border border-white/10 focus-within:border-primary/30 rounded-[24px] p-2 pl-4 shadow-xl shadow-black/25 focus-within:shadow-[0_0_20px_rgba(208,188,255,0.06)] transition-all duration-300">
            <button
              type="button"
              onClick={onAttachFile}
              disabled={isLoading}
              className="p-2 text-on-surface-variant hover:text-primary transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
            >
              <Paperclip size={20} />
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading || documentsCount === 0}
              placeholder={
                documentsCount === 0 
                  ? 'Upload documents to activate assistant...' 
                  : 'Ask something about your documents...'
              }
              className="flex-1 bg-transparent border-none focus:ring-0 text-on-surface text-xs md:text-sm py-3 outline-none placeholder-on-surface-variant/40 font-body-md"
            />

            <div className="flex items-center gap-2">
              <button 
                type="button"
                className="p-2 text-on-surface-variant hover:text-on-surface cursor-pointer"
              >
                <Mic size={20} />
              </button>
              <button
                type="submit"
                disabled={isLoading || !input.trim() || documentsCount === 0}
                className="w-12 h-12 bg-primary text-on-primary rounded-full flex items-center justify-center hover:shadow-lg shadow-primary/30 hover:shadow-primary/20 transition-all active:scale-90 cursor-pointer disabled:opacity-40 border border-white/10 disabled:pointer-events-none"
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </form>
        <p className="text-center mt-3 text-[9px] text-on-surface-variant/40 font-label-md uppercase tracking-widest font-bold">
          Powered by Advanced RAG Pipeline • ScanGenie v2.0
        </p>
      </footer>

    </div>
  );
}
