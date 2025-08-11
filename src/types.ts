export type ItemType = 'instruction' | 'prompt' | 'chatmode';

export interface CatalogItem {
  id: string;
  type: ItemType;
  title: string;
  path: string;
  rawUrl: string;
  lastModified?: string;
  description: string;
  sha: string;
}

export interface GitHubContentItem {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string;
  type: string;
}

export interface GitHubCommit {
  sha: string;
  commit: {
    author: {
      date: string;
    };
    message: string;
  };
}

export interface InstallOptions {
  location: 'workspace' | 'untitled' | 'both';
  useDeepLinks: boolean;
}

export interface PreviewOptions {
  item: CatalogItem;
  content: string;
}
