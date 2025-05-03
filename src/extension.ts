import * as vscode from 'vscode';
import fetch from 'node-fetch';

interface TerraformVariable {
    name: string;
    type: string | null;
    description: string | null;
    defaultValue: string | null;
    value?: string | null;
}

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('tfoverrides.generate', async () => {
        try {
            // Prompt for GitHub Terraform module URL
            const repoUrl = await vscode.window.showInputBox({
                prompt: 'Enter GitHub public Terraform module URL',
                ignoreFocusOut: true,
                placeHolder: 'https://github.com/terraform-aws-modules/terraform-aws-ec2-instance'
            });
            if (!repoUrl) {
                vscode.window.showWarningMessage('No URL provided');
                return;
            }

            // Prompt for AWS region
            const awsRegion = await vscode.window.showInputBox({
                prompt: 'Enter AWS region (e.g., us-east-1)',
                ignoreFocusOut: true,
                placeHolder: 'us-east-1'
            });
            if (!awsRegion) {
                vscode.window.showWarningMessage('No AWS region provided');
                return;
            }

            vscode.window.showInformationMessage('Fetching variables.tf from the GitHub module...');

            const variablesTfUrl = convertGitHubUrlToRaw(repoUrl);
            if (!variablesTfUrl) {
                vscode.window.showErrorMessage('Invalid GitHub URL format or unsupported host');
                return;
            }

            const response = await fetch(variablesTfUrl);
            if (!response.ok) {
                vscode.window.showErrorMessage(`Failed to fetch variables.tf: ${response.status} ${response.statusText}`);
                return;
            }

            const content = await response.text();
            const variables = parseTerraformVariables(content);
            if (variables.length === 0) {
                vscode.window.showInformationMessage('No variables found in variables.tf');
                return;
            }

            // Let user select variables to override
            const selectedVariables = await showVariablesQuickPick(variables);
            if (!selectedVariables || selectedVariables.length === 0) {
                vscode.window.showInformationMessage('No variables selected');
                return;
            }

            // Prompt for override values
            const overrides = await promptForOverrideValues(selectedVariables);

            // Generate provider.tf content
            const providerContent = generateProviderFile(awsRegion);

            // Generate main.tf content
            const mainContent = generateMainFile(repoUrl, selectedVariables);

            // Generate overrides.tf content
            const overrideContent = generateOverrideFileContent(overrides);

            // Write files to workspace
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                vscode.window.showErrorMessage('No workspace folder open');
                return;
            }
            const workspaceUri = workspaceFolders[0].uri;

            const providerFileUri = vscode.Uri.joinPath(workspaceUri, 'provider.tf');
            const mainFileUri = vscode.Uri.joinPath(workspaceUri, 'main.tf');
            const overrideFileUri = vscode.Uri.joinPath(workspaceUri, 'overrides.tf');

            await vscode.workspace.fs.writeFile(providerFileUri, Buffer.from(providerContent, 'utf8'));
            await vscode.workspace.fs.writeFile(mainFileUri, Buffer.from(mainContent, 'utf8'));
            await vscode.workspace.fs.writeFile(overrideFileUri, Buffer.from(generateOverrideFileContent(overrides, selectedVariables), 'utf8'));

            vscode.window.showInformationMessage(`Terraform files created: provider.tf, main.tf, overrides.tf`);

            // Optionally open the files
            const providerDoc = await vscode.workspace.openTextDocument(providerFileUri);
            await vscode.window.showTextDocument(providerDoc, { preview: false });

            const mainDoc = await vscode.workspace.openTextDocument(mainFileUri);
            await vscode.window.showTextDocument(mainDoc, { preview: false });

            const overrideDoc = await vscode.workspace.openTextDocument(overrideFileUri);
            await vscode.window.showTextDocument(overrideDoc, { preview: false });

        } catch (error: unknown) {
            vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    });

    context.subscriptions.push(disposable);
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

export function parseTerraformVariables(content: string): TerraformVariable[] {
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

async function showVariablesQuickPick(variables: TerraformVariable[]): Promise<TerraformVariable[] | undefined> {
    const picks = variables.map((v: TerraformVariable) => ({
        label: v.name,
        description: v.type ? `Type: ${v.type}` : '',
        detail: v.description || '',
        variable: v
    }));

    const selected = await vscode.window.showQuickPick(picks, {
        canPickMany: true,
        placeHolder: 'Select variables to override'
    });

    if (!selected) {
        return undefined;
    }

    return selected.map((s: any) => s.variable);
}

async function promptForOverrideValues(variables: TerraformVariable[]): Promise<Map<string, string>> {
    const overrides = new Map<string, string>();

    for (const variable of variables) {
        const value = await vscode.window.showInputBox({
            prompt: `Enter override value for variable "${variable.name}" (${variable.type || 'unknown'})`,
            value: variable.defaultValue || '',
            ignoreFocusOut: true
        });
        if (value !== undefined) {
            overrides.set(variable.name, value);
        }
    }

    return overrides;
}

function generateProviderFile(region: string): string {
    return `provider "aws" {\n  region = "${region}"\n}\n`;
}

function generateMainFile(repoUrl: string, variables: TerraformVariable[]): string {
    let trimmedModulePath = repoUrl.replace(/^https?:\/\//, '');
    trimmedModulePath = trimmedModulePath.replace(/\.git$/, '').replace(/\/tree\/main/, '');

    let mainContent = `module "this" {\n  source = "${trimmedModulePath}"\n\n`;

    variables.forEach(variable => {
        mainContent += `  ${variable.name} = var.${variable.name}\n`;
    });

    mainContent += `}\n`;
    return mainContent;
}

function generateOverrideFileContent(overrides: Map<string, string>, variables: TerraformVariable[]): string {
    let content = '';
    overrides.forEach((value, key) => {
        const variable = variables.find(v => v.name === key);
        const isNumber = !isNaN(Number(value));
        const isBoolean = value.toLowerCase() === 'true' || value.toLowerCase() === 'false';
        let formattedValue = value;
        if (variable && variable.type) {
            const typeLower = variable.type.toLowerCase();
            // Skip quoting for list(string) or map(string)
            if (typeLower.includes('string') && !typeLower.includes('list(string)') && !typeLower.includes('map(string)')) {
                if (!isNumber && !isBoolean) {
                    if (!(value.startsWith('"') && value.endsWith('"'))) {
                        formattedValue = `"${value}"`;
                    }
                }
            }
        }
        content += `variable "${key}" {\n  default = ${formattedValue}\n}\n\n`;
    });
    return content;
}

export function deactivate() {}
