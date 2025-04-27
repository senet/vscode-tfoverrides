import * as vscode from 'vscode';
import fetch from 'node-fetch';

interface TerraformVariable {
    name: string;
    type: string | null;
    description: string | null;
    defaultValue: string | null;
}

export class TerraformOverrideSidebarProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async message => {
            switch (message.command) {
                case 'fetchVariables':
                    {
                        const url = message.url as string;
                        const variablesTfUrl = convertGitHubUrlToRaw(url);
                        if (!variablesTfUrl) {
                            this._view?.webview.postMessage({ command: 'error', text: 'Invalid GitHub URL format' });
                            return;
                        }
                        try {
                            const response = await fetch(variablesTfUrl);
                            if (!response.ok) {
                                this._view?.webview.postMessage({ command: 'error', text: `Failed to fetch variables.tf: ${response.status}` });
                                return;
                            }
                            const content = await response.text();
                            const variables = parseTerraformVariables(content);
                            this._view?.webview.postMessage({ command: 'variables', variables });
                        } catch (error) {
                            this._view?.webview.postMessage({ command: 'error', text: `Error fetching variables: ${error}` });
                        }
                    }
                    break;
                case 'generateOverrides':
                    {
                        const overrides = message.overrides as { [key: string]: string };
                        const overrideContent = generateOverrideFileContent(new Map(Object.entries(overrides)));
                        const workspaceFolders = vscode.workspace.workspaceFolders;
                        if (!workspaceFolders) {
                            this._view?.webview.postMessage({ command: 'error', text: 'No workspace folder open' });
                            return;
                        }
                        const workspaceUri = workspaceFolders[0].uri;
                        const overrideFileUri = vscode.Uri.joinPath(workspaceUri, 'overrides.tf');
                        await vscode.workspace.fs.writeFile(overrideFileUri, Buffer.from(overrideContent, 'utf8'));
                        this._view?.webview.postMessage({ command: 'info', text: `Terraform override file created at ${overrideFileUri.fsPath}` });
                        const document = await vscode.workspace.openTextDocument(overrideFileUri);
                        await vscode.window.showTextDocument(document);
                    }
                    break;
            }
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const nonce = getNonce();
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>Terraform Override Helper</title>
            </head>
            <body>
                <h3>Terraform Override Helper</h3>
                <input type="text" id="repoUrl" placeholder="Enter GitHub repo URL" style="width: 100%;" />
                <button id="fetchBtn">Fetch Variables</button>
                <div id="error" style="color: red;"></div>
                <form id="variablesForm" style="margin-top: 10px;"></form>
                <button id="generateBtn" disabled>Generate Overrides</button>

                <script nonce="${nonce}">
                    const vscode = acquireVsCodeApi();

                    const fetchBtn = document.getElementById('fetchBtn');
                    const repoUrlInput = document.getElementById('repoUrl');
                    const errorDiv = document.getElementById('error');
                    const variablesForm = document.getElementById('variablesForm');
                    const generateBtn = document.getElementById('generateBtn');

                    let variables = [];

                    fetchBtn.addEventListener('click', () => {
                        errorDiv.textContent = '';
                        variablesForm.innerHTML = '';
                        generateBtn.disabled = true;
                        const url = repoUrlInput.value.trim();
                        if (!url) {
                            errorDiv.textContent = 'Please enter a GitHub repo URL.';
                            return;
                        }
                        vscode.postMessage({ command: 'fetchVariables', url });
                    });

                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.command) {
                            case 'error':
                                errorDiv.textContent = message.text;
                                break;
                            case 'variables':
                                variables = message.variables;
                                renderVariables(variables);
                                break;
                            case 'info':
                                alert(message.text);
                                break;
                        }
                    });

                    function renderVariables(vars) {
                        variablesForm.innerHTML = '';
                        vars.forEach(v => {
                            const container = document.createElement('div');
                            const label = document.createElement('label');
                            label.textContent = \`\${v.name} (\${v.type || 'unknown'}) - \${v.description || ''}\`;
                            const input = document.createElement('input');
                            input.type = 'text';
                            input.name = v.name;
                            input.placeholder = 'Override value';
                            container.appendChild(label);
                            container.appendChild(document.createElement('br'));
                            container.appendChild(input);
                            variablesForm.appendChild(container);
                        });
                        generateBtn.disabled = false;
                    }

                    generateBtn.addEventListener('click', () => {
                        const formData = new FormData(variablesForm);
                        const overrides = {};
                        for (const [key, value] of formData.entries()) {
                            if (value.trim() !== '') {
                                overrides[key] = value.trim();
                            }
                        }
                        vscode.postMessage({ command: 'generateOverrides', overrides });
                    });
                </script>
            </body>
            </html>
        `;
    }
}

function convertGitHubUrlToRaw(url: string): string | null {
    try {
        const urlObj = new URL(url);
        if (!urlObj.hostname.includes('github.com')) {
            return null;
        }
        const pathParts = urlObj.pathname.replace(/^\/+/g, '').split('/');
        if (pathParts.length < 2) {
            return null;
        }
        const owner = pathParts[0];
        const repo = pathParts[1];
        // Default branch is master
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/master/variables.tf`;
        return rawUrl;
    } catch {
        return null;
    }
}

function parseTerraformVariables(content: string): TerraformVariable[] {
    const variableRegex = /variable\s+"([\w-]+)"\s*{([^}]*)}/gs;
    const typeRegex = /type\s*=\s*([^\n]+)/;
    const descriptionRegex = /description\s*=\s*"([^"]*)"/;
    const defaultRegex = /default\s*=\s*("[^"]*"|[^\n]*)/;

    const variables: TerraformVariable[] = [];
    let match: RegExpExecArray | null;
    while ((match = variableRegex.exec(content)) !== null) {
        const block = match[2];
        const typeMatch = typeRegex.exec(block);
        const descriptionMatch = descriptionRegex.exec(block);
        const defaultMatch = defaultRegex.exec(block);

        variables.push({
            name: match[1],
            type: typeMatch ? typeMatch[1].trim() : null,
            description: descriptionMatch ? descriptionMatch[1].trim() : null,
            defaultValue: defaultMatch ? defaultMatch[1].trim() : null
        });
    }
    return variables;
}

function generateOverrideFileContent(overrides: Map<string, string>): string {
    let content = '';
    overrides.forEach((value, key) => {
        content += `variable "${key}" {\n  default = ${value}\n}\n\n`;
    });
    return content;
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

export function deactivate() {}
