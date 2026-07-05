import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startCommand } from './commands/start.js';
import { runCommand } from './commands/run.js';
import { initCommand } from './commands/init.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../../package.json'), 'utf-8'),
);

const program = new Command();

program
  .name('course')
  .description('Open source AI coding agent')
  .version(packageJson.version);

program.addCommand(startCommand);
program.addCommand(runCommand);
program.addCommand(initCommand);

export { program };
