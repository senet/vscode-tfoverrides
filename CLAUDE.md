# CLAUDE.md

## Project Overview

**TF Override Generator** (`tfoverrides`) is a VS Code extension that generates Terraform override files from public GitHub module repositories. Given a GitHub URL, it fetches `variables.tf`, lets the user select and override variables, and writes `provider.tf`, `main.tf`, and `overrides.tf` to the workspace.

Publisher: `senet` | Marketplace ID: `tfoverrides` | Current version: `0.1.4`

---

## Architecture

```
src/
  shared.ts           — pure types and functions; no vscode dependency; importable by tests
  extension.ts        — main entry point; registers tfoverrides.generate command
  sidebarView.ts      — WebviewViewProvider for sidebar UI (not yet wired into package.json)
  extension_sidePanel.ts — alternate activate() stub for sidebar mode; currently unused

test/
  extension.test.ts   — Mocha tests; imports from src/shared.ts directly
  runTest.ts          — Mocha runner (glob-based discovery)
```

**Data flow (command palette flow):**
1. User runs `Generate TF Overrides` → URL prompt → AWS region prompt
2. `parseGitHubRepoUrl()` extracts owner/repo from the URL
3. `fetchVariablesTf()` tries `main` branch, falls back to `master` on 404
4. `parseTerraformVariables()` regex-parses HCL into `TerraformVariable[]`
5. User picks variables via QuickPick, enters values via InputBox
6. `generateOverrideFileContent()` with `formatOverrideValue()` writes type-aware HCL
7. Three `.tf` files written to workspace root and opened

---

## Key Patterns

### Branch fallback
`fetchVariablesTf()` in `extension.ts` (and the inline fetch in `sidebarView.ts`) tries `main` first, then `master`. Any new GitHub fetch code must follow this pattern.

### Type-aware HCL value formatting
`formatOverrideValue()` in `shared.ts` quotes `string` values but not numbers, booleans, `list(string)`, or `map(string)`. All override generation must go through this function.

### Shared pure module
`src/shared.ts` has no vscode import — keep it that way. Tests import from it directly without needing a VS Code host.

### Sidebar state
`TerraformOverrideSidebarProvider._variables` holds the last-fetched variable list so the `generateOverrides` message handler can apply type-aware formatting.

---

## Build & Test Commands

```bash
npm run compile        # webpack production build → out/extension.js
npm run watch          # webpack dev watch (transpileOnly, no type checking)
npm test               # mocha tests (no VS Code host required)
npx tsc --noEmit       # type-check without emitting (catches errors webpack misses)
npx vsce package       # create .vsix package
npx vsce publish       # publish to VS Code marketplace (requires VSCE_PAT env var)
```

> **Note:** webpack uses `transpileOnly: true` (no type checking). Always run `npx tsc --noEmit` before packaging to catch type errors.

---

## Known Limitations

- **Regex HCL parser**: `parseTerraformVariables()` only handles single-line `type`, `description`, and `default` fields. Multi-line expressions (nested objects, heredocs) are silently skipped.
- **Sidebar not activated**: `sidebarView.ts` is compiled but not wired into `package.json` (no `views` contribution, no `viewsContainers`). `extension_sidePanel.ts` is an unused activate stub for this feature.
- **AWS-only**: Provider file is hardcoded to AWS.

---

## Roadmap

### Phase 1 — Core Gaps (v0.2)
| # | Item | Notes | Effort |
|---|------|-------|--------|
| 1.1 | **Wire sidebar** | `sidebarView.ts` is complete; add `viewsContainers`/`views` to `package.json` and register provider in `extension.ts` | Low |
| 1.2 | **Multi-cloud provider** | QuickPick: AWS / Azure / GCP / Other; per-provider `generateProviderFile()` in `shared.ts` | Low-med |
| 1.3 | **File overwrite protection** | `vscode.workspace.fs.stat()` check; prompt Overwrite / Cancel / Merge (overrides-only) | Low |
| 1.4 | **Terraform Registry URL support** | Resolve `registry.terraform.io` and `<ns>/<mod>/<provider>` source strings via Registry API | Medium |
| 1.5 | **Non-root `variables.tf` paths** | Try common subdirs on 404; optional path suffix input | Low-med |

### Phase 2 — UX Polish (v0.3–v0.4)
| # | Item | Notes | Effort |
|---|------|-------|--------|
| 2.1 | **File preview before write** | Open generated content as untitled docs; Confirm & Write step | Low |
| 2.2 | **Recent repos history** | `context.globalState` for last N URLs; pre-populate QuickPick | Low |
| 2.3 | **Variable grouping** | Required (no default) on top with separator; default shown in `detail` field | Low |
| 2.4 | **Progress indicators** | `vscode.window.withProgress()` wrapping fetch+parse | Very low |
| 2.5 | **Sidebar UX** | `@vscode/webview-ui-toolkit` components; loading states; required-variable badges | Medium |

### Phase 3 — Advanced Features (v0.5–v0.6)
| # | Item | Notes | Effort |
|---|------|-------|--------|
| 3.1a | **Multi-line HCL (regex)** | Extend variable regex to handle nested `{}`; quick win | Low |
| 3.1b | **Full HCL tokenizer** | State-machine tokenizer; handles `object({})`, `tuple([])`, `any`, heredocs | High |
| 3.2 | **Private GitHub repos** | GitHub token in `SecretStorage`; `Authorization` header; 401 prompt | Medium |
| 3.3 | **`.tfvars` output option** | Generate `terraform.tfvars` as alternative to `overrides.tf` | Low |
| 3.4 | **Auto-detect existing modules** | Scan workspace `main.tf` for `source =` blocks; pre-fill URL | Medium |

### Phase 4 — Tech Modernization (ongoing)
| # | Item | Effort |
|---|------|--------|
| 4.1 | **TypeScript 4.4 → 5.x** | Low |
| 4.2 | **ESLint + Prettier** (`@typescript-eslint/eslint-plugin`) | Low |
| 4.3 | **`vscode-test` → `@vscode/test-electron`** | Low |
| 4.4 | ~~**Remove `node-fetch`** — use Node 18 native `fetch`~~ ✓ done v0.1.6 | Low |
| 4.5 | **`@vscode/webview-ui-toolkit`** in sidebar | Medium |
| 4.6 | **`tsc --noEmit` in `pretest`** script | Very low |

---

## Packaging & Publishing

```bash
npx vsce package                  # creates tfoverrides-x.y.z.vsix
npx vsce publish --pat $VSCE_PAT  # publishes to marketplace
```

The `.vscodeignore` excludes `test/`, `src/**/*.ts`, and `tsconfig.json` from the VSIX.
