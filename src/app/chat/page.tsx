"use client";

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, UIMessage } from 'ai';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useMediaQuery } from '@/hooks/use-media-query';
import { 
  Sparkles, Send, Bot, User, Loader2, Plus, Search, 
  MessageSquare, Trash2, ChevronLeft, Menu, Home, BarChart3,
  Mic, Square
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { VoiceVisualizer } from "@/components/ui/VoiceVisualizer";
import { AudioPlayer } from "@/components/ui/AudioPlayer";
import AIChart from '@/components/chat/AIChart';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function ChatInterface() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('id');
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [sessions, setSessions] = useState<{ id: string, title: string, updated_at: string }[]>([]);
  
  // Close sidebar by default on mobile
  useEffect(() => {
    if (isMobile) setIsSidebarOpen(false);
    else setIsSidebarOpen(true);
  }, [isMobile]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewChatLoading, setIsNewChatLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'inherit';
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${Math.min(scrollHeight, 200)}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [input]);

  const { messages, setMessages, status, sendMessage } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: (sessionId && sessionId !== 'undefined' && sessionId !== 'null') ? { sessionId } : {},
    }),
    messages: [
      {
        id: 'welcome',
        role: 'assistant',
        content: 'I am the Prophet. State your objective or inquire about your momentum.',
        parts: [{ type: 'text', text: 'I am the Prophet. State your objective or inquire about your momentum.' }],
      } as UIMessage,
    ],
    onFinish: (message) => {
      // Message completed
    },
    onError: (error) => {
      console.error('[Chat Client] onError:', error);
    }
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await fetch(`/api/chat/sessions${searchQuery ? `?q=${searchQuery}` : ''}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setSessions(data);
        } else {
          console.error("Sessions API error:", data);
        }
      } catch (e) {
        console.error("Failed to fetch sessions", e);
      }
    };
    fetchSessions();
  }, [searchQuery, sessionId]);

  useEffect(() => {
    // Reset messages when session ID changes to avoid leaking history from previous sessions
    const welcomeMessage = {
      id: 'welcome',
      role: 'assistant',
      content: 'I am the Prophet. State your objective or inquire about your momentum.',
      parts: [{ type: 'text', text: 'I am the Prophet. State your objective or inquire about your momentum.' }],
    } as UIMessage;

    if (sessionId && sessionId !== 'undefined' && sessionId !== 'null') {
      const fetchMessages = async () => {
        try {
          // Clear current messages while loading new ones
          setMessages([welcomeMessage]);
          
          const res = await fetch(`/api/chat/messages/${sessionId}`);
          const data = await res.json();
          if (Array.isArray(data)) {
            const formattedMessages: UIMessage[] = data.map((m: { id: string, role: string, content: string, parts?: unknown }) => {
              // Parse parts if it's a JSON string (from Supabase)
              let parsedParts: unknown[] = [];
              if (m.parts) {
                if (typeof m.parts === 'string') {
                  try {
                    parsedParts = JSON.parse(m.parts);
                  } catch {
                    parsedParts = [{ type: 'text', text: m.content || '' }];
                  }
                } else if (Array.isArray(m.parts)) {
                  parsedParts = m.parts;
                }
              }
              
              // If no valid parts, create a text part from content
              if (!parsedParts || parsedParts.length === 0) {
                parsedParts = [{ type: 'text', text: m.content || '' }];
              }
              
              return {
                id: m.id,
                role: m.role as 'user' | 'assistant',
                content: m.content || '',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                parts: parsedParts as any
              };
            });
            // Messages loaded for session
            if (formattedMessages.length > 0) {
              setMessages(formattedMessages);
            }
          } else {
            console.error("[Chat UI] Messages API error:", data);
          }
        } catch (e) {
          console.error("Failed to fetch messages", e);
        }
      };
      fetchMessages();
    } else {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: 'I am the Prophet. State your objective or inquire about your momentum.',
          parts: [{ type: 'text', text: 'I am the Prophet. State your objective or inquire about your momentum.' }],
        } as UIMessage,
      ]);
    }
  }, [sessionId, setMessages]);

  // Handle pending prompt for new sessions
  useEffect(() => {
    if (sessionId && sessionId !== 'undefined' && sessionId !== 'null' && status === 'ready') {
      const pendingPrompt = localStorage.getItem('pending_prompt');
      if (pendingPrompt) {
        localStorage.removeItem('pending_prompt');
        sendMessage({ text: pendingPrompt });
      }
    }
  }, [sessionId, status, sendMessage]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const startNewChat = async () => {
    setIsNewChatLoading(true);
    try {
      const res = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Prophecy' }),
      });
      const data = await res.json();
      if (data.id) {
        router.push(`/chat?id=${data.id}`);
      } else {
        alert("Failed to create session: " + (data.error || "Unknown error"));
      }
    } catch (e) {
      console.error("Failed to start new chat", e);
    } finally {
      setIsNewChatLoading(false);
    }
  };

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this prophecy?')) {
      const res = await fetch(`/api/chat/sessions?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        if (sessionId === id) router.push('/chat');
        else setSessions(sessions.filter(s => s.id !== id));
      } else {
        alert("Failed to delete session: " + (data.error || "Unknown error"));
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    if (!sessionId || sessionId === 'undefined' || sessionId === 'null') {
      const res = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: input.substring(0, 30) + '...' }),
      });
      const data = await res.json();
      if (data.id) {
        localStorage.setItem('pending_prompt', input);
        router.push(`/chat?id=${data.id}`);
        setInput('');
      } else {
        alert("Failed to create session: " + (data.error || "Unknown error"));
      }
      return;
    }

    const currentInput = input;
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'inherit';
    }
    await sendMessage({ text: currentInput });
  };

  const { isRecording, startRecording, stopRecording, analyser, audioBlob } = useVoiceRecorder();

  const handleVoiceSubmit = async (blob: Blob) => {
    if (!sessionId || sessionId === 'undefined' || sessionId === 'null') {
      alert("Please start a session first or type a message to initialize.");
      return;
    }

    try {
      // 1. Upload audio to Supabase Storage via our new endpoint
      const formData = new FormData();
      formData.append('file', blob, `recording-${Date.now()}.webm`);

      const uploadResponse = await fetch('/api/upload-audio', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error || 'Failed to upload audio');
      }

      const { url: storageUrl } = await uploadResponse.json();
      // Audio uploaded successfully

      // 2. Send the storage URL to the AI SDK
      // The mediaType is still important for the AI SDK/model to know it's audio
      const mediaType = blob.type.split(';')[0];

      await sendMessage({ 
        files: [
          {
            type: 'file',
            mediaType: mediaType,
            url: storageUrl, // Passing the public storage URL instead of base64
            filename: `recording-${Date.now()}.webm`
          }
        ]
      } as any);
    } catch (error) {
      console.error("Failed to process voice message:", error);
      alert(error instanceof Error ? error.message : "Failed to upload and send voice message.");
    }
  };

  useEffect(() => {
    if (!isRecording && audioBlob) {
      handleVoiceSubmit(audioBlob);
    }
  }, [isRecording, audioBlob]);

  return (
    <div className="flex h-screen bg-void overflow-hidden">
      <AnimatePresence mode="wait">
        {(isSidebarOpen || !isMobile) && (
          <>
            {isMobile && isSidebarOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSidebarOpen(false)}
                className="fixed inset-0 bg-void/60 backdrop-blur-sm z-40 md:hidden"
              />
            )}
            <motion.div 
              initial={isMobile ? { x: -320 } : { width: 0 }}
              animate={isMobile ? { x: 0 } : { width: isSidebarOpen ? 320 : 0 }}
              exit={isMobile ? { x: -320 } : { width: 0 }}
              transition={{ type: "spring", damping: 20, stiffness: 100 }}
              className={cn(
                "bg-surface border-r border-border/10 flex flex-col relative overflow-hidden h-full",
                isMobile ? "fixed inset-y-0 left-0 z-50 w-[320px]" : "relative"
              )}
            >
              <div className="p-6 border-b border-border/10 flex items-center justify-between w-[320px]">
                <div className="flex items-center gap-3">
                  <Sparkles className="text-primary" size={20} />
                  <h2 className="font-extrabold text-white">History</h2>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="text-zinc-500 hover:text-white">
                  <ChevronLeft size={20} />
                </button>
              </div>

              <div className="p-4 w-[320px]">
                <button onClick={startNewChat} disabled={isNewChatLoading} className="w-full flex items-center justify-center gap-2 bg-primary/10 border border-primary/20 text-primary py-3 rounded-2xl hover:bg-primary/20 transition-all font-bold text-sm">
                  {isNewChatLoading ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                  NEW PROPHECY
                </button>
              </div>

              <div className="px-4 pb-4 w-[320px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
                  <input type="text" placeholder="Search history..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-void/50 border border-border/10 rounded-xl py-2 pl-10 pr-4 text-xs text-zinc-300 focus:border-primary/50 outline-none transition-all" />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-2 custom-scrollbar w-[320px]">
                {sessions.map((session) => (
                  <div key={session.id} onClick={() => {
                    router.push(`/chat?id=${session.id}`);
                    if (isMobile) setIsSidebarOpen(false);
                  }} className={cn("group relative flex items-center gap-3 p-4 rounded-2xl cursor-pointer transition-all mb-1", sessionId === session.id ? "bg-white/5 border border-white/10" : "hover:bg-white/2")}>
                    <MessageSquare size={16} className={cn(sessionId === session.id ? "text-primary" : "text-zinc-600")} />
                    <div className="flex-1 overflow-hidden">
                      <p className={cn("text-sm font-medium truncate", sessionId === session.id ? "text-white" : "text-zinc-400 group-hover:text-zinc-200")}>{session.title || 'Untitled Session'}</p>
                      <p className="text-[10px] text-zinc-600 font-mono mt-0.5">{new Date(session.updated_at).toLocaleDateString()}</p>
                    </div>
                    <button onClick={(e) => deleteSession(session.id, e)} className="opacity-0 group-hover:opacity-100 p-2 text-zinc-500 hover:text-red-400 transition-all">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col relative min-w-0">
        <div className="p-4 border-b border-border/10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {(!isSidebarOpen || isMobile) && (
              <button 
                onClick={() => setIsSidebarOpen(true)} 
                className="w-10 h-10 bg-surface border border-border/10 rounded-xl flex items-center justify-center text-zinc-500 hover:text-white transition-all focus:ring-2 focus:ring-primary/20 outline-none"
              >
                <Menu size={20} />
              </button>
            )}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                <Sparkles className="text-primary" size={16} />
              </div>
              <div>
                <h1 className="font-bold text-white text-sm">The Prophet</h1>
                <p className="text-[10px] text-zinc-500 font-mono">System Intel // God Mode</p>
              </div>
            </div>
          </div>
          <Link 
            href="/"
            className="w-10 h-10 bg-surface border border-border/10 rounded-xl flex items-center justify-center text-zinc-500 hover:text-white transition-all hover:bg-white/5"
          >
            <Home size={20} />
          </Link>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 md:p-12 space-y-8 custom-scrollbar">
          {messages.map((m: UIMessage) => (
            <div key={m.id} className={cn("flex gap-6 max-w-4xl mx-auto", m.role === 'user' ? "flex-row-reverse" : "flex-row")}>
              <div className={cn("w-10 h-10 rounded-2xl shrink-0 flex items-center justify-center border transition-all", m.role === 'user' ? "bg-zinc-800 border-zinc-700 text-zinc-400" : "bg-primary/10 border-primary/20 text-primary shadow-lg shadow-primary/5")}>
                {m.role === 'user' ? <User size={18} /> : <Bot size={18} />}
              </div>
              <div className={cn("flex flex-col gap-3 max-w-[85%] md:max-w-[80%]", m.role === 'user' ? "items-end" : "items-start")}>
                <div className={cn("rounded-3xl px-6 py-4 text-base leading-relaxed card-shadow", m.role === 'user' ? "bg-primary text-black font-semibold" : "bg-surface border border-border/20 text-zinc-300")}>
                  <div className={cn("max-w-none", m.role === 'user' ? "prose prose-zinc" : "prose prose-invert")}>
                    {m.parts && Array.isArray(m.parts) && m.parts.length > 0 ? (
                      m.parts.map((part: { type: string, text?: string, state?: string, output?: unknown, result?: unknown, mediaType?: string, url?: string }, index: number) => {
                        if (part.type === 'text') {
                          if (!part.text || !part.text.trim()) return null;
                          return <ReactMarkdown key={index} remarkPlugins={[remarkGfm]}>{part.text}</ReactMarkdown>;
                        }
                        // Audio playback for file parts
                        if (part.type === 'file' && part.mediaType?.startsWith('audio/') && part.url) {
                          return (
                            <AudioPlayer key={index} src={part.url} />
                          );
                        }
                        if (part.type.startsWith('tool-')) {
                          const toolCallPart = part as { type: string, toolName?: string, state?: string, output?: unknown, result?: unknown };
                          const toolName = toolCallPart.toolName || part.type.replace('tool-', '').replace('call', '').replace('-', ' ');

                          
                          if (part.type.includes('call') || toolCallPart.state === 'call') {
                            return (
                              <div key={index} className="flex items-center gap-2 my-2 py-1 px-3 bg-white/5 rounded-lg border border-white/10 text-[10px] uppercase tracking-wider font-bold text-zinc-500">
                                <Loader2 size={10} className="animate-spin text-primary" />
                                Executing {toolName || 'operation'}...
                              </div>
                            );
                          }
                          
                          if (toolName === 'generate chart' || toolName === 'generate_chart') {
                            if (toolCallPart.state === 'output-available' || toolCallPart.state === 'result' || part.type === 'tool-result') {
                              const result = (toolCallPart.output || toolCallPart.result) as {
                                chartType: 'bar' | 'line' | 'pie' | 'area';
                                title: string;
                                data: unknown[];
                                xAxisKey?: string;
                                dataKeys: string[];
                              };
                              return (
                                <div key={index} className="my-6">
                                  <div className="flex items-center gap-2 mb-2 text-[10px] uppercase tracking-[0.2em] font-bold text-primary/60">
                                    <BarChart3 size={12} />
                                    Visualization Rendered
                                  </div>
                                  <AIChart 
                                    chartType={(result as { chartType: 'bar' | 'line' | 'pie' | 'area' }).chartType} 
                                    title={(result as { title: string }).title} 
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    data={(result as { data: unknown[] }).data as any[]} 
                                    xAxisKey={(result as { xAxisKey?: string }).xAxisKey} 
                                    dataKeys={(result as { dataKeys: string[] }).dataKeys} 
                                  />
                                </div>
                              );
                            }
                          }
                        }
                        return null;
                      })
                    ) : (
                      (m as { content?: string }).content?.trim() ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{(m as { content?: string }).content}</ReactMarkdown> : <div className="text-zinc-500 italic text-sm">Processing...</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-6 max-w-4xl mx-auto">
              <div className="w-10 h-10 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center"><Loader2 size={18} className="text-primary animate-spin" /></div>
              <div className="bg-void/30 border border-primary/10 rounded-3xl px-6 py-3 text-[10px] font-bold text-primary uppercase tracking-[0.2em] animate-pulse">Synthesizing Data...</div>
            </div>
          )}
        </div>

        <div className="w-full max-w-4xl mx-auto px-6 pb-10 pt-2">
          <div className="glass-morphic border border-border/10 rounded-[2.5rem] p-3 shadow-2xl flex gap-3 focus-within:border-primary/30 transition-all items-end relative overflow-hidden">
            {isRecording ? (
              <div className="flex-1 flex flex-col items-center justify-center py-2 gap-2">
                <VoiceVisualizer analyser={analyser} className="w-full" color="#6366f1" />
                <p className="text-[10px] font-mono text-primary uppercase tracking-[0.2em] animate-pulse">The Prophet is listening...</p>
              </div>
            ) : (
              <textarea 
                ref={textareaRef}
                rows={1}
                placeholder="State your objective..." 
                value={input} 
                onChange={handleInputChange} 
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }} 
                className="flex-1 bg-transparent border-none outline-none px-6 py-4 text-white placeholder:text-zinc-600 font-medium resize-none overflow-y-auto custom-scrollbar max-h-[200px] leading-relaxed" 
              />
            )}
            
            <div className="flex gap-2 mb-1 mr-1">
              <button 
                onClick={isRecording ? stopRecording : startRecording}
                className={cn(
                  "w-14 h-14 rounded-[2rem] flex items-center justify-center transition-all group",
                  isRecording 
                    ? "bg-red-500/10 border border-red-500/20 text-red-500" 
                    : "bg-void border border-border/10 text-primary hover:bg-white/5"
                )}
              >
                {isRecording ? <Square size={20} /> : <Mic size={24} />}
              </button>
              
              {!isRecording && (
                <button 
                  onClick={handleSubmit} 
                  disabled={isLoading || !input.trim()} 
                  className="w-14 h-14 bg-primary text-void rounded-[2rem] flex items-center justify-center hover:bg-primary/90 transition-all disabled:opacity-50 group hover:scale-105 active:scale-95 shrink-0"
                >
                  <Send size={24} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex h-screen bg-void items-center justify-center text-[10px] font-bold text-zinc-700 uppercase tracking-[0.3em] animate-pulse">Syncing Matrix...</div>}>
      <ChatInterface />
    </Suspense>
  );
}
