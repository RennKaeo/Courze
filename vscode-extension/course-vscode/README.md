# Course Code VS Code Extension

A practical VS Code companion for Course Code with a project-aware **Control Center**, predictable terminal launch behavior, and quick access to useful Course Code workflows.

## Features

- **Real Control Center status** in the Activity Bar:
  - whether the configured `course` command is installed
  - the launch command being used
  - whether the launch shim injects `CLAUDE_CODE_USE_OPENAI=1`
  - the current workspace folder
  - the launch cwd that will be used for terminal sessions
  - whether `.courzerc.json` exists in the current workspace root
  - a conservative provider summary derived from the workspace profile or known environment flags
- **Project-aware launch behavior**:
  - `Launch Course Code` launches from the active editor's workspace when possible
  - falls back to the first workspace folder when needed
  - avoids launching from an arbitrary default cwd when a project is open
- **Practical sidebar actions**:
  - Launch Course Code
  - Launch in Workspace Root
  - Open Workspace Profile
  - Open Repository
  - Open Setup Guide
  - Open Command Palette
- **Built-in dark theme**: `Course Code Terminal Black`
- **Microsoft Foundry / Azure OpenAI**: optional wizard and settings store endpoint, API version, deployment name, and API key (Secret Storage); launch injects `OPENAI_*` and `AZURE_OPENAI_API_VERSION` into the Course Code terminal (see `docs/advanced-setup.md` on the repo).

## Requirements

- VS Code `1.95+`
- `course` available in your terminal PATH (`npm install -g @renskaeo/courze@latest`)

## Commands

- `Course Code: Open Control Center`
- `Course Code: Launch in Terminal`
- `Course Code: Launch in Workspace Root`
- `Course Code: Open Repository`
- `Course Code: Open Setup Guide`
- `Course Code: Open Workspace Profile`
- `Course Code: New Chat` / `Course Code: Open Chat Panel` / `Course Code: Resume Session` / `Course Code: Abort Generation`
- `Course Code: Configure Azure / Foundry Chat (wizard)`
- `Course Code: Set Azure / Foundry API Key (Secret Storage)`
- `Course Code: Clear Azure / Foundry API Key`
- `Course Code: Open Azure / Foundry Settings`

## Microsoft Foundry / Azure OpenAI (terminal chat)

1. Command Palette → **Course Code: Configure Azure / Foundry Chat (wizard)** and enter endpoint, API version, deployment name, and API key; or set `course.azure.*` in Settings and use **Course Code: Set Azure / Foundry API Key**.
2. Enable **Course Code: Azure: Enabled** (the wizard turns this on).
3. **Course Code: Launch in Terminal** — the extension merges env vars the OpenAI shim expects (`CLAUDE_CODE_USE_OPENAI`, `OPENAI_BASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `AZURE_OPENAI_API_VERSION`, and `OPENAI_AZURE_STYLE` when forced).

If you use `.courzerc.json` for the same workspace, leave Azure injection off to avoid conflicting provider configuration.

## Settings

- `course.launchCommand` (default: `course`)
- `course.terminalName` (default: `Course Code`)
- `course.useOpenAIShim` (default: `false`)
- `course.azure.*` — Foundry / Azure OpenAI terminal injection (see Settings UI)
- `course.permissionMode` — chat permission mode

`course.useOpenAIShim` only injects `CLAUDE_CODE_USE_OPENAI=1` when Azure injection did not already set it. It does not configure endpoints or keys by itself.

## Notes on Status Detection

- Provider status prefers the real workspace `.courzerc.json` file when present.
- If no saved profile exists, the extension falls back to known environment flags available to the VS Code extension host.
- If the source of truth is unclear, the extension shows `unknown` instead of guessing.

## Development

From this folder:

```bash
npm run test
npm run lint
```

To package (optional):

```bash
npm run package
```

