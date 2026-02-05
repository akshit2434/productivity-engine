type SearchProvider = 'tavily' | 'exa';

export type WebSearchInput = {
  query: string;
  maxResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
  recencyDays?: number;
  language?: string;
};

export type WebSearchResult = {
  id: number;
  title: string;
  url: string;
  source: string;
  snippet: string;
  publishedAt?: string;
  score?: number;
};

export type WebSearchResponse = {
  provider: SearchProvider;
  query: string;
  keywords: string[];
  results: WebSearchResult[];
};

const STOP_WORDS = new Set([
  'a','an','and','are','as','at','be','but','by','for','from','has','have','how','i','if','in','into','is','it','its','me',
  'my','not','of','on','or','our','so','that','the','their','then','they','this','to','we','were','what','when','where','which',
  'who','why','will','with','you','your'
]);

function extractKeywords(query: string): string[] {
  const cleaned = query
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = cleaned
    .split(' ')
    .filter(t => t.length > 2 && !STOP_WORDS.has(t));

  return Array.from(new Set(tokens)).slice(0, 8);
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return '';
  }
}

function getProvider(): SearchProvider {
  const explicit = (process.env.WEB_SEARCH_PROVIDER || '').toLowerCase();
  if (explicit === 'exa') return 'exa';
  return 'tavily';
}

async function searchWithTavily(input: WebSearchInput): Promise<WebSearchResponse> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error('Missing TAVILY_API_KEY');
  }

  const payload = {
    api_key: apiKey,
    query: input.query,
    search_depth: 'advanced',
    include_answer: false,
    max_results: input.maxResults ?? 6,
    include_domains: input.includeDomains,
    exclude_domains: input.excludeDomains,
    days: input.recencyDays
  };

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Tavily error: ${response.status} ${text}`);
  }

  const data = await response.json();
  const results = (data?.results || []).map((item: any, index: number) => ({
    id: index + 1,
    title: item.title || 'Untitled Source',
    url: item.url,
    source: safeHostname(item.url),
    snippet: item.content || '',
    publishedAt: item.published_date || undefined,
    score: typeof item.score === 'number' ? item.score : undefined
  }));

  return {
    provider: 'tavily',
    query: input.query,
    keywords: extractKeywords(input.query),
    results
  };
}

async function searchWithExa(input: WebSearchInput): Promise<WebSearchResponse> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    throw new Error('Missing EXA_API_KEY');
  }

  const payload = {
    query: input.query,
    numResults: input.maxResults ?? 6,
    useAutoprompt: true,
    includeDomains: input.includeDomains,
    excludeDomains: input.excludeDomains,
    type: 'neural'
  };

  const response = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Exa error: ${response.status} ${text}`);
  }

  const data = await response.json();
  const results = (data?.results || []).map((item: any, index: number) => ({
    id: index + 1,
    title: item.title || 'Untitled Source',
    url: item.url,
    source: safeHostname(item.url),
    snippet: item.text || item.snippet || '',
    publishedAt: item.publishedDate || undefined,
    score: typeof item.score === 'number' ? item.score : undefined
  }));

  return {
    provider: 'exa',
    query: input.query,
    keywords: extractKeywords(input.query),
    results
  };
}

export async function searchWeb(input: WebSearchInput): Promise<WebSearchResponse> {
  const provider = getProvider();
  if (provider === 'exa') {
    return searchWithExa(input);
  }
  return searchWithTavily(input);
}
