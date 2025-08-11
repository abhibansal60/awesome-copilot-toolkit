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
    } else {
      // Clear cache when force refresh to ensure a fresh tree fetch
      this.clearCache();
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
    const config = vscode.workspace.getConfiguration('awesomeCopilotToolkit');
    const maxItems = Math.max(1, config.get<number>('maxItems', 10));

    // One-shot tree fetch (significantly fewer API calls)
    const tree = await this.fetchService.fetchFullTree();

    // Map tree entries to our three folders and file patterns
    const candidates: Array<{ path: string; type: ItemType } > = [];
    for (const entry of tree) {
      if (entry.type !== 'blob') continue;
      if (entry.path.startsWith('instructions/') && this.hasCorrectExtension(entry.path.split('/').pop() || '', 'instruction')) {
        candidates.push({ path: entry.path, type: 'instruction' });
      } else if (entry.path.startsWith('prompts/') && this.hasCorrectExtension(entry.path.split('/').pop() || '', 'prompt')) {
        candidates.push({ path: entry.path, type: 'prompt' });
      } else if (entry.path.startsWith('chatmodes/') && this.hasCorrectExtension(entry.path.split('/').pop() || '', 'chatmode')) {
        candidates.push({ path: entry.path, type: 'chatmode' });
      }
    }

    // Take up to maxItems to reduce per-file metadata requests
    const limited = candidates.slice(0, Math.max(1, maxItems));

    const allItems: CatalogItem[] = await Promise.all(limited.map(async ({ path, type }) => {
      const filename = path.split('/').pop() || path;
      const rawUrl = `https://raw.githubusercontent.com/${vscode.workspace.getConfiguration('awesomeCopilotToolkit').get('contentRepo', 'github/awesome-copilot')}/${vscode.workspace.getConfiguration('awesomeCopilotToolkit').get('contentBranch', 'main')}/${path}`;
      // On-demand hydration: do not fetch content or commits here to save API calls
      const lastModified = '';
      const description = '';

      return {
        id: this.generateId(filename, type),
        type,
        title: this.extractTitle(filename, type),
        path,
        rawUrl,
        lastModified,
        description,
        sha: '',
      };
    }));

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

  /**
   * Expand the index by fetching repo tree and adding files that match the query keywords.
   * This does not fetch file contents; it only adds lightweight entries.
   */
  async expandIndexByKeywords(query: string): Promise<CatalogItem[]> {
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter(k => k.length > 0);

    // Current items (from cache if available)
    const existing = this.getCachedCatalog()?.items ?? [];

    // One-shot tree fetch
    const tree = await this.fetchService.fetchFullTree();

    const candidates: Array<{ path: string; type: ItemType }> = [];
    for (const entry of tree) {
      if (entry.type !== 'blob') continue;
      const lowerPath = entry.path.toLowerCase();
      const filename = entry.path.split('/').pop() || entry.path;

      // Only three content roots
      let type: ItemType | undefined;
      if (lowerPath.startsWith('instructions/') && this.hasCorrectExtension(filename, 'instruction')) {
        type = 'instruction';
      } else if (lowerPath.startsWith('prompts/') && this.hasCorrectExtension(filename, 'prompt')) {
        type = 'prompt';
      } else if (lowerPath.startsWith('chatmodes/') && this.hasCorrectExtension(filename, 'chatmode')) {
        type = 'chatmode';
      }
      if (!type) continue;

      // Match all keywords against path segments + filename
      const haystack = [type, ...entry.path.toLowerCase().split(/[/\\]/)].join(' ');
      const matches = keywords.every(k => haystack.includes(k));
      if (matches) {
        candidates.push({ path: entry.path, type });
      }
    }

    const config = vscode.workspace.getConfiguration('awesomeCopilotToolkit');
    const maxItems = Math.max(1, config.get<number>('maxItems', 5));
    const limited = candidates.slice(0, Math.max(1, maxItems));

    const repo = config.get<string>('contentRepo', 'github/awesome-copilot');
    const branch = config.get<string>('contentBranch', 'main');

    const newItems: CatalogItem[] = limited.map(({ path, type }) => {
      const filename = path.split('/').pop() || path;
      const rawUrl = `https://raw.githubusercontent.com/${repo}/${branch}/${path}`;
      return {
        id: this.generateId(filename, type),
        type,
        title: this.extractTitle(filename, type),
        path,
        rawUrl,
        lastModified: '',
        description: '',
        sha: '',
      };
    });

    // Merge de-duplicating by path
    const byPath = new Map<string, CatalogItem>();
    for (const item of [...existing, ...newItems]) {
      byPath.set(item.path, item);
    }
    const merged = Array.from(byPath.values());

    this.cacheCatalog(merged);
    return merged;
  }
}
