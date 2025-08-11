import * as vscode from 'vscode';
import { CatalogItem, ItemType } from '../types';
import { PreviewService } from '../services/preview';
import { InstallerService } from '../services/installer';
import { IndexService } from '../services/indexService';
import { SearchService } from '../services/searchService';

export class QuickPickService {
  private readonly previewService: PreviewService;
  private readonly installerService: InstallerService;
  private readonly searchService: SearchService;
  private readonly indexService?: IndexService;

  constructor(indexService?: IndexService) {
    this.previewService = new PreviewService();
    this.installerService = new InstallerService();
    this.searchService = new SearchService();
    this.indexService = indexService;
  }

  async showBrowseAll(items: CatalogItem[]): Promise<void> {
    await this.showQuickPick(items, 'Browse All Awesome Copilot Items');
  }

  async showBrowseByType(items: CatalogItem[], type: ItemType): Promise<void> {
    const filteredItems = items.filter(item => item.type === type);
    const typeLabel = this.getTypeLabel(type);
    await this.showQuickPick(filteredItems, `Browse ${typeLabel}`);
  }

  async showKeywordSearch(items: CatalogItem[]): Promise<void> {
    const searchQuery = await vscode.window.showInputBox({
      placeHolder: 'Enter keywords to search (e.g., "azure", "dotnet", "testing")',
      prompt: 'Search for items by keywords. Enter one or more keywords.',
      value: ''
    });

    if (!searchQuery) {
      return;
    }

    const validation = this.searchService.validateSearchQuery(searchQuery);
    if (!validation.isValid) {
      const suggestions = validation.suggestions.slice(0, 5);
      const message = `Please enter at least one keyword. You entered ${validation.keywordCount}.`;
      const showSuggestions = await vscode.window.showInformationMessage(
        message,
        'Show Suggestions'
      );
      
      if (showSuggestions === 'Show Suggestions') {
        const selected = await vscode.window.showQuickPick(suggestions, {
          placeHolder: 'Select a suggested search query'
        });
        if (selected) {
          await this.performKeywordSearch(items, selected);
        }
      }
      return;
    }

    await this.performKeywordSearch(items, searchQuery);
  }

  private async performKeywordSearch(items: CatalogItem[], query: string): Promise<void> {
    let searchResults = this.searchService.searchByKeywords(items, query);
    
    if (searchResults.length === 0) {
      // Fallback: expand index from repo tree if wired and retry
      if (this.indexService) {
        const expanded = await this.indexService.expandIndexByKeywords(query);
        searchResults = this.searchService.searchByKeywords(expanded, query);
      }

      if (searchResults.length === 0) {
        vscode.window.showInformationMessage(
          `No items found matching "${query}". Try different keywords or check spelling.`
        );
        return;
      }
    }

    await this.showQuickPick(searchResults, `Search Results: "${query}" (${searchResults.length} items)`);
  }

  private async showQuickPick(items: CatalogItem[], title: string): Promise<void> {
    if (items.length === 0) {
      vscode.window.showInformationMessage('No items found. Try refreshing the index.');
      return;
    }

    // Sort items by type, then by title
    const sortedItems = [...items].sort((a, b) => {
      if (a.type !== b.type) {
        return a.type.localeCompare(b.type);
      }
      return a.title.localeCompare(b.title);
    });

    const quickPickItems = sortedItems.map(item => ({
      label: item.title,
      description: `${this.getTypeLabel(item.type)}${item.description ? ` • ${item.description}` : ''}`,
      detail: `${item.path}`,
      item,
    }));

    const selection = await vscode.window.showQuickPick(quickPickItems, {
      title,
      placeHolder: 'Search items...',
      matchOnDescription: true,
      matchOnDetail: true,
    });

    if (selection) {
      await this.handleItemSelection(selection.item);
    }
  }

  private async handleItemSelection(item: CatalogItem): Promise<void> {
    const actions = [
      'Preview',
      'Install',
      'Open Raw',
      'View on GitHub',
    ];

    const action = await vscode.window.showQuickPick(actions, {
      title: `Actions for ${item.title}`,
      placeHolder: 'Select an action...',
    });

    if (!action) return;

    switch (action) {
      case 'Preview':
        await this.previewService.showPreview(item);
        break;
      case 'Install':
        await this.installItem(item);
        break;
      case 'Open Raw':
        await vscode.env.openExternal(vscode.Uri.parse(item.rawUrl));
        break;
      case 'View on GitHub':
        const githubUrl = `https://github.com/github/awesome-copilot/blob/main/${item.path}`;
        await vscode.env.openExternal(vscode.Uri.parse(githubUrl));
        break;
    }
  }

  private async installItem(item: CatalogItem): Promise<void> {
    // Hydrate rawUrl if missing (should be present from index build, but guard anyway)
    if (!item.rawUrl) {
      const cfg = vscode.workspace.getConfiguration('awesomeCopilotToolkit');
      const repo = cfg.get<string>('contentRepo', 'github/awesome-copilot');
      const branch = cfg.get<string>('contentBranch', 'main');
      item.rawUrl = `https://raw.githubusercontent.com/${repo}/${branch}/${item.path}`;
    }

    const config = vscode.workspace.getConfiguration('awesomeCopilotToolkit');
    const defaultLocation = config.get<'workspace' | 'untitled' | 'both'>('defaultInstallLocation', 'workspace');
    const useDeepLinks = config.get<boolean>('useDeepLinksWhenAvailable', true);

    let installLocation: 'workspace' | 'untitled' | 'both' = defaultLocation;

    // If default is 'both', ask user for preference
    if (defaultLocation === 'both') {
      const locationChoice = await vscode.window.showQuickPick(
        ['Workspace', 'Untitled Document', 'Both'],
        {
          title: 'Choose installation location',
          placeHolder: 'Where would you like to install this item?',
        }
      );

      if (!locationChoice) return;

      switch (locationChoice) {
        case 'Workspace':
          installLocation = 'workspace';
          break;
        case 'Untitled Document':
          installLocation = 'untitled';
          break;
        case 'Both':
          installLocation = 'both';
          break;
      }
    }

    try {
      await this.installerService.installItem(item, {
        location: installLocation,
        useDeepLinks,
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Installation failed: ${error}`);
    }
  }

  private getTypeLabel(type: ItemType): string {
    switch (type) {
      case 'instruction':
        return 'Custom Instruction';
      case 'prompt':
        return 'Reusable Prompt';
      case 'chatmode':
        return 'Custom Chat Mode';
      default:
        return 'Unknown';
    }
  }
}
