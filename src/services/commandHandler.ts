import * as vscode from 'vscode';
import { IndexService } from './indexService';
import { QuickPickService } from '../ui/quickPick';
import { TelemetryService } from './telemetry';
import { GitHubFetchService } from './fetch';
import { ItemType } from '../types';
import { spawn } from 'child_process';

export class CommandHandler {
  constructor(
    private indexService: IndexService,
    private quickPickService: QuickPickService,
    private telemetryService: TelemetryService
  ) {}

  async browseAll(): Promise<void> {
    try {
      this.telemetryService.trackCommandExecuted('browseAll');
      const items = await this.indexService.buildIndex();
      this.telemetryService.trackIndexBuilt(items.length);
      await this.quickPickService.showBrowseAll(items);
    } catch (error) {
      this.handleError('browse_all_failed', 'Failed to browse items', error);
    }
  }

  async browseByType(type: ItemType): Promise<void> {
    try {
      this.telemetryService.trackCommandExecuted(`browse${this.capitalize(type)}s`);
      const items = await this.indexService.buildIndex();
      this.telemetryService.trackIndexBuilt(items.length);
      await this.quickPickService.showBrowseByType(items, type);
    } catch (error) {
      this.handleError(
        `browse_${type}s_failed`,
        `Failed to browse ${type}s`,
        error
      );
    }
  }

  async searchByKeywords(): Promise<void> {
    try {
      this.telemetryService.trackCommandExecuted('searchByKeywords');
      const items = await this.indexService.buildIndex();
      this.telemetryService.trackIndexBuilt(items.length);
      await this.quickPickService.showKeywordSearch(items);
    } catch (error) {
      this.handleError('search_keywords_failed', 'Failed to search items', error);
    }
  }

  async refreshIndex(): Promise<void> {
    try {
      this.telemetryService.trackCommandExecuted('refreshIndex');
      const items = await this.indexService.buildIndex(true);
      this.telemetryService.trackIndexBuilt(items.length);
      vscode.window.showInformationMessage(`Index refreshed! Found ${items.length} items.`);
    } catch (error) {
      this.handleError('refresh_index_failed', 'Failed to refresh index', error);
    }
  }

  async clearCache(): Promise<void> {
    try {
      this.telemetryService.trackCommandExecuted('clearCache');
      this.indexService.clearCache();
      vscode.window.showInformationMessage('Cache cleared successfully.');
    } catch (error) {
      this.handleError('clear_cache_failed', 'Failed to clear cache', error);
    }
  }

  async showRateLimit(): Promise<void> {
    try {
      this.telemetryService.trackCommandExecuted('showRateLimit');
      const fetchService = new GitHubFetchService();
      const rateLimitInfo = await fetchService.getRateLimitInfo();
      
      if (rateLimitInfo) {
        const { remaining, limit, resetTime, resetInSeconds } = rateLimitInfo;
        const resetInMinutes = Math.ceil(resetInSeconds / 60);
        
        const message = `GitHub API Rate Limit: ${remaining}/${limit} requests remaining\nReset in: ${resetInMinutes} minutes (${resetTime.toLocaleString()})`;
        
        if (remaining <= 5) {
          vscode.window.showWarningMessage(message, 'Show Output');
        } else {
          vscode.window.showInformationMessage(message);
        }
      } else {
        vscode.window.showWarningMessage('Unable to fetch rate limit information.');
      }
    } catch (error) {
      this.handleError('show_rate_limit_failed', 'Failed to show rate limit', error);
    }
  }

  async quickSearch(): Promise<void> {
    try {
      this.telemetryService.trackCommandExecuted('quickSearch');
      const items = await this.indexService.buildIndex();
      this.telemetryService.trackIndexBuilt(items.length);
      await this.quickPickService.showQuickSearch(items);
    } catch (error) {
      this.handleError('quick_search_failed', 'Failed to perform quick search', error);
    }
  }

  async installOrStartMcpServer(): Promise<void> {
    try {
      this.telemetryService.trackCommandExecuted('installOrStartMcpServer');
      const handshake = await this.runHandshake();
      
      if (handshake) {
        vscode.window.showInformationMessage(
          `MCP Server is running!\nVersion: ${handshake.serverVersion}\nProtocols: ${handshake.protocolVersions.join(', ')}\nCapabilities: ${handshake.capabilities.join(', ')}`
        );
      } else {
        vscode.window.showWarningMessage(
          'MCP Server handshake failed. Please check your server configuration.'
        );
      }
    } catch (error) {
      this.handleError('mcp_server_failed', 'Failed to start MCP server', error);
    }
  }

  async checkMcpCompatibility(): Promise<void> {
    try {
      this.telemetryService.trackCommandExecuted('checkMcpCompatibility');
      const handshake = await this.runHandshake();
      
      if (handshake) {
        const cfg = vscode.workspace.getConfiguration('awesomeCopilotToolkit');
        const minVersion = cfg.get<string>('mcp.minimumProtocolVersion', '1.0');
        const isCompatible = handshake.protocolVersions.some(v => v >= minVersion);
        
        const message = isCompatible 
          ? `✅ MCP Server is compatible!\nServer supports protocols: ${handshake.protocolVersions.join(', ')}\nMinimum required: ${minVersion}`
          : `❌ MCP Server compatibility issue!\nServer protocols: ${handshake.protocolVersions.join(', ')}\nMinimum required: ${minVersion}`;
        
        vscode.window.showInformationMessage(message);
      } else {
        vscode.window.showWarningMessage('Could not check MCP compatibility - handshake failed.');
      }
    } catch (error) {
      this.handleError('mcp_compatibility_failed', 'Failed to check MCP compatibility', error);
    }
  }

  private async runHandshake(): Promise<{ serverVersion: string; protocolVersions: string[]; capabilities: string[] } | null> {
    const cfg = vscode.workspace.getConfiguration('awesomeCopilotToolkit');
    const serverCmd = cfg.get<string>('mcp.serverCommand', 'npx mcp-awesome-copilot-server serve');
    const exe = serverCmd.split(' ')[0] || 'npx';
    const args = serverCmd.split(' ').slice(1);
    
    return new Promise((resolve) => {
      const proc = spawn(exe, args, { env: { ...process.env, HANDSHAKE: '1' } });
      let out = '';
      let err = '';
      const timeout = setTimeout(() => {
        try { proc.kill(); } catch {}
        resolve(null);
      }, 15000);
      
      proc.stdout.on('data', (d) => { out += d.toString(); });
      proc.stderr.on('data', (d) => { err += d.toString(); });
      proc.on('close', () => {
        clearTimeout(timeout);
        try {
          const json = JSON.parse(out.trim());
          resolve(json);
        } catch {
          resolve(null);
        }
      });
    });
  }

  private handleError(errorType: string, message: string, error: unknown): void {
    this.telemetryService.trackError(errorType, String(error));
    vscode.window.showErrorMessage(`${message}: ${error}`);
    this.indexService.getOutputChannel();
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
