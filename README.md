# TF Overrides Generator

A VS Code extension for generating Terraform override files from existing GitHub public Terraform modules.

## Features

- Generate Terraform configuration files (provider.tf, main.tf, overrides.tf) from existing GitHub public Terraform modules
- Detect Terraform modules in public GitHub repositories with:
  - Automatic module detection
  - Variable extraction
  - Request caching
  - Error handling
- Integrated with VS Code's command palette
- Currently supports Terraform + AWS provider only

## GitHub Public Repository Detection

The extension specializes in detecting Terraform modules from public GitHub repositories with:

- Improved API request handling
- Better error messages
- More accurate variable detection
- Comprehensive test coverage

## Installation

1. Install the extension from the VS Code Marketplace
2. Or load from the packaged .vsix file

## Usage

1. Open a Terraform file or workspace
2. Run the "Generate TF Overrides" command from the command palette (Ctrl+Shift+P)
3. Enter the GitHub Terraform module URL and AWS region when prompted
4. Select variables to override and provide override values
5. The extension generates provider.tf, main.tf, and overrides.tf files in your workspace

## Web Application

For a web-based interface to generate Terraform overrides, visit the [TF Overrides Web App](https://tfoverrides.dev).

## Development

To contribute or run locally:

1. Clone the repository
2. Run `npm install`
3. Run tests with `npm test`

## Build

To build the extension locally and create a VSIX package:

1. Ensure you have Node.js and npm installed
2. Install vsce if not already installed: `npm install -g @vscode/vsce`
3. Run the package command: `npx vsce package`
4. This will generate a `.vsix` file (e.g., `tfoverrides-0.1.3.vsix`) in the project root
5. You can install the VSIX file in VS Code via the Extensions view "Install from VSIX..." option

## Requirements

- VS Code 1.75.0 or higher
- Node.js 16.x or higher
- Internet access for GitHub API calls

## Testing Framework

- Uses Mocha as the test framework
- Tests run with ts-node for TypeScript support
- The 'vscode' module is mocked in tests for compatibility with Node.js environment and WSL
