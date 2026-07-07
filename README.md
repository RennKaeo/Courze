# Course Code

Open-source AI coding agent — TUI + CLI, autonomous & assistive mode, multi-provider (OpenAI, Anthropic, Google, Ollama).

## Features

- **Full TUI** — Split-panel terminal UI with home/session views, toast notifications, dialogs
- **Hybrid modes** — Autonomous (plan → execute → review) or assistive (approve each step)
- **Multi-provider** — OpenAI GPT-4o, Anthropic Claude 3.5/4, Google Gemini 2.5, Ollama local
- **Tool system** — File operations, shell execution, code search, web fetch
- **Plugin architecture** — Extend with custom tools and lifecycle hooks
- **Context management** — Token-aware window with automatic summarization

## Install

### Via npm (recommended)
```bash
npm install -g @renskaeo/courze
```

### From source
```bash
# Clone repo
git clone https://github.com/RennKaeo/Courze.git
cd Courze

# Install dependencies (including gpt-tokenizer, json5, turndown)
npm install

# Build TypeScript
npm run build

# Link globally
npm link

# Verify installation
course --version
```

### On Termux / Android (proot-distro)
```bash
# Install Ubuntu in proot-distro
pkg install proot-distro
proot-distro install ubuntu
proot-distro login ubuntu

# Inside Ubuntu, install Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | bash
apt install -y nodejs git

# Clone and build
git clone https://github.com/RennKaeo/Courze.git
cd Courze
npm install
npm run build
npm link

# Run
course start
```

## Quick Start

```bash
# Set your API key
export OPENAI_API_KEY=sk-...
# or
export ANTHROPIC_API_KEY=sk-ant-...
# or
export GOOGLE_API_KEY=...

# Start TUI interactive session
course start

# Basic CLI mode (no TUI)
course start --no-tui

# Or run a one-shot task
course run "Add a README to this project"

# Create config file
course init
```

## TUI Controls

| Key | Action |
|-----|--------|
| `Enter` | Submit task |
| `Esc` / `q` | Go home / quit |
| `Ctrl-C` | Abort running task |
| `h` | Go to home view |
| `y` / `n` / `a` | Approve / reject / always (assist mode) |

## Commands

| Command | Description |
|---------|-------------|
| `course start` | Start TUI interactive session |
| `course start --no-tui` | Start basic CLI session |
| `course run <task>` | Run a single task autonomously |
| `course init` | Create `.courzerc.jsonc` config |
| `course --help` | Show help |
| `course --version` | Show version |

## Configuration

Create `.courzerc.jsonc` in your project:

```jsonc
{
  "provider": "anthropic",      // openai | anthropic | google | ollama
  "model": "claude-sonnet-4-20250514",
  "mode": "auto",                // auto | assist
  "maxIterations": 25,
  "temperature": 0.7,
  "maxTokens": 4096
}
```

Environment variables:
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`
- `OLLAMA_BASE_URL` (default: http://localhost:11434)

## Architecture

```
┌─ CLI ─────────────────────────────────┐
│  course start / run / init             │
├─ TUI (blessed) ───────────────────────┤
│  Home View → Session View              │
│  Toast / Dialog / Theme system         │
├─ Agent ───────────────────────────────┤
│  Planner → Executor → Tool Loop        │
├─ Tools ───────────────────────────────┤
│  read, write, edit, glob, bash, grep   │
├─ LLM Providers ───────────────────────┤
│  OpenAI / Anthropic / Google / Ollama  │
└────────────────────────────────────────┘
```

## Project Structure

```
src/
├── index.ts              # Entry point
├── cli/                  # CLI commands (start, run, init)
├── agent/                # Agent orchestrator, planner, executor
├── tools/                # File ops, shell, search tools
├── llm/                  # Provider interface + 4 providers
├── tui/                  # Full TUI with components/
│   └── components/       # Toast, Dialog, Theme
├── context/              # Token-aware context manager
├── config/               # Schema + loader (global/project)
├── plugins/              # Plugin lifecycle hooks
└── utils/                # Logger, errors, helpers
```

## License

GPL-3.0-only
