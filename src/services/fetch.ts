import * as vscode from 'vscode';
import { GitHubContentItem, GitHubCommit } from '../types';

interface GitHubRateLimit {
  resources: {
    core: {
      limit: number;
      remaining: number;
      reset: number;
    };
  };
}

export class GitHubFetchService {
  private static readonly BASE_URL = 'https://api.github.com';
  private static readonly REPO = 'github/awesome-copilot';
  private static readonly BRANCH = 'main';
  private static readonly USER_AGENT = 'awesome-copilot-toolkit-vscode';

  private outputChannel: vscode.OutputChannel;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Awesome Copilot Toolkit');
  }

  async fetchDirectoryContents(path: string, etag?: string): Promise<{
    items: GitHubContentItem[];
    etag: string | undefined;
  }> {
    const url = `${GitHubFetchService.BASE_URL}/repos/${GitHubFetchService.REPO}/contents/${path}?ref=${GitHubFetchService.BRANCH}`;
    
    try {
      // Check rate limit before making request
      await this.checkRateLimit();
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': GitHubFetchService.USER_AGENT,
          'Accept': 'application/vnd.github.v3+json',
          ...(etag && { 'If-None-Match': etag }),
        },
      });

      if (response.status === 304) {
        this.log('Cache hit for directory:', path);
        return { items: [], etag };
      }

      if (response.status === 403) {
        const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
        const rateLimitReset = response.headers.get('X-RateLimit-Reset');
        
        if (rateLimitRemaining === '0') {
          const resetDate = rateLimitReset ? new Date(parseInt(rateLimitReset) * 1000) : new Date();
          const waitTime = Math.max(0, resetDate.getTime() - Date.now());
          
          this.log(`Rate limit exceeded. Waiting ${Math.ceil(waitTime / 1000)} seconds until reset at ${resetDate.toLocaleString()}`);
          
          // Wait for rate limit to reset
          if (waitTime > 0) {
            await this.delay(waitTime + 1000); // Add 1 second buffer
            return this.fetchDirectoryContents(path, etag); // Retry
          }
        }
        throw new Error('Access forbidden. Check rate limits.');
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const newEtag = response.headers.get('ETag') || undefined;
      const items = await response.json() as GitHubContentItem[];

      this.log(`Fetched ${items.length} items from ${path}`);
      
      // Add small delay between requests to avoid rate limiting
      await this.delay(200);
      
      return { items, etag: newEtag };
    } catch (error) {
      this.log('Error fetching directory contents:', error);
      throw error;
    }
  }

  async fetchFileContent(url: string): Promise<string> {
    try {
      // Check rate limit before making request
      await this.checkRateLimit();
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': GitHubFetchService.USER_AGENT,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const content = await response.text();
      this.log(`Fetched file content from ${url} (${content.length} chars)`);
      
      // Add small delay between requests to avoid rate limiting
      await this.delay(100);
      
      return content;
    } catch (error) {
      this.log('Error fetching file content:', error);
      throw error;
    }
  }

  async fetchLastCommit(path: string): Promise<string | undefined> {
    try {
      // Check rate limit before making request
      await this.checkRateLimit();
      
      const url = `${GitHubFetchService.BASE_URL}/repos/${GitHubFetchService.REPO}/commits?path=${encodeURIComponent(path)}&per_page=1`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': GitHubFetchService.USER_AGENT,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        this.log('Warning: Could not fetch commit info for', path);
        return undefined;
      }

      const commits = await response.json() as GitHubCommit[];
      if (commits.length > 0 && commits[0]) {
        return commits[0].commit.author.date;
      }

      return undefined;
    } catch (error) {
      this.log('Warning: Error fetching commit info:', error);
      return undefined;
    }
  }

  private log(message: string, ...args: unknown[]): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message} ${args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ')}`;
    this.outputChannel.appendLine(logMessage);
    console.log(logMessage); // Also log to console for debugging
  }

  showOutput(): void {
    this.outputChannel.show();
  }

  getOutputChannel(): vscode.OutputChannel {
    return this.outputChannel;
  }

  /**
   * Check current rate limit status and wait if necessary
   */
  private async checkRateLimit(): Promise<void> {
    try {
      const response = await fetch(`${GitHubFetchService.BASE_URL}/rate_limit`, {
        headers: {
          'User-Agent': GitHubFetchService.USER_AGENT,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (response.ok) {
        const rateLimit = await response.json() as GitHubRateLimit;
        const remaining = rateLimit.resources.core.remaining;
        const resetTime = rateLimit.resources.core.reset;
        
        if (remaining <= 5) { // Warning threshold
          const resetDate = new Date(resetTime * 1000);
          const waitTime = Math.max(0, resetDate.getTime() - Date.now());
          
          if (waitTime > 0 && remaining === 0) {
            this.log(`Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)} seconds until reset at ${resetDate.toLocaleString()}`);
            await this.delay(waitTime + 1000); // Add 1 second buffer
          } else if (remaining <= 2) {
            this.log(`Rate limit warning: Only ${remaining} requests remaining. Reset at ${resetDate.toLocaleString()}`);
            // Add small delay to spread out requests
            await this.delay(1000);
          }
        }
      }
    } catch (error) {
      this.log('Warning: Could not check rate limit:', error);
      // Continue anyway, but add a small delay
      await this.delay(500);
    }
  }

  /**
   * Add delay between requests to avoid rate limiting
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current rate limit information
   */
  async getRateLimitInfo(): Promise<{
    remaining: number;
    limit: number;
    resetTime: Date;
    resetInSeconds: number;
  } | null> {
    try {
      const response = await fetch(`${GitHubFetchService.BASE_URL}/rate_limit`, {
        headers: {
          'User-Agent': GitHubFetchService.USER_AGENT,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (response.ok) {
        const rateLimit = await response.json() as GitHubRateLimit;
        const core = rateLimit.resources.core;
        const resetTime = new Date(core.reset * 1000);
        const resetInSeconds = Math.max(0, Math.ceil((resetTime.getTime() - Date.now()) / 1000));
        
        return {
          remaining: core.remaining,
          limit: core.limit,
          resetTime,
          resetInSeconds,
        };
      }
      return null;
    } catch (error) {
      this.log('Error getting rate limit info:', error);
      return null;
    }
  }
}
