"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Sparkles, Send, Bot, User, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import AIChart from './AIChart';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [input, setInput] = useState('');
  const { messages, status, sendMessage } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
    messages: [
      {
        id: 'welcome',
        role: 'assistant',
        content: 'I am your Assistant. State your objective or inquire about your momentum.',
        parts: [{ type: 'text', text: 'I am your Assistant. State your objective or inquire about your momentum.' }],
      } as any,
    ],
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const currentInput = input;
    setInput('');
    await sendMessage({ text: currentInput });
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <>
      {/* Floating Toggle */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-24 right-6 md:right-10 z-50 w-14 h-14 rounded-2xl bg-primary text-void flex items-center justify-center card-shadow transition-all hover:scale-105 active:scale-95 group",
          isOpen && "opacity-0 pointer-events-none"
        )}
      >
        <Sparkles className="group-hover:rotate-12 transition-transform" size={24} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-end justify-end p-4 md:p-8 pointer-events-none">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-void/40 backdrop-blur-sm pointer-events-auto"
              onClick={() => setIsOpen(false)}
            />
            
            <motion.div
              initial={{ y: 100, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 100, opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-lg h-[80vh] bg-surface border border-border/50 rounded-[2.5rem] overflow-hidden card-shadow flex flex-col pointer-events-auto"
            >
              {/* Header */}
              <div className="px-8 pt-8 pb-4 border-b border-border/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                    <Sparkles className="text-primary" size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold text-white tracking-tight">AI Assistant</h2>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono">System Intel // &quot;God Mode&quot;</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-2xl bg-void border border-border/50 text-zinc-500 hover:text-white transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Messages Area */}
              <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 custom-scrollbar"
              >
                {messages.map((m: any) => (
                  <div key={m.id} className={cn(
                    "flex gap-4",
                    m.role === 'user' ? "flex-row-reverse" : "flex-row"
                  )}>
                    <div className={cn(
                      "w-8 h-8 rounded-xl shrink-0 flex items-center justify-center border",
                      m.role === 'user' ? "bg-zinc-800 border-zinc-700 text-zinc-400" : "bg-primary/10 border-primary/20 text-primary"
                    )}>
                      {m.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                    </div>
                    
                    <div className={cn(
                      "flex flex-col gap-2 max-w-[85%]",
                      m.role === 'user' ? "items-end" : "items-start"
                    )}>
                      <div className={cn(
                        "rounded-2xl px-4 py-3 text-sm leading-relaxed",
                        m.role === 'user' 
                          ? "bg-primary text-void font-medium" 
                          : "bg-void/50 border border-border/20 text-zinc-300"
                      )}>
                        <div className="prose prose-invert prose-sm max-w-none">
                          {m.parts?.map((part: any, index: number) => {
                            if (part.type === 'text') {
                              return (
                                <ReactMarkdown key={index} remarkPlugins={[remarkGfm]}>
                                  {part.text}
                                </ReactMarkdown>
                              );
                            }
                            
                            if (part.type.startsWith('tool-')) {
                              const toolName = part.type.replace('tool-', '');
                              
                              if (toolName === 'generate_chart') {
                                if (part.state === 'output-available' || part.state === 'result') {
                                  const result = part.output || part.result;
                                  return (
                                    <AIChart 
                                      key={index}
                                      chartType={result.chartType}
                                      title={result.title}
                                      data={result.data}
                                      xAxisKey={result.xAxisKey}
                                      yAxisKey={result.yAxisKey}
                                      dataKeys={result.dataKeys}
                                    />
                                  );
                                }
                              }
                            }
                            return null;
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-center">
                      <Loader2 size={14} className="text-primary animate-spin" />
                    </div>
                    <div className="bg-void/30 border border-primary/10 rounded-2xl px-4 py-2 text-[10px] font-bold text-primary uppercase tracking-[0.2em] animate-pulse">
                      Synthesizing Data...
                    </div>
                  </div>
                )}
              </div>

              {/* Input Area */}
              <div className="p-6 md:p-8 bg-void/50 border-t border-border/10">
                <form 
                  onSubmit={handleSubmit}
                  className="flex gap-3"
                >
                  <div className="flex-1 bg-surface-lighter border border-border/30 rounded-2xl px-4 flex items-center focus-within:border-primary/50 transition-all card-shadow">
                    <input 
                      type="text"
                      placeholder="Ask the Assistant..."
                      className="flex-1 bg-transparent border-none outline-none py-4 text-sm text-zinc-200 placeholder:text-zinc-700 font-medium"
                      value={input}
                      onChange={handleInputChange}
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className="w-14 h-14 bg-primary text-void rounded-2xl flex items-center justify-center hover:bg-primary/90 transition-all disabled:opacity-50 card-shadow"
                  >
                    <Send size={24} />
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
