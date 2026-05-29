# Build Extension

Run the webpack production build and report any output:

```bash
cd /home/prosenjitsen/playground/vscode-tfoverrides && npm run compile 2>&1
```

After the build, check `out/extension.js` exists and report the bundle size. If the build fails, show the full error output.
