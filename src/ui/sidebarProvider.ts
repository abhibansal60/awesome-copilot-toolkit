import * as vscode from 'vscode';
import { CatalogItem, ItemType } from '../types';
import { IndexService } from '../services/indexService';
import { PreviewService } from '../services/preview';
import { InstallerService } from '../services/installer';

export class SidebarProvider implements vscode.TreeDataProvider<CopilotTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<CopilotTreeItem | undefined | null | void> = new vscode.EventEmitter<CopilotTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<CopilotTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private items: CatalogItem[] = [];
  private readonly indexService: IndexService;
  private readonly previewService: PreviewService;
  private readonly installerService: InstallerService;

  constructor(context: vscode.ExtensionContext, indexService: IndexService) {
    this.indexService = indexService;
    this.previewService = new PreviewService();
    this.installerService = new InstallerService();
    
    // Refresh tree when index changes
    this.indexService.onIndexChanged(() => {
      this.refresh();
    });
  }

  async refresh(): Promise<void> {
    try {
      this.items = await this.indexService.buildIndex();
      this._onDidChangeTreeData.fire();
    } catch (error) {
      console.error('Failed to refresh sidebar:', error);
    }
  }

  getTreeItem(element: CopilotTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: CopilotTreeItem): Promise<CopilotTreeItem[]> {
    if (!element) {
      // Root level - show categories
      return [
        new CategoryTreeItem('Custom Instructions', 'instruction', this.getItemsByType('instruction')),
        new CategoryTreeItem('Reusable Prompts', 'prompt', this.getItemsByType('prompt')),
        new CategoryTreeItem('Custom Chat Modes', 'chatmode', this.getItemsByType('chatmode')),
        new ActionTreeItem('Refresh Index', 'refresh', '$(refresh)'),
        new ActionTreeItem('Search by Keywords', 'search', '$(search)'),
        new ActionTreeItem('Show Rate Limit', 'rateLimit', '$(info)')
      ];
    }

    if (element instanceof CategoryTreeItem) {
      // Show items in category
      return element.items.map(item => new ItemTreeItem(item));
    }

    return [];
  }

  private getItemsByType(type: ItemType): CatalogItem[] {
    return this.items.filter(item => item.type === type);
  }

  public async handleCommand(command: string, item?: CopilotTreeItem): Promise<void> {
    switch (command) {
      case 'refresh':
        await this.refresh();
        break;
      case 'search':
        vscode.commands.executeCommand('awesomeCopilotToolkit.searchByKeywords');
        break;
      case 'rateLimit':
        vscode.commands.executeCommand('awesomeCopilotToolkit.showRateLimit');
        break;
      case 'preview':
        if (item instanceof ItemTreeItem) {
          await this.previewService.showPreview(item.item);
        }
        break;
      case 'install':
        if (item instanceof ItemTreeItem) {
          await this.installItem(item.item);
        }
        break;
      case 'browse':
        if (item instanceof CategoryTreeItem) {
          vscode.commands.executeCommand(`awesomeCopilotToolkit.browse${this.getBrowseCommand(item.type)}`);
        }
        break;
    }
  }

  private async installItem(item: CatalogItem): Promise<void> {
    try {
      await this.installerService.installItem(item, {
        location: 'workspace',
        useDeepLinks: true,
      });
      vscode.window.showInformationMessage(`Installed ${item.title} to workspace`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to install ${item.title}: ${error}`);
    }
  }

  private getBrowseCommand(type: ItemType): string {
    switch (type) {
      case 'instruction': return 'CustomInstructions';
      case 'prompt': return 'ReusablePrompts';
      case 'chatmode': return 'CustomChatModes';
      default: return 'All';
    }
  }
}

abstract class CopilotTreeItem extends vscode.TreeItem {
  public readonly action: string;

  constructor(label: string, action: string) {
    super(label);
    this.action = action;
    // Wire the VS Code TreeItem.command to a single handler with action + item args
    this.command = {
      command: 'awesomeCopilotToolkit.sidebarAction',
      title: label,
      arguments: [action, this],
    };
  }
}

class CategoryTreeItem extends CopilotTreeItem {
  constructor(
    label: string,
    public readonly type: ItemType,
    public readonly items: CatalogItem[]
  ) {
    super(label, 'browse');
    this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    this.iconPath = new vscode.ThemeIcon('folder');
    this.tooltip = `${items.length} items - Click to browse all`;
    this.contextValue = 'category';
  }
}

class ItemTreeItem extends CopilotTreeItem {
  constructor(public readonly item: CatalogItem) {
    super(item.title, 'preview');
    this.tooltip = `${item.description}\nPath: ${item.path}`;
    this.contextValue = 'item';
    
    // Set icon based on type
    switch (item.type) {
      case 'instruction':
        this.iconPath = new vscode.ThemeIcon('book');
        break;
      case 'prompt':
        this.iconPath = new vscode.ThemeIcon('symbol-text');
        break;
      case 'chatmode':
        this.iconPath = new vscode.ThemeIcon('comment-discussion');
        break;
    }
  }
}

class ActionTreeItem extends CopilotTreeItem {
  constructor(
    label: string,
    command: string,
    icon: string
  ) {
    super(label, command);
    this.iconPath = new vscode.ThemeIcon(icon.replace('$(', '').replace(')', ''));
    this.tooltip = `Click to ${label.toLowerCase()}`;
    this.contextValue = 'action';
  }
}
