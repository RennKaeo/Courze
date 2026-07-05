# Course Code

Open-source AI coding agent — autonomous & assistive mode, multi-provider (OpenAI, Anthropic, Google, Ollama).

## Features

- **Hybrid modes**: Autonomous agent (plan → execute → review) or assistive pair-programmer (you approve each step)
- **Multi-provider LLM support**: OpenAI GPT-4o, Anthropic Claude 3.5/4, Google Gemini 2.5, Ollama local models
- **Tool system**: File operations, shell execution, code search, web fetch/search
- **Context management**: Token-aware window with automatic summarization
- **Plugin architecture**: Extend with custom tools and hooks
- **Config layering**: Global, project, and local config (JSONC)

## Install

```bash
# From npm (when published)
npm install -g course-code

# Or run directly from source
git clone https://github.com/RennKaeo/Courze
cd Courze
npm install
npm run build
npm link
```

## Quick Start

```bash
# Set your API keys
export OPENAI_API_KEY=sk-...
# or
export ANTHROPIC_API_KEY=sk-ant-...
# or
export GOOGLE_API_KEY=...

# Start interactive session
course start

# Or run a one-shot task
course run "Add a README to this project"
```

## Commands

| Command | Description |
|---------|-------------|
| `course start` | Start interactive coding session |
| `course run <task>` | Run a single task autonomously |
| `course init` | Create config file in current project |
| `course config` | View/edit configuration |

## Configuration

Create `.course/config.jsonc` in your project:

```jsonc
{
  "provider": "anthropic",      // openai | anthropic | google | ollama
  "model": "claude-3-5-sonnet-20241022",
  "mode": "hybrid",             // autonomous | assistive | hybrid
  "maxTokens": 128000,
  "temperature": 0.1,
  "tools": {
    "bash": true,
    "webSearch": false,
    "webFetch": true
  },
  "approvals": {
    "bash": "ask",              // auto | ask | deny
    "write": "ask",
    "delete": "ask"
  }
}
```

Environment variables override config:
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`
- `OLLAMA_HOST` (default: http://localhost:11434)

## Architecture

```
CLI → Session Manager → Agent (Planner + Executor)
                        ↓
                   Tool Registry
                   (read, write, edit, bash, glob, grep, web)
                        ↓
              LLM Provider Layer
              (OpenAI / Anthropic / Google / Ollama)
```

## License

GPL-3.0-only