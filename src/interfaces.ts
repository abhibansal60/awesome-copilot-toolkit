import * as vscode from 'vscode';
import { CatalogItem, ItemType } from './types';

export interface IIndexService {
  buildIndex(forceRefresh?: boolean): Promise<CatalogItem[]>;
  clearCache(): void;
  getOutputChannel(): vscode.OutputChannel;
}

export interface IQuickPickService {
  showBrowseAll(items: CatalogItem[]): Promise<void>;
  showBrowseByType(items: CatalogItem[], type: ItemType): Promise<void>;
  showKeywordSearch(items: CatalogItem[]): Promise<void>;
  showQuickSearch(items: CatalogItem[]): Promise<void>;
}

export interface ITelemetryService {
  trackCommandExecuted(command: string): void;
  trackIndexBuilt(itemCount: number): void;
  trackError(errorType: string, errorMessage: string): void;
  showOutput(): void;
}

export interface IStatusBarService {
  dispose(): void;
}

export interface ISidebarProvider extends vscode.TreeDataProvider<any> {
  handleCommand(command: string, item?: any): Promise<void>;
}

export interface ICommandHandler {
  browseAll(): Promise<void>;
  browseByType(type: ItemType): Promise<void>;
  searchByKeywords(): Promise<void>;
  refreshIndex(): Promise<void>;
  clearCache(): Promise<void>;
  showRateLimit(): Promise<void>;
  quickSearch(): Promise<void>;
  installOrStartMcpServer(): Promise<void>;
  checkMcpCompatibility(): Promise<void>;
}
