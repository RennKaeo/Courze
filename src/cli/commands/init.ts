import { Command } from 'commander';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { success, info, error } from '../ui/renderer.js';

export const initCommand = new Command('init')
  .description('Create a .courzerc.jsonc config file')
  .action(async () => {
    const rl = createInterface({ input: stdin, output: stdout });

    try {
      info('Setting up Course Code configuration...');

      const provider = await rl.question(
        'Provider (openai/anthropic/google/ollama) [openai]: ',
      );
      const resolvedProvider = provider.trim() || 'openai';

      const model = await rl.question('Model (leave blank for default): ');
      const resolvedModel = model.trim() || null;

      const mode = await rl.question('Mode (auto/assist) [auto]: ');
      const resolvedMode = mode.trim() || 'auto';

      info('API keys can be stored in .courzerc.jsonc or set via environment variables.');
      const apiKey = await rl.question(
        'API key (leave blank to use env var): ',
      );
      const resolvedApiKey = apiKey.trim() || null;

      const config: Record<string, unknown> = {
        $schema: 'https://raw.githubusercontent.com/course-code/course-code/main/schema.json',
        provider: resolvedProvider,
        mode: resolvedMode,
      };

      if (resolvedModel) {
        config.model = resolvedModel;
      }

      if (resolvedApiKey) {
        config.apiKey = resolvedApiKey;
      }

      const configPath = join(cwd(), '.courzerc.jsonc');
      const content = JSON.stringify(config, null, 2);

      writeFileSync(configPath, content, 'utf-8');
      success(`Configuration written to ${configPath}`);
    } catch (err) {
      error(
        `Failed to create config: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      rl.close();
    }
  });
