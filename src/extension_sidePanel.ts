import * as vscode from 'vscode';
import { TerraformOverrideSidebarProvider } from './sidebarView';

/**
 * This method is called when the extension is activated.
 * It registers the sidebar Webview View provider and the command to reveal the sidebar.
 */
export function activate(context: vscode.ExtensionContext) {
    // Register the sidebar view provider
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'terraformOverrideHelper.sidebarView', // View ID must match package.json
            new TerraformOverrideSidebarProvider(context.extensionUri)
        )
    );

    // Register the command to reveal the sidebar view
    context.subscriptions.push(
        vscode.commands.registerCommand('terraformOverrideHelper.generateOverrides', () => {
            vscode.commands.executeCommand('workbench.view.extension.terraformOverrideHelper-sidebar');
        })
    );
}

/**
 * This method is called when the extension is deactivated.
 */
export function deactivate() {
    // Cleanup if necessary
}
