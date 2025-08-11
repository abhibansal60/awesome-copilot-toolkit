import * as vscode from 'vscode';
import { GitHubFetchService } from './fetch';

export class StatusBarService {
  private statusBarItem: vscode.StatusBarItem;
  private rateLimitItem: vscode.StatusBarItem;
  private readonly fetchService: GitHubFetchService;

  constructor() {
    this.fetchService = new GitHubFetchService();
    this.createStatusBarItems();
    this.startRateLimitMonitoring();
  }

  private createStatusBarItems(): void {
    // Main status bar item with dropdown menu
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.statusBarItem.name = 'Awesome Copilot Toolkit';
    this.statusBarItem.text = '$(copilot) Awesome Copilot';
    this.statusBarItem.tooltip = 'Click to access Awesome Copilot Toolkit features';
    this.statusBarItem.command = 'awesomeCopilotToolkit.statusBarMenu';
    this.statusBarItem.show();

    // Rate limit indicator
    this.rateLimitItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      99
    );
    this.rateLimitItem.name = 'GitHub API Rate Limit';
    this.rateLimitItem.text = '$(sync~spin) Checking API...';
    this.rateLimitItem.tooltip = 'GitHub API Rate Limit Status';
    this.rateLimitItem.command = 'awesomeCopilotToolkit.showRateLimit';
    this.rateLimitItem.show();
  }

  private async startRateLimitMonitoring(): Promise<void> {
    // Update rate limit status every 5 minutes
    this.updateRateLimitStatus();
    setInterval(() => this.updateRateLimitStatus(), 5 * 60 * 1000);
  }

  private async updateRateLimitStatus(): Promise<void> {
    try {
      const rateLimitInfo = await this.fetchService.getRateLimitInfo();
      if (rateLimitInfo) {
        const { remaining, limit } = rateLimitInfo;
        const percentage = Math.round((remaining / limit) * 100);
        
        if (remaining <= 5) {
          this.rateLimitItem.text = '$(warning) API Limit Low';
          this.rateLimitItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
          this.rateLimitItem.tooltip = `GitHub API: ${remaining}/${limit} requests remaining (${percentage}%) - Click to check details`;
        } else if (remaining <= 20) {
          this.rateLimitItem.text = '$(sync~spin) API OK';
          this.rateLimitItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
          this.rateLimitItem.tooltip = `GitHub API: ${remaining}/${limit} requests remaining (${percentage}%) - Click to check details`;
        } else {
          this.rateLimitItem.text = '$(check) API Ready';
          this.rateLimitItem.backgroundColor = undefined;
          this.rateLimitItem.tooltip = `GitHub API: ${remaining}/${limit} requests remaining (${percentage}%) - Click to check details`;
        }
      } else {
        this.rateLimitItem.text = '$(error) API Error';
        this.rateLimitItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        this.rateLimitItem.tooltip = 'Could not check GitHub API status - Click to retry';
      }
    } catch (error) {
      this.rateLimitItem.text = '$(error) API Error';
      this.rateLimitItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
      this.rateLimitItem.tooltip = 'Error checking GitHub API status - Click to retry';
    }
  }

  public updateStatusBarText(text: string, tooltip?: string): void {
    this.statusBarItem.text = text;
    if (tooltip) {
      this.statusBarItem.tooltip = tooltip;
    }
  }

  public showRateLimitWarning(): void {
    this.rateLimitItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    this.rateLimitItem.text = '$(warning) Rate Limit!';
  }

  public dispose(): void {
    this.statusBarItem.dispose();
    this.rateLimitItem.dispose();
  }
}
