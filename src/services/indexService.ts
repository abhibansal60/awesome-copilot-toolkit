import * as vscode from 'vscode';
import { CatalogItem, ItemType, GitHubContentItem } from '../types';
import { GitHubFetchService } from './fetch';

interface CachedCatalog {
  items: CatalogItem[];
  updatedAt: string;
  etags: Record<string, string>;
}

export class IndexService {
  private readonly context: vscode.ExtensionContext;
  private readonly fetchService: GitHubFetchService;
  private readonly cacheKey = 'catalog:data';
  private readonly etagsKey = 'catalog:etags';
  private readonly updatedAtKey = 'catalog:updatedAt';
  private indexChangeCallbacks: (() => void)[] = [];

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.fetchService = new GitHubFetchService();
  }

  async buildIndex(forceRefresh = false): Promise<CatalogItem[]> {
    const config = vscode.workspace.getConfiguration('awesomeCopilotToolkit');
    const cacheTtlHours = config.get<number>('cacheTtlHours', 24);
    
    // Check cache first
    if (!forceRefresh) {
      const cached = this.getCachedCatalog();
      if (cached && this.isCacheValid(cached.updatedAt, cacheTtlHours)) {
        return cached.items;
      }
    }

    try {
      const progressOptions = {
        location: vscode.ProgressLocation.Notification,
        title: 'Building Awesome Copilot index...',
        cancellable: false,
      };

      return await vscode.window.withProgress(progressOptions, async () => {
        const items = await this.fetchAllItems();
        this.cacheCatalog(items);
        return items;
      });
    } catch (error) {
      // Fallback to cached data if available
      const cached = this.getCachedCatalog();
      if (cached) {
        vscode.window.showWarningMessage(
          'Failed to refresh index. Using cached data.',
          'Show Output'
        ).then(selection => {
          if (selection === 'Show Output') {
            this.fetchService.showOutput();
          }
        });
        return cached.items;
      }
      throw error;
    }
  }

  private async fetchAllItems(): Promise<CatalogItem[]> {
    const directories: Array<{ path: string; type: ItemType }> = [
      { path: 'instructions', type: 'instruction' },
      { path: 'prompts', type: 'prompt' },
      { path: 'chatmodes', type: 'chatmode' },
    ];

    const allItems: CatalogItem[] = [];
    const etags: Record<string, string> = {};

    for (const { path, type } of directories) {
      try {
        const cachedEtag = this.getCachedEtag(path);
        const { items, etag } = await this.fetchService.fetchDirectoryContents(path, cachedEtag);
        
        if (etag) {
          etags[path] = etag;
        }

        // Filter for files with correct extensions
        const filteredItems = items.filter(item => 
          item.type === 'file' && this.hasCorrectExtension(item.name, type)
        );

        // Convert to CatalogItem format
        const catalogItems = await Promise.all(
          filteredItems.map(async (item) => {
            const lastModified = await this.fetchService.fetchLastCommit(item.path);
            const description = await this.extractDescription(item.download_url, type);
            
            return {
              id: this.generateId(item.name, type),
              type,
              title: this.extractTitle(item.name, type),
              path: item.path,
              rawUrl: item.download_url,
              lastModified: lastModified || '',
              description,
              sha: item.sha,
            };
          })
        );

        allItems.push(...catalogItems);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to fetch ${type}s: ${error}`);
      }
    }

    return allItems;
  }

  private hasCorrectExtension(filename: string, type: ItemType): boolean {
    switch (type) {
      case 'instruction':
        return filename.endsWith('.instructions.md');
      case 'prompt':
        return filename.endsWith('.prompt.md');
      case 'chatmode':
        return filename.endsWith('.chatmode.md');
      default:
        return false;
    }
  }

  private extractTitle(filename: string, type: ItemType): string {
    // Remove extension and convert to title case
    let title = filename;
    
    switch (type) {
      case 'instruction':
        title = filename.replace('.instructions.md', '');
        break;
      case 'prompt':
        title = filename.replace('.prompt.md', '');
        break;
      case 'chatmode':
        title = filename.replace('.chatmode.md', '');
        break;
    }

    // Convert kebab-case or snake_case to Title Case
    return title
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  private generateId(filename: string, type: ItemType): string {
    const base = filename.replace(/\.(instructions|prompt|chatmode)\.md$/, '');
    return `${type}-${base.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  }

  private async extractDescription(url: string, type: ItemType): Promise<string> {
    try {
      const content = await this.fetchService.fetchFileContent(url);
      
      if (type === 'chatmode') {
        // For JSON files, try to extract name/description fields
        try {
          const json = JSON.parse(content);
          return json.description || json.name || 'Custom chat mode';
        } catch {
          return 'Custom chat mode';
        }
      } else {
        // For Markdown files, extract first heading or paragraph
        const lines = content.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('#') || (trimmed.length > 0 && !trimmed.startsWith('---'))) {
            return trimmed.replace(/^#+\s*/, '').substring(0, 100);
          }
        }
        return 'Custom instruction';
      }
    } catch (error) {
      return type === 'chatmode' ? 'Custom chat mode' : 'Custom instruction';
    }
  }

  private getCachedCatalog(): CachedCatalog | undefined {
    const items = this.context.globalState.get<CatalogItem[]>(this.cacheKey);
    const updatedAt = this.context.globalState.get<string>(this.updatedAtKey);
    const etags = this.context.globalState.get<Record<string, string>>(this.etagsKey, {});

    if (items && updatedAt) {
      return { items, updatedAt, etags };
    }
    return undefined;
  }

  private getCachedEtag(path: string): string | undefined {
    const etags = this.context.globalState.get<Record<string, string>>(this.etagsKey, {});
    return etags[path];
  }

  private cacheCatalog(items: CatalogItem[]): void {
    // Persist items and updatedAt separately to match getCachedCatalog
    this.context.globalState.update(this.cacheKey, items);
    this.context.globalState.update(this.updatedAtKey, new Date().toISOString());
    this.notifyIndexChanged();
  }

  private getCachedEtags(): Record<string, string> {
    return this.context.globalState.get<Record<string, string>>(this.etagsKey, {});
  }

  private isCacheValid(updatedAt: string, ttlHours: number): boolean {
    const cacheTime = new Date(updatedAt);
    const now = new Date();
    const diffHours = (now.getTime() - cacheTime.getTime()) / (1000 * 60 * 60);
    return diffHours < ttlHours;
  }

  clearCache(): void {
    this.context.globalState.update(this.cacheKey, undefined);
    this.context.globalState.update(this.updatedAtKey, undefined);
    this.context.globalState.update(this.etagsKey, undefined);
  }

  getOutputChannel(): vscode.OutputChannel {
    this.fetchService.showOutput();
    return this.fetchService.getOutputChannel();
  }

  onIndexChanged(callback: () => void): void {
    // Simple event emitter for index changes
    this.indexChangeCallbacks.push(callback);
  }

  private notifyIndexChanged(): void {
    this.indexChangeCallbacks.forEach(callback => callback());
  }
}
