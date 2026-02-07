"use client";

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/db';
import { FileText, Search, ChevronRight, BookOpen, Clock } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function DocsPage() {
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['documentation'],
    queryFn: async () => {
      return await db.documentation.toArray();
    }
  });

  const filteredDocs = docs.filter(doc => 
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedDoc = docs.find(d => d.id === selectedDocId);

  return (
    <div className="flex h-screen bg-void overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 border-r border-border/10 flex flex-col bg-surface/50 backdrop-blur-md">
        <div className="p-6 border-b border-border/10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/5">
              <BookOpen className="text-primary" size={20} />
            </div>
            <div>
              <h1 className="font-black text-white text-sm uppercase tracking-widest">System Intel</h1>
              <p className="text-[10px] text-zinc-500 font-mono italic">Knowledge Base // Offline</p>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
            <input 
              type="text" 
              placeholder="Search intelligence..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-void/50 border border-border/10 rounded-xl py-2 pl-10 pr-4 text-xs text-zinc-300 focus:border-primary/50 outline-none transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col gap-2 animate-pulse">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-white/5 rounded-2xl border border-white/5" />
              ))}
            </div>
          ) : filteredDocs.length > 0 ? (
            filteredDocs.map(doc => (
              <button
                key={doc.id}
                onClick={() => setSelectedDocId(doc.id)}
                className={cn(
                  "w-full text-left p-4 rounded-2xl transition-all group relative overflow-hidden",
                  selectedDocId === doc.id 
                    ? "bg-primary/10 border border-primary/20 text-primary" 
                    : "hover:bg-white/5 border border-transparent text-zinc-400"
                )}
              >
                <div className="flex items-center gap-3 relative z-10">
                  <FileText size={16} className={selectedDocId === doc.id ? "text-primary" : "text-zinc-600"} />
                  <span className="text-sm font-bold truncate">{doc.title}</span>
                </div>
                {selectedDocId === doc.id && (
                  <motion.div 
                    layoutId="active-doc"
                    className="absolute inset-0 bg-primary/5 z-0"
                  />
                )}
              </button>
            ))
          ) : (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center mx-auto mb-4 border border-zinc-800">
                <Search size={20} className="text-zinc-700" />
              </div>
              <p className="text-xs text-zinc-600 font-mono font-bold uppercase tracking-widest">Signal Not Found</p>
            </div>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col bg-void">
        <AnimatePresence mode="wait">
          {selectedDoc ? (
            <motion.div 
              key={selectedDoc.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-4xl mx-auto w-full p-12 md:p-24"
            >
              <div className="flex items-center gap-4 mb-8 text-[10px] font-black font-mono text-zinc-500 uppercase tracking-[0.3em]">
                <Clock size={12} />
                Last Indexed: {new Date(selectedDoc.last_indexed_at).toLocaleDateString()}
                <span className="text-primary/40">•</span>
                {selectedDoc.path}
              </div>

              <h1 className="text-5xl font-black text-white mb-12 tracking-tight leading-tight">
                {selectedDoc.title}
              </h1>

              <div className="prose prose-invert prose-zinc max-w-none prose-headings:font-black prose-p:text-zinc-400 prose-p:leading-relaxed prose-strong:text-primary">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {selectedDoc.content}
                </ReactMarkdown>
              </div>
            </motion.div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <div className="w-24 h-24 rounded-3xl bg-primary/5 flex items-center justify-center mb-6 border border-primary/10 relative">
                <div className="absolute inset-0 bg-primary/10 blur-3xl rounded-full animate-pulse opacity-20" />
                <BookOpen size={40} className="text-primary/40" />
              </div>
              <h2 className="text-xl font-black text-white mb-2 uppercase tracking-widest">Select System Intel</h2>
              <p className="text-sm text-zinc-600 font-mono">Access encrypted documentation for offline operations.</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
