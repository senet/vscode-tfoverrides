# TypeScript Type Check

Run TypeScript type checking without emitting files (catches errors that webpack's transpileOnly mode misses):

```bash
cd /home/prosenjitsen/playground/vscode-tfoverrides && npx tsc --noEmit 2>&1
```

Report any type errors with their file and line number. A clean run produces no output. Fix all errors before packaging.
