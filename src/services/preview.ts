import * as vscode from 'vscode';
import { CatalogItem, PreviewOptions } from '../types';
import { GitHubFetchService } from './fetch';
import MarkdownIt from 'markdown-it';

export class PreviewService {
  private readonly fetchService: GitHubFetchService;
  private readonly md: MarkdownIt;

  constructor() {
    this.fetchService = new GitHubFetchService();
    this.md = new MarkdownIt({
      html: false,
      linkify: true,
      typographer: true,
    });
  }

  async showPreview(item: CatalogItem): Promise<void> {
    try {
      const content = await this.fetchService.fetchFileContent(item.rawUrl);
      
      // Chat modes are markdown-based; render as markdown.
      await this.showMarkdownPreview(item, content);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to load preview: ${error}`);
    }
  }

  private async showMarkdownPreview(item: CatalogItem, content: string): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      'awesomeCopilotPreview',
      `Preview: ${item.title}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    const htmlContent = this.md.render(content);
    const fullHtml = this.getMarkdownHtml(item, htmlContent);

    panel.webview.html = fullHtml;

    // Handle messages from webview
    panel.webview.onDidReceiveMessage(async message => {
      switch (message.command) {
        case 'openBuiltInPreview':
          this.openBuiltInPreview(item);
          break;
        case 'copyContent':
          await vscode.env.clipboard.writeText(content);
          vscode.window.showInformationMessage('Content copied to clipboard');
          break;
        case 'openRaw':
          vscode.env.openExternal(vscode.Uri.parse(item.rawUrl));
          break;
        case 'openGitHub':
          const githubUrl = `https://github.com/github/awesome-copilot/blob/main/${item.path}`;
          vscode.env.openExternal(vscode.Uri.parse(githubUrl));
          break;
        case 'install':
          // Reuse InstallerService to install on demand
          const installer = new (await import('./installer')).InstallerService();
          try {
            await installer.installItem(item, { location: 'workspace', useDeepLinks: true });
          } catch (e) {
            vscode.window.showErrorMessage(`Install failed: ${e}`);
          }
          break;
      }
    });
  }

  private async showJsonPreview(item: CatalogItem, content: string): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      'awesomeCopilotPreview',
      `Preview: ${item.title}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    let jsonContent: string;
    try {
      const parsed = JSON.parse(content);
      jsonContent = JSON.stringify(parsed, null, 2);
    } catch {
      jsonContent = content;
    }

    const fullHtml = this.getJsonHtml(item, jsonContent);
    panel.webview.html = fullHtml;

    // Handle messages from webview
    panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'copyJson':
            vscode.env.clipboard.writeText(jsonContent);
            vscode.window.showInformationMessage('JSON copied to clipboard');
            break;
          case 'openRaw':
            vscode.env.openExternal(vscode.Uri.parse(item.rawUrl));
            break;
          case 'openGitHub':
            const githubUrl = `https://github.com/github/awesome-copilot/blob/main/${item.path}`;
            vscode.env.openExternal(vscode.Uri.parse(githubUrl));
            break;
        }
      }
    );
  }

  private getMarkdownHtml(item: CatalogItem, htmlContent: string): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${item.title}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
          }
          .title {
            font-size: 24px;
            font-weight: 600;
            margin: 0;
          }
          .type-badge {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            text-transform: uppercase;
            font-weight: 500;
          }
          .actions {
            display: flex;
            gap: 10px;
          }
          .btn {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            text-decoration: none;
            display: inline-block;
          }
          .btn:hover {
            background-color: var(--vscode-button-hoverBackground);
          }
          .content {
            background-color: var(--vscode-editor-background);
            padding: 20px;
            border-radius: 6px;
            border: 1px solid var(--vscode-panel-border);
          }
          .content h1, .content h2, .content h3, .content h4, .content h5, .content h6 {
            color: var(--vscode-editor-foreground);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 8px;
          }
          .content code {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 2px 4px;
            border-radius: 3px;
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
          }
          .content pre {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 16px;
            border-radius: 6px;
            overflow-x: auto;
          }
          .content pre code {
            background: none;
            padding: 0;
          }
          .content blockquote {
            border-left: 4px solid var(--vscode-textBlockQuote-border);
            margin: 0;
            padding-left: 16px;
            color: var(--vscode-textBlockQuote-foreground);
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">${item.title}</h1>
            <span class="type-badge">${item.type}</span>
          </div>
          <div class="actions">
            <button class="btn" onclick="openBuiltInPreview()">Open with Built-in Preview</button>
            <button class="btn" onclick="copyContent()">Copy Content</button>
            <button class="btn" onclick="installItem()">Install</button>
            <button class="btn" onclick="openRaw()">Open Raw</button>
            <button class="btn" onclick="openGitHub()">View on GitHub</button>
          </div>
        </div>
        <div class="content">
          ${htmlContent}
        </div>
        <script>
          const vscode = acquireVsCodeApi();
          
          function openBuiltInPreview() {
            vscode.postMessage({ command: 'openBuiltInPreview' });
          }
          
          function copyContent() {
            vscode.postMessage({ command: 'copyContent' });
          }
          
          function openRaw() {
            vscode.postMessage({ command: 'openRaw' });
          }
          
          function openGitHub() {
            vscode.postMessage({ command: 'openGitHub' });
          }

          function installItem() {
            vscode.postMessage({ command: 'install' });
          }
        </script>
      </body>
      </html>
    `;
  }

  private getJsonHtml(item: CatalogItem, jsonContent: string): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${item.title}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
          }
          .title {
            font-size: 24px;
            font-weight: 600;
            margin: 0;
          }
          .type-badge {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            text-transform: uppercase;
            font-weight: 500;
          }
          .actions {
            display: flex;
            gap: 10px;
          }
          .btn {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            text-decoration: none;
            display: inline-block;
          }
          .btn:hover {
            background-color: var(--vscode-button-hoverBackground);
          }
          .content {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 20px;
            border-radius: 6px;
            border: 1px solid var(--vscode-panel-border);
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
            white-space: pre-wrap;
            overflow-x: auto;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">${item.title}</h1>
            <span class="type-badge">${item.type}</span>
          </div>
          <div class="actions">
            <button class="btn" onclick="copyJson()">Copy JSON</button>
            <button class="btn" onclick="openRaw()">Open Raw</button>
            <button class="btn" onclick="openGitHub()">View on GitHub</button>
          </div>
        </div>
        <div class="content">${this.escapeHtml(jsonContent)}</div>
        <script>
          const vscode = acquireVsCodeApi();
          
          function copyJson() {
            vscode.postMessage({ command: 'copyJson' });
          }
          
          function openRaw() {
            vscode.postMessage({ command: 'openRaw' });
          }
          
          function openGitHub() {
            vscode.postMessage({ command: 'openGitHub' });
          }
        </script>
      </body>
      </html>
    `;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private async openBuiltInPreview(item: CatalogItem): Promise<void> {
    try {
      const content = await this.fetchService.fetchFileContent(item.rawUrl);
      const document = await vscode.workspace.openTextDocument({
        content,
        language: 'markdown',
      });
      await vscode.window.showTextDocument(document);
      await vscode.commands.executeCommand('markdown.showPreview');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open built-in preview: ${error}`);
    }
  }
}
