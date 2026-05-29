# Package Extension

Build a VSIX package for the extension:

```bash
cd /home/prosenjitsen/playground/vscode-tfoverrides && npx vsce package 2>&1
```

Report the output file name and size. If packaging fails, show the full error. The resulting `.vsix` file can be installed in VS Code via "Install from VSIX".

Note: bump the version in `package.json` and update `CHANGELOG.md` before packaging a new release.
