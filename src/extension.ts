import * as vscode from 'vscode';
import fetch from 'node-fetch';
import {
    TerraformVariable,
    parseGitHubRepoUrl,
    buildRawVariablesUrl,
    parseTerraformVariables,
    generateOverrideFileContent
} from './shared';

export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('tfoverrides.generate', async () => {
        try {
            const repoUrl = await vscode.window.showInputBox({
                prompt: 'Enter GitHub public Terraform module URL',
                ignoreFocusOut: true,
                placeHolder: 'https://github.com/terraform-aws-modules/terraform-aws-ec2-instance'
            });
            if (!repoUrl) {
                vscode.window.showWarningMessage('No URL provided');
                return;
            }

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

            const parsed = parseGitHubRepoUrl(repoUrl);
            if (!parsed) {
                vscode.window.showErrorMessage('Invalid GitHub URL format or unsupported host');
                return;
            }

            const content = await fetchVariablesTf(parsed.owner, parsed.repo);
            if (!content) {
                return;
            }

            const variables = parseTerraformVariables(content);
            if (variables.length === 0) {
                vscode.window.showInformationMessage('No variables found in variables.tf');
                return;
            }

            const selectedVariables = await showVariablesQuickPick(variables);
            if (!selectedVariables || selectedVariables.length === 0) {
                vscode.window.showInformationMessage('No variables selected');
                return;
            }

            const overrides = await promptForOverrideValues(selectedVariables);

            const providerContent = generateProviderFile(awsRegion);
            const mainContent = generateMainFile(repoUrl, selectedVariables);
            const overrideContent = generateOverrideFileContent(overrides, selectedVariables);

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
            await vscode.workspace.fs.writeFile(overrideFileUri, Buffer.from(overrideContent, 'utf8'));

            vscode.window.showInformationMessage('Terraform files created: provider.tf, main.tf, overrides.tf');

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

// Tries 'main' branch first, falls back to 'master' on 404.
async function fetchVariablesTf(owner: string, repo: string): Promise<string | null> {
    for (const branch of ['main', 'master']) {
        const url = buildRawVariablesUrl(owner, repo, branch);
        const response = await fetch(url);
        if (response.ok) {
            return response.text();
        }
        if (response.status !== 404) {
            vscode.window.showErrorMessage(`Failed to fetch variables.tf: ${response.status} ${response.statusText}`);
            return null;
        }
    }
    vscode.window.showErrorMessage('Could not find variables.tf on main or master branch');
    return null;
}

async function showVariablesQuickPick(variables: TerraformVariable[]): Promise<TerraformVariable[] | undefined> {
    const picks = variables.map(v => ({
        label: v.name,
        description: v.type ? `Type: ${v.type}` : '',
        detail: v.description || '',
        variable: v
    }));

    const selected = await vscode.window.showQuickPick(picks, {
        canPickMany: true,
        placeHolder: 'Select variables to override'
    });

    return selected?.map(s => s.variable);
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
    return mainContent + '}\n';
}

export function deactivate() {}
