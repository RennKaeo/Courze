import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import type { Tool } from '../types.js';

interface GlobArgs {
  pattern: string;
  path?: string;
}

function globToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regexStr = escaped
    .replace(/\*\*/g, '___GLOBSTAR___')
    .replace(/\*/g, '[^/]*')
    .replace(/___GLOBSTAR___/g, '.*')
    .replace(/\?/g, '[^/]');
  return new RegExp(`^${regexStr}$`);
}

async function recursiveFind(
  dirPath: string,
  regex: RegExp,
  basePath: string,
  maxResults: number,
): Promise<string[]> {
  const results: string[] = [];
  let entries: string[];

  try {
    entries = await readdir(dirPath);
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (results.length >= maxResults) break;

    const fullPath = path.join(dirPath, entry);
    const relativePath = path.relative(basePath, fullPath);
    let entryStat: ReturnType<typeof stat> extends Promise<infer T> ? T : never;

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
        const subResults = await recursiveFind(fullPath, regex, basePath, maxResults - results.length);
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
    const rootPath = args.path ? path.resolve(args.path) : process.cwd();
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
