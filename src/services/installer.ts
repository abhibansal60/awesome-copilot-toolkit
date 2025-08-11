import * as vscode from 'vscode';
import { CatalogItem, InstallOptions } from '../types';
import { GitHubFetchService } from './fetch';

export class InstallerService {
  private readonly fetchService: GitHubFetchService;

  constructor() {
    this.fetchService = new GitHubFetchService();
  }

  async installItem(item: CatalogItem, options: InstallOptions): Promise<void> {
    try {
      const content = await this.fetchService.fetchFileContent(item.rawUrl);
      
      if (options.location === 'workspace' || options.location === 'both') {
        await this.installToWorkspace(item, content);
      }
      
      if (options.location === 'untitled' || options.location === 'both') {
        await this.installAsUntitled(item, content);
      }

      // Try deep link for instructions if enabled
      if (item.type === 'instruction' && options.useDeepLinks) {
        await this.tryDeepLink(item.rawUrl);
      }

      vscode.window.showInformationMessage(
        `Successfully installed ${item.title}`,
        'Open File',
        'Reveal in Explorer',
        'Copy Path'
      ).then(selection => {
        switch (selection) {
          case 'Open File':
            this.openInstalledFile(item);
            break;
          case 'Reveal in Explorer':
            this.revealInExplorer(item);
            break;
          case 'Copy Path':
            this.copyFilePath(item);
            break;
        }
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to install ${item.title}: ${error}`);
      throw error;
    }
  }

  private async installToWorkspace(item: CatalogItem, content: string): Promise<void> {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      throw new Error('No workspace folder open');
    }

    const workspaceFolder = vscode.workspace.workspaceFolders[0];
    const dirUri = this.getInstallDir(item, workspaceFolder.uri);
    const fileUri = vscode.Uri.joinPath(dirUri, this.getFilename(item));
    
    // Ensure directory exists (creates .github/<subfolder> when missing)
    await vscode.workspace.fs.createDirectory(dirUri);

    // Write file
    const data = new TextEncoder().encode(content);
    await vscode.workspace.fs.writeFile(fileUri, data);
  }

  private async installAsUntitled(item: CatalogItem, content: string): Promise<void> {
    const filename = this.getFilename(item);
    const document = await vscode.workspace.openTextDocument({
      content,
      language: this.getLanguageId(item.type),
    });
    
    await vscode.window.showTextDocument(document);
    
    // Set the document as dirty to prompt for save
    const edit = new vscode.WorkspaceEdit();
    edit.insert(document.uri, new vscode.Position(0, 0), content);
    await vscode.workspace.applyEdit(edit);
  }

  private async tryDeepLink(url: string): Promise<void> {
    try {
      const deepLink = `vscode:chat-instructions/install?url=${encodeURIComponent(url)}`;
      await vscode.env.openExternal(vscode.Uri.parse(deepLink));
    } catch (error) {
      // Deep link failed, fallback to file installation
      console.log('Deep link failed, using file installation fallback');
    }
  }

  private getInstallDir(item: CatalogItem, workspaceUri: vscode.Uri): vscode.Uri {
    const subfolder = this.getSubfolder(item.type);
    return vscode.Uri.joinPath(workspaceUri, '.github', subfolder);
  }

  private getFilename(item: CatalogItem): string {
    const baseName = item.path.split('/').pop() || item.id;
    return baseName;
  }

  private getSubfolder(type: string): string {
    switch (type) {
      case 'instruction':
        return 'copilot-instructions';
      case 'prompt':
        return 'copilot-prompts';
      case 'chatmode':
        return 'copilot-chatmodes';
      default:
        return 'copilot-misc';
    }
  }

  private getLanguageId(type: string): string {
    switch (type) {
      case 'instruction':
      case 'prompt':
        return 'markdown';
      case 'chatmode':
        return 'markdown';
      default:
        return 'plaintext';
    }
  }

  private async openInstalledFile(item: CatalogItem): Promise<void> {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      return;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders[0];
    const filePath = vscode.Uri.joinPath(this.getInstallDir(item, workspaceFolder.uri), this.getFilename(item));
    
    try {
      const document = await vscode.workspace.openTextDocument(filePath);
      await vscode.window.showTextDocument(document);
    } catch (error) {
      vscode.window.showErrorMessage(`Could not open file: ${error}`);
    }
  }

  private async revealInExplorer(item: CatalogItem): Promise<void> {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      return;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders[0];
    const filePath = vscode.Uri.joinPath(this.getInstallDir(item, workspaceFolder.uri), this.getFilename(item));
    
    try {
      await vscode.commands.executeCommand('revealInExplorer', filePath);
    } catch (error) {
      vscode.window.showErrorMessage(`Could not reveal in explorer: ${error}`);
    }
  }

  private async copyFilePath(item: CatalogItem): Promise<void> {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      return;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders[0];
    const filePath = vscode.Uri.joinPath(this.getInstallDir(item, workspaceFolder.uri), this.getFilename(item));
    const relativePath = vscode.workspace.asRelativePath(filePath);
    
    await vscode.env.clipboard.writeText(relativePath);
    vscode.window.showInformationMessage('File path copied to clipboard');
  }
}
