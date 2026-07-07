import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import type { Tool } from '../types.js';
import { validatePath } from '../../utils/helpers.js';

interface GlobArgs {
  pattern: string;
  path?: string;
}

function globToRegex(pattern: string): RegExp {
  let regexStr = pattern
    .replace(/\*\*/g, '___GLOBSTAR___')
    .replace(/\*/g, '___STAR___')
    .replace(/\?/g, '___QMARK___')
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/___GLOBSTAR___/g, '.*')
    .replace(/___STAR___/g, '[^/]*')
    .replace(/___QMARK___/g, '[^/]');
  return new RegExp(`^${regexStr}$`);
}

const DEFAULT_SKIP_DIRS = new Set(['node_modules', '.git', '.svn', '.hg', '.DS_Store'])

async function recursiveFind(
  dirPath: string,
  regex: RegExp,
  basePath: string,
  maxResults: number,
  skipDirs?: string[],
): Promise<string[]> {
  const results: string[] = [];
  let entries: string[];
  const skip = skipDirs ? new Set(skipDirs) : DEFAULT_SKIP_DIRS

  try {
    entries = await readdir(dirPath);
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (results.length >= maxResults) break;
    if (skip.has(entry)) continue;

    const fullPath = path.join(dirPath, entry);
    const relativePath = path.relative(basePath, fullPath);
    let entryStat;

    try {
      entryStat = await stat(fullPath);
    } catch {
      continue;
    }

    if (entryStat.isDirectory()) {
      if (regex.test(relativePath + '/')) {
        results.push(fullPath);
      }
      if (results.length < maxResults) {
        const subResults = await recursiveFind(fullPath, regex, basePath, maxResults - results.length, skipDirs);
        results.push(...subResults);
      }
    } else if (entryStat.isFile()) {
      if (regex.test(relativePath)) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

export const globTool: Tool<GlobArgs> = {
  name: 'glob',
  description: 'Find files matching a glob pattern. Supports *, **, and ? patterns.',
  parameters: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Glob pattern to match (e.g., "**/*.ts", "src/**/*.js")',
      },
      path: {
        type: 'string',
        description: 'Root directory to search from. Defaults to current working directory.',
      },
    },
    required: ['pattern'],
  },

  async handler(args: GlobArgs): Promise<string> {
    let rootPath: string;
    try {
      rootPath = validatePath(args.path || process.cwd());
    } catch (err) {
      return `Error: ${err instanceof Error ? err.message : String(err)}`;
    }
    const regex = globToRegex(args.pattern);

    let results: string[];
    try {
      results = await recursiveFind(rootPath, regex, rootPath, 1000);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return `Error searching: ${message}`;
    }

    if (results.length === 0) {
      return `No files found matching pattern "${args.pattern}" in ${rootPath}`;
    }

    const sorted = results.sort();
    return sorted.join('\n');
  },
};
