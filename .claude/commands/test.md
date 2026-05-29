# Run Tests

Run the Mocha test suite (no VS Code host required):

```bash
cd /home/prosenjitsen/playground/vscode-tfoverrides && npm test 2>&1
```

Report: number of tests passing/failing, any error messages. If tests fail, show the stack traces. The tests live in `test/extension.test.ts` and import from `src/shared.ts`.
