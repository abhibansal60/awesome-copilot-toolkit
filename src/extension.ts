import * as vscode from 'vscode';
import { IndexService } from './services/indexService';
import { QuickPickService } from './ui/quickPick';
import { TelemetryService } from './services/telemetry';
import { StatusBarService } from './services/statusBar';
import { SidebarProvider } from './ui/sidebarProvider';
import { spawn } from 'child_process';

export function activate(context: vscode.ExtensionContext): void {
  console.log('Awesome Copilot Toolkit extension is now active!');

  const indexService = new IndexService(context);
  const quickPickService = new QuickPickService(indexService);
  const telemetryService = new TelemetryService(context);
  const statusBarService = new StatusBarService();
  const sidebarProviderInstance = new SidebarProvider(context, indexService);

  async function runHandshake(): Promise<{ serverVersion: string; protocolVersions: string[]; capabilities: string[] } | null> {
    const cfg = vscode.workspace.getConfiguration('awesomeCopilotToolkit');
    const serverCmd = cfg.get<string>('mcp.serverCommand', 'npx mcp-awesome-copilot-server serve');
    const exe = serverCmd.split(' ')[0] || 'npx';
    const args = serverCmd.split(' ').slice(1);
    // Run the same command but with HANDSHAKE=1 so the server prints JSON and exits
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

  // Register commands
  const commands = [
    vscode.commands.registerCommand('awesomeCopilotToolkit.browseAll', async () => {
      try {
        telemetryService.trackCommandExecuted('browseAll');
        const items = await indexService.buildIndex();
        telemetryService.trackIndexBuilt(items.length);
        await quickPickService.showBrowseAll(items);
      } catch (error) {
        telemetryService.trackError('browse_all_failed', String(error));
        vscode.window.showErrorMessage(`Failed to browse items: ${error}`);
        indexService.getOutputChannel();
      }
    }),

    vscode.commands.registerCommand('awesomeCopilotToolkit.browseCustomInstructions', async () => {
      try {
        telemetryService.trackCommandExecuted('browseCustomInstructions');
        const items = await indexService.buildIndex();
        telemetryService.trackIndexBuilt(items.length);
        await quickPickService.showBrowseByType(items, 'instruction');
      } catch (error) {
        telemetryService.trackError('browse_instructions_failed', String(error));
        vscode.window.showErrorMessage(`Failed to browse custom instructions: ${error}`);
        indexService.getOutputChannel();
      }
    }),

    vscode.commands.registerCommand('awesomeCopilotToolkit.browseReusablePrompts', async () => {
      try {
        telemetryService.trackCommandExecuted('browseReusablePrompts');
        const items = await indexService.buildIndex();
        telemetryService.trackIndexBuilt(items.length);
        await quickPickService.showBrowseByType(items, 'prompt');
      } catch (error) {
        telemetryService.trackError('browse_prompts_failed', String(error));
        vscode.window.showErrorMessage(`Failed to browse reusable prompts: ${error}`);
        indexService.getOutputChannel();
      }
    }),

    vscode.commands.registerCommand('awesomeCopilotToolkit.browseCustomChatModes', async () => {
      try {
        telemetryService.trackCommandExecuted('browseCustomChatModes');
        const items = await indexService.buildIndex();
        telemetryService.trackIndexBuilt(items.length);
        await quickPickService.showBrowseByType(items, 'chatmode');
      } catch (error) {
        telemetryService.trackError('browse_chatmodes_failed', String(error));
        vscode.window.showErrorMessage(`Failed to browse custom chat modes: ${error}`);
        indexService.getOutputChannel();
      }
    }),

    vscode.commands.registerCommand('awesomeCopilotToolkit.searchByKeywords', async () => {
      try {
        telemetryService.trackCommandExecuted('searchByKeywords');
        const items = await indexService.buildIndex();
        telemetryService.trackIndexBuilt(items.length);
        await quickPickService.showKeywordSearch(items);
      } catch (error) {
        telemetryService.trackError('search_keywords_failed', String(error));
        vscode.window.showErrorMessage(`Failed to search items: ${error}`);
        indexService.getOutputChannel();
      }
    }),

    vscode.commands.registerCommand('awesomeCopilotToolkit.refreshIndex', async () => {
      try {
        telemetryService.trackCommandExecuted('refreshIndex');
        const items = await indexService.buildIndex(true); // Force refresh
        telemetryService.trackIndexBuilt(items.length);
        vscode.window.showInformationMessage(`Index refreshed! Found ${items.length} items.`);
      } catch (error) {
        telemetryService.trackError('refresh_index_failed', String(error));
        vscode.window.showErrorMessage(`Failed to refresh index: ${error}`);
        indexService.getOutputChannel();
      }
    }),

    vscode.commands.registerCommand('awesomeCopilotToolkit.clearCache', async () => {
      try {
        telemetryService.trackCommandExecuted('clearCache');
        indexService.clearCache();
        vscode.window.showInformationMessage('Cache cleared successfully.');
      } catch (error) {
        telemetryService.trackError('clear_cache_failed', String(error));
        vscode.window.showErrorMessage(`Failed to clear cache: ${error}`);
      }
    }),

    vscode.commands.registerCommand('awesomeCopilotToolkit.showRateLimit', async () => {
      try {
        telemetryService.trackCommandExecuted('showRateLimit');
        const fetchService = new (await import('./services/fetch')).GitHubFetchService();
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
          vscode.window.showErrorMessage('Could not fetch rate limit information.');
        }
      } catch (error) {
        telemetryService.trackError('show_rate_limit_failed', String(error));
        vscode.window.showErrorMessage(`Failed to get rate limit info: ${error}`);
      }
    }),

    vscode.commands.registerCommand('awesomeCopilotToolkit.statusBarMenu', async () => {
      try {
        telemetryService.trackCommandExecuted('statusBarMenu');
        const actions = [
          'Browse All Items',
          'Search by Keywords',
          'Browse Custom Instructions',
          'Browse Reusable Prompts',
          'Browse Custom Chat Modes',
          'Show Rate Limit',
          'Refresh Index',
          'Clear Cache'
        ];
        
        const selection = await vscode.window.showQuickPick(actions, {
          placeHolder: 'Select an action...',
          title: 'Awesome Copilot Toolkit'
        });
        
        if (selection) {
          switch (selection) {
            case 'Browse All Items':
              vscode.commands.executeCommand('awesomeCopilotToolkit.browseAll');
              break;
            case 'Search by Keywords':
              vscode.commands.executeCommand('awesomeCopilotToolkit.searchByKeywords');
              break;
            case 'Browse Custom Instructions':
              vscode.commands.executeCommand('awesomeCopilotToolkit.browseCustomInstructions');
              break;
            case 'Browse Reusable Prompts':
              vscode.commands.executeCommand('awesomeCopilotToolkit.browseReusablePrompts');
              break;
            case 'Browse Custom Chat Modes':
              vscode.commands.executeCommand('awesomeCopilotToolkit.browseCustomChatModes');
              break;
            case 'Show Rate Limit':
              vscode.commands.executeCommand('awesomeCopilotToolkit.showRateLimit');
              break;
            case 'Refresh Index':
              vscode.commands.executeCommand('awesomeCopilotToolkit.refreshIndex');
              break;
            case 'Clear Cache':
              vscode.commands.executeCommand('awesomeCopilotToolkit.clearCache');
              break;
          }
        }
      } catch (error) {
        telemetryService.trackError('status_bar_menu_failed', String(error));
        vscode.window.showErrorMessage(`Failed to show status bar menu: ${error}`);
      }
    }),

    vscode.commands.registerCommand('awesomeCopilotToolkit.installToWorkspace', async () => {
      try {
        telemetryService.trackCommandExecuted('installToWorkspace');
        // This will be handled by the sidebar provider
        vscode.window.showInformationMessage('Use the sidebar to browse and install items');
      } catch (error) {
        telemetryService.trackError('install_to_workspace_failed', String(error));
        vscode.window.showErrorMessage(`Failed to install item: ${error}`);
      }
    }),

    vscode.commands.registerCommand('awesomeCopilotToolkit.quickSearch', async () => {
      try {
        telemetryService.trackCommandExecuted('quickSearch');
        vscode.commands.executeCommand('awesomeCopilotToolkit.searchByKeywords');
      } catch (error) {
        telemetryService.trackError('quick_search_failed', String(error));
        vscode.window.showErrorMessage(`Failed to perform quick search: ${error}`);
      }
    }),

    vscode.commands.registerCommand('awesomeCopilotToolkit.installOrStartMcpServer', async () => {
      telemetryService.trackCommandExecuted('installOrStartMcpServer');
      const cfg = vscode.workspace.getConfiguration('awesomeCopilotToolkit');
      const serverCmd = cfg.get<string>('mcp.serverCommand', 'npx mcp-awesome-copilot-server serve');
      const terminal = vscode.window.createTerminal({ name: 'MCP Server' });
      terminal.show(true);
      terminal.sendText(serverCmd);
      vscode.window.showInformationMessage('Started MCP server in integrated terminal.');
    }),

    vscode.commands.registerCommand('awesomeCopilotToolkit.checkMcpCompatibility', async () => {
      telemetryService.trackCommandExecuted('checkMcpCompatibility');
      const progress = vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Checking MCP server compatibility...', cancellable: false }, async () => {
        const resp = await runHandshake();
        if (!resp) {
          vscode.window.showErrorMessage('Could not obtain MCP handshake. Ensure the server is installed: npx mcp-awesome-copilot-server');
          return;
        }
        const min = vscode.workspace.getConfiguration('awesomeCopilotToolkit').get<string>('mcp.minimumProtocolVersion', '1.0');
        const ok = resp.protocolVersions.includes(min || '1.0');
        const details = `Server ${resp.serverVersion} | Protocols ${resp.protocolVersions.join(', ')} | Capabilities: ${resp.capabilities.join(', ')}`;
        if (ok) {
          vscode.window.showInformationMessage(`MCP compatible. ${details}`);
        } else {
          vscode.window.showWarningMessage(`MCP protocol mismatch. Requires ${min}. ${details}`);
        }
      });
      await progress;
    }),
  ];

  // Add commands to context subscriptions
  context.subscriptions.push(...commands);

  // Register sidebar provider
  const sidebarProviderRegistration = vscode.window.registerTreeDataProvider('awesome-copilot-explorer', sidebarProviderInstance);
  context.subscriptions.push(sidebarProviderRegistration);

  // Register command handler for sidebar actions
  const sidebarCommandHandler = vscode.commands.registerCommand('awesomeCopilotToolkit.sidebarAction', async (command: string, item?: any) => {
    await sidebarProviderInstance.handleCommand(command, item);
  });
  context.subscriptions.push(sidebarCommandHandler);

  // Show welcome message on first activation
  const isFirstActivation = context.globalState.get('isFirstActivation', true);
  if (isFirstActivation) {
    vscode.window.showInformationMessage(
      'Awesome Copilot Toolkit activated! Use the command palette to browse and install items.',
      'Browse All',
      'Show Commands'
    ).then(selection => {
      if (selection === 'Browse All') {
        vscode.commands.executeCommand('awesomeCopilotToolkit.browseAll');
      } else if (selection === 'Show Commands') {
        vscode.commands.executeCommand('workbench.action.showCommands');
      }
    });
    
    context.globalState.update('isFirstActivation', false);
  }

  // Background refresh when cache is stale
  const config = vscode.workspace.getConfiguration('awesomeCopilotToolkit');
  const cacheTtlHours = config.get<number>('cacheTtlHours', 24);
  
  // Check if we need to refresh the cache
  setTimeout(async () => {
    try {
      const items = await indexService.buildIndex();
      telemetryService.trackIndexBuilt(items.length);
    } catch (error) {
      console.log('Background index refresh failed:', error);
    }
  }, 5000); // Wait 5 seconds after activation
}

export function deactivate(): void {
  console.log('Awesome Copilot Toolkit extension is now deactivated!');
}
