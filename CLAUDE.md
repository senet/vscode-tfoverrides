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

## Modernization Roadmap

| Priority | Item | Effort |
|----------|------|--------|
| High | **Add TypeScript strict type checking to CI** — run `tsc --noEmit` in pretest | Low |
| High | **Add GitHub Actions CI** — test + typecheck on push/PR | Low |
| High | **TypeScript 4.4 → 5.x** — improved type narrowing, const enums, decorator metadata | Medium |
| Medium | **ESLint + Prettier** — add `@typescript-eslint/eslint-plugin` and `.eslintrc.json` | Medium |
| Medium | **Complete sidebar feature** — add `views`/`viewsContainers` to package.json, integrate `extension_sidePanel.ts`, or delete it if not planned | Medium |
| Medium | **HCL parser robustness** — handle multi-line variable blocks; consider a tokenizer | High |
| Low | **`vscode-test` → `@vscode/test-electron`** — `vscode-test` is deprecated | Low |
| Low | **node-fetch v2 → v3** — requires ESM bundling change in webpack | High |
| Low | **Provider abstraction** — currently AWS-only; could prompt for provider type | Medium |

---

## Packaging & Publishing

```bash
npx vsce package                  # creates tfoverrides-x.y.z.vsix
npx vsce publish --pat $VSCE_PAT  # publishes to marketplace
```

The `.vscodeignore` excludes `test/`, `src/**/*.ts`, and `tsconfig.json` from the VSIX.
