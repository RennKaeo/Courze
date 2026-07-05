import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { Tool } from '../types.js';

const MAX_RESULTS = 200;
const MAX_FILE_SIZE = 1024 * 1024; // 1MB

interface GrepArgs {
  pattern: string;
  path?: string;
  include?: string;
}

interface MatchResult {
  filePath: string;
  lineNumber: number;
  lineContent: string;
}

function globToIncludeRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regexStr = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${regexStr}$`);
}

async function recursiveGrep(
  dirPath: string,
  searchRegex: RegExp,
  includeRegex: RegExp | null,
  basePath: string,
  maxResults: number,
): Promise<MatchResult[]> {
  const results: MatchResult[] = [];
  let entries: string[];

  try {
    entries = await readdir(dirPath);
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (results.length >= maxResults) break;

    const fullPath = path.join(dirPath, entry);
    let entryStat: ReturnType<typeof stat> extends Promise<infer T> ? T : never;

    try {
      entryStat = await stat(fullPath);
    } catch {
      continue;
    }

    if (entryStat.isDirectory()) {
      if (entry === 'node_modules' || entry === '.git') continue;
      const subResults = await recursiveGrep(fullPath, searchRegex, includeRegex, basePath, maxResults - results.length);
      results.push(...subResults);
    } else if (entryStat.isFile()) {
      const relativePath = path.relative(basePath, fullPath);
      if (includeRegex && !includeRegex.test(relativePath)) continue;
      if (entryStat.size > MAX_FILE_SIZE) continue;

      try {
        const content = await readFile(fullPath, 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (results.length >= maxResults) break;
          if (searchRegex.test(lines[i])) {
            results.push({
              filePath: fullPath,
              lineNumber: i + 1,
              lineContent: lines[i].trimEnd(),
            });
          }
        }
      } catch {
        // skip files that can't be read (binary, permission, etc.)
      }
    }
  }

  return results;
}

export const grepTool: Tool<GrepArgs> = {
  name: 'grep',
  description: 'Search file contents for a regex pattern. Returns matches with file paths and line numbers.',
  parameters: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Regular expression pattern to search for',
      },
      path: {
        type: 'string',
        description: 'Root directory to search in. Defaults to current working directory.',
      },
      include: {
        type: 'string',
        description: 'Glob pattern to filter files (e.g., "*.ts", "*.{js,ts}")',
      },
    },
    required: ['pattern'],
  },

  async handler(args: GrepArgs): Promise<string> {
    const rootPath = args.path ? path.resolve(args.path) : process.cwd();
    const includeRegex = args.include ? globToIncludeRegex(args.include) : null;

    let searchRegex: RegExp;
    try {
      searchRegex = new RegExp(args.pattern, 'm');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return `Error: Invalid regex pattern "${args.pattern}": ${message}`;
    }

    let results: MatchResult[];
    try {
      results = await recursiveGrep(rootPath, searchRegex, includeRegex, rootPath, MAX_RESULTS);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return `Error searching: ${message}`;
    }

    if (results.length === 0) {
      return `No matches found for pattern "${args.pattern}" in ${rootPath}`;
    }

    const sorted = results.sort((a, b) => {
      const pathCmp = a.filePath.localeCompare(b.filePath);
      return pathCmp !== 0 ? pathCmp : a.lineNumber - b.lineNumber;
    });

    const lines = sorted.map(
      (m) => `${m.filePath}:${m.lineNumber}: ${m.lineContent}`,
    );

    let output = lines.join('\n');
    if (results.length >= MAX_RESULTS) {
      output += `\n\n(Results limited to ${MAX_RESULTS} matches)`;
    }

    return output;
  },
};
