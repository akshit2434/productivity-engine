import React, { useState } from 'react';
import { ExternalLink, Search, Globe, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type WebSearchResult = {
  id: number;
  title: string;
  url: string;
  source: string;
  snippet: string;
  publishedAt?: string;
  score?: number;
};

type WebSearchPayload = {
  provider: string;
  query: string;
  keywords?: string[];
  results: WebSearchResult[];
};

function formatDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString();
}

export default function AIWebSearchResults({ payload, compact = false }: { payload: WebSearchPayload | { error: string }; compact?: boolean }) {
  if ('error' in payload) {
    return (
      <div className={cn("rounded-3xl border border-border/30 bg-void/40 p-5 text-xs text-red-300", compact && "p-4")}>
        Web search failed: {payload.error}
      </div>
    );
  }

  const [expanded, setExpanded] = useState(false);
  const hasKeywords = payload.keywords && payload.keywords.length > 0;

  return (
    <div className={cn(
      "rounded-3xl border border-border/30 bg-void/40 p-5",
      compact && "p-4"
    )}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] font-bold text-primary/70">
          <Search size={12} />
          Web Research
        </div>
        <div className="text-[9px] uppercase tracking-[0.2em] font-bold text-zinc-500">
          {payload.provider || 'web'}
        </div>
      </div>

      <div className="mt-2 text-sm font-semibold text-white">
        {payload.query}
      </div>

      {hasKeywords && (
        <div className="mt-3 flex flex-wrap gap-2">
          {payload.keywords?.map((keyword) => (
            <span
              key={keyword}
              className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full border border-primary/20 text-primary/80 bg-primary/5 font-mono"
            >
              {keyword}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-zinc-500">
          Sources ({payload.results?.length ?? 0})
        </div>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-bold text-primary/70 hover:text-primary transition-colors"
        >
          {expanded ? 'Hide' : 'Expand'}
          <ChevronDown size={12} className={cn("transition-transform", expanded && "rotate-180")} />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {payload.results?.length ? payload.results.map((result, index) => (
          <a
            key={result.id}
            href={result.url}
            target="_blank"
            rel="noreferrer"
            className="group relative inline-flex items-center justify-center h-7 px-2 rounded-full border border-primary/20 bg-primary/5 text-[10px] font-mono text-primary/80 hover:text-primary hover:border-primary/50 transition-all no-underline"
          >
            {index + 1}
            <span className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 w-52 rounded-xl border border-border/40 bg-void/95 p-2 text-[10px] text-zinc-300 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all">
              <span className="block text-[9px] uppercase tracking-[0.2em] text-zinc-500 mb-1">
                {result.source || 'source'}
              </span>
              <span className="block text-zinc-200 font-semibold leading-snug line-clamp-2">
                {result.title}
              </span>
            </span>
          </a>
        )) : (
          <div className="text-xs text-zinc-500 italic">No sources returned.</div>
        )}
      </div>

      <div className={cn(
        "mt-4 grid gap-3 transition-all duration-300",
        expanded ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none h-0 overflow-hidden",
        compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"
      )}>
        {payload.results?.length ? payload.results.map((result) => {
          const published = formatDate(result.publishedAt);
          return (
            <a
              key={result.id}
              href={result.url}
              target="_blank"
              rel="noreferrer"
              className="group rounded-2xl border border-border/20 bg-surface/70 p-4 hover:border-primary/40 transition-all card-shadow no-underline"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-500">
                  <Globe size={12} />
                  {result.source || 'source'}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                  <ExternalLink size={12} />
                  Open
                </div>
              </div>

              <div className="mt-2 text-sm font-semibold text-white group-hover:text-primary transition-colors">
                {result.title}
              </div>
              {result.snippet && (
                <p className="mt-2 text-xs text-zinc-400 leading-relaxed line-clamp-3">
                  {result.snippet}
                </p>
              )}
              {published && (
                <div className="mt-3 text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-600">
                  {published}
                </div>
              )}
            </a>
          );
        }) : null}
      </div>
    </div>
  );
}
