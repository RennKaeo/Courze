import type { Tool } from '../types.js';

const MAX_RESPONSE_SIZE = 50000;
const FETCH_TIMEOUT = 30_000;

interface WebFetchArgs {
  url: string;
  format?: 'markdown' | 'text';
}

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'CourseCode/1.0',
        Accept: 'text/html,text/plain,*/*',
      },
      redirect: 'follow',
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function htmlToMarkdown(html: string): string {
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');

  text = text
    .replace(/<h1[^>]*>/gi, '# ')
    .replace(/<h2[^>]*>/gi, '## ')
    .replace(/<h3[^>]*>/gi, '### ')
    .replace(/<h4[^>]*>/gi, '#### ')
    .replace(/<h5[^>]*>/gi, '##### ')
    .replace(/<h6[^>]*>/gi, '###### ')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<strong[^>]*>/gi, '**')
    .replace(/<\/strong>/gi, '**')
    .replace(/<b[^>]*>/gi, '**')
    .replace(/<\/b>/gi, '**')
    .replace(/<em[^>]*>/gi, '*')
    .replace(/<\/em>/gi, '*')
    .replace(/<i[^>]*>/gi, '*')
    .replace(/<\/i>/gi, '*')
    .replace(/<code[^>]*>/gi, '`')
    .replace(/<\/code>/gi, '`')
    .replace(/<pre[^>]*>/gi, '```\n')
    .replace(/<\/pre>/gi, '\n```')
    .replace(/<a\s+href=["']([^"']+)["'][^>]*>/gi, '[$1](')
    .replace(/<\/a>/gi, ')')
    .replace(/<ul[^>]*>/gi, '\n')
    .replace(/<\/ul>/gi, '\n')
    .replace(/<ol[^>]*>/gi, '\n')
    .replace(/<\/ol>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{4,}/g, '\n\n')
    .trim();

  return text;
}

export const webFetchTool: Tool<WebFetchArgs> = {
  name: 'web_fetch',
  description: 'Fetch and convert web page content to markdown or plain text.',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'URL to fetch content from',
      },
      format: {
        type: 'string',
        enum: ['markdown', 'text'],
        description: 'Output format (default: markdown)',
      },
    },
    required: ['url'],
  },

  async handler(args: WebFetchArgs): Promise<string> {
    if (!isAllowedUrl(args.url)) {
      return 'Error: Only http and https URLs are supported';
    }

    let response: Response;
    try {
      response = await fetchWithTimeout(args.url, FETCH_TIMEOUT);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return `Error: Request timed out after ${FETCH_TIMEOUT / 1000}s`;
      }
      const message = err instanceof Error ? err.message : String(err);
      return `Error fetching URL: ${message}`;
    }

    if (!response.ok) {
      return `Error: HTTP ${response.status} ${response.statusText}`;
    }

    const contentType = response.headers.get('content-type') || '';
    let text: string;

    try {
      text = await response.text();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return `Error reading response body: ${message}`;
    }

    const isHtml = contentType.includes('text/html');

    let output: string;
    if (isHtml && args.format !== 'text') {
      output = htmlToMarkdown(text);
    } else if (isHtml) {
      output = htmlToText(text);
    } else {
      output = text;
    }

    if (output.length > MAX_RESPONSE_SIZE) {
      output = output.slice(0, MAX_RESPONSE_SIZE) +
        `\n\n... (truncated, ${output.length - MAX_RESPONSE_SIZE} more characters)`;
    }

    output = `Content from ${args.url}:\n\n${output}`;

    return output;
  },
};
