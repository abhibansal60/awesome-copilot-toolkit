import * as vscode from 'vscode';
import { ServiceContainer } from './services/container';

let container: ServiceContainer;

export function activate(context: vscode.ExtensionContext): void {
  console.log('Awesome Copilot Toolkit extension is now active!');

  // Initialize service container
  container = new ServiceContainer(context);

  // Register all commands
  registerCommands(context);
  
  // Register sidebar provider
  registerSidebarProvider(context);

  // Show welcome message on first activation
  handleFirstActivation(context);

  // Background refresh
  performBackgroundRefresh();
}

function registerCommands(context: vscode.ExtensionContext): void {
  const commandHandler = container.commandHandler;

  const commands = [
    // Core browsing commands
    vscode.commands.registerCommand('awesomeCopilotToolkit.browseAll', () => commandHandler.browseAll()),
    vscode.commands.registerCommand('awesomeCopilotToolkit.browseCustomInstructions', () => commandHandler.browseByType('instruction')),
    vscode.commands.registerCommand('awesomeCopilotToolkit.browseReusablePrompts', () => commandHandler.browseByType('prompt')),
    vscode.commands.registerCommand('awesomeCopilotToolkit.browseCustomChatModes', () => commandHandler.browseByType('chatmode')),
    
    // Search and utility commands
    vscode.commands.registerCommand('awesomeCopilotToolkit.searchByKeywords', () => commandHandler.searchByKeywords()),
    vscode.commands.registerCommand('awesomeCopilotToolkit.quickSearch', () => commandHandler.quickSearch()),
    vscode.commands.registerCommand('awesomeCopilotToolkit.refreshIndex', () => commandHandler.refreshIndex()),
    vscode.commands.registerCommand('awesomeCopilotToolkit.clearCache', () => commandHandler.clearCache()),
    vscode.commands.registerCommand('awesomeCopilotToolkit.showRateLimit', () => commandHandler.showRateLimit()),
    
    // MCP commands
    vscode.commands.registerCommand('awesomeCopilotToolkit.installOrStartMcpServer', () => commandHandler.installOrStartMcpServer()),
    vscode.commands.registerCommand('awesomeCopilotToolkit.checkMcpCompatibility', () => commandHandler.checkMcpCompatibility()),
    
    // Status bar menu
    vscode.commands.registerCommand('awesomeCopilotToolkit.statusBarMenu', () => showStatusBarMenu()),
    
    // Workspace installation
    vscode.commands.registerCommand('awesomeCopilotToolkit.installToWorkspace', () => handleInstallToWorkspace()),
    
    // Debug commands
    vscode.commands.registerCommand('awesomeCopilotToolkit.showDiagnostics', () => showDiagnostics()),
    vscode.commands.registerCommand('awesomeCopilotToolkit.showDebugLogs', () => showDebugLogs()),
  ];

  context.subscriptions.push(...commands);
}

function registerSidebarProvider(context: vscode.ExtensionContext): void {
  const sidebarProvider = container.sidebarProvider;
  
  const sidebarProviderRegistration = vscode.window.registerTreeDataProvider(
    'awesome-copilot-explorer', 
    sidebarProvider
  );
  
  const sidebarCommandHandler = vscode.commands.registerCommand(
    'awesomeCopilotToolkit.sidebarAction', 
    async (command: string, item?: any) => {
      await sidebarProvider.handleCommand(command, item);
    }
  );

  context.subscriptions.push(sidebarProviderRegistration, sidebarCommandHandler);
}

async function showStatusBarMenu(): Promise<void> {
  try {
    container.telemetryService.trackCommandExecuted('statusBarMenu');
    
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
      const commandMap: Record<string, string> = {
        'Browse All Items': 'awesomeCopilotToolkit.browseAll',
        'Search by Keywords': 'awesomeCopilotToolkit.searchByKeywords',
        'Browse Custom Instructions': 'awesomeCopilotToolkit.browseCustomInstructions',
        'Browse Reusable Prompts': 'awesomeCopilotToolkit.browseReusablePrompts',
        'Browse Custom Chat Modes': 'awesomeCopilotToolkit.browseCustomChatModes',
        'Show Rate Limit': 'awesomeCopilotToolkit.showRateLimit',
        'Refresh Index': 'awesomeCopilotToolkit.refreshIndex',
        'Clear Cache': 'awesomeCopilotToolkit.clearCache'
      };
      
      const command = commandMap[selection];
      if (command) {
        vscode.commands.executeCommand(command);
      }
    }
  } catch (error) {
    container.telemetryService.trackError('status_bar_menu_failed', String(error));
    vscode.window.showErrorMessage(`Failed to show status bar menu: ${error}`);
  }
}

async function handleInstallToWorkspace(): Promise<void> {
  try {
    container.telemetryService.trackCommandExecuted('installToWorkspace');
    vscode.window.showInformationMessage('Use the sidebar to browse and install items');
  } catch (error) {
    container.telemetryService.trackError('install_to_workspace_failed', String(error));
    vscode.window.showErrorMessage(`Failed to install item: ${error}`);
  }
}

async function showDiagnostics(): Promise<void> {
  try {
    container.telemetryService.trackCommandExecuted('showDiagnostics');
    
    const diagnostics = vscode.languages.getDiagnostics();
    
    if (diagnostics.length === 0) {
      vscode.window.showInformationMessage('No diagnostics found in the current workspace.');
      return;
    }
    
    const panel = vscode.window.createWebviewPanel(
      'extensionDiagnostics',
      'Extension Diagnostics',
      vscode.ViewColumn.One,
      {
        enableScripts: false,
        retainContextWhenHidden: true
      }
    );
    
    let diagnosticsHtml = '<h2>VS Code Diagnostics</h2>';
    let totalIssues = 0;
    
    for (const [uri, fileDiagnostics] of diagnostics) {
      if (fileDiagnostics.length > 0) {
        totalIssues += fileDiagnostics.length;
        diagnosticsHtml += `<h3>${uri.path}</h3><ul>`;
        
        for (const diagnostic of fileDiagnostics) {
          const severity = diagnostic.severity === vscode.DiagnosticSeverity.Error ? 'Error' :
                          diagnostic.severity === vscode.DiagnosticSeverity.Warning ? 'Warning' :
                          diagnostic.severity === vscode.DiagnosticSeverity.Information ? 'Info' : 'Hint';
          
          diagnosticsHtml += `<li><strong>${severity}</strong> (Line ${diagnostic.range.start.line + 1}): ${diagnostic.message}</li>`;
        }
        
        diagnosticsHtml += '</ul>';
      }
    }
    
    if (totalIssues === 0) {
      diagnosticsHtml += '<p>No issues found in current files.</p>';
    } else {
      diagnosticsHtml = `<p><strong>Total Issues: ${totalIssues}</strong></p>` + diagnosticsHtml;
    }
    
    panel.webview.html = createDiagnosticsHtml(diagnosticsHtml);
    
  } catch (error) {
    container.telemetryService.trackError('show_diagnostics_failed', String(error));
    vscode.window.showErrorMessage(`Failed to show diagnostics: ${error}`);
  }
}

async function showDebugLogs(): Promise<void> {
  try {
    container.telemetryService.trackCommandExecuted('showDebugLogs');
    
    const actions = ['Extension Logs', 'Telemetry Logs', 'Both Logs'];
    
    const selection = await vscode.window.showQuickPick(actions, {
      placeHolder: 'Select which logs to view...',
      title: 'Debug Logs'
    });
    
    if (!selection) return;
    
    const extensionChannel = vscode.window.createOutputChannel('Awesome Copilot Toolkit');
    
    switch (selection) {
      case 'Extension Logs':
        extensionChannel.show();
        break;
      case 'Telemetry Logs':
        container.telemetryService.showOutput();
        break;
      case 'Both Logs':
        createDebugLogsPanel();
        break;
    }
    
  } catch (error) {
    container.telemetryService.trackError('show_debug_logs_failed', String(error));
    vscode.window.showErrorMessage(`Failed to show debug logs: ${error}`);
  }
}

function createDebugLogsPanel(): void {
  const panel = vscode.window.createWebviewPanel(
    'debugLogs',
    'Debug Logs',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true
    }
  );
  
  panel.webview.html = createDebugLogsHtml();
  
  panel.webview.onDidReceiveMessage(message => {
    switch (message.command) {
      case 'refresh':
        vscode.window.showInformationMessage('Logs refreshed. Check the Output panels for latest content.');
        break;
      case 'openExtension':
        vscode.window.createOutputChannel('Awesome Copilot Toolkit').show();
        break;
      case 'openTelemetry':
        container.telemetryService.showOutput();
        break;
    }
  });
}

function handleFirstActivation(context: vscode.ExtensionContext): void {
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
}

function performBackgroundRefresh(): void {
  setTimeout(async () => {
    try {
      const items = await container.indexService.buildIndex();
      container.telemetryService.trackIndexBuilt(items.length);
    } catch (error) {
      console.log('Background index refresh failed:', error);
    }
  }, 5000);
}

function createDiagnosticsHtml(content: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: var(--vscode-font-family); padding: 20px; }
        h2 { color: var(--vscode-foreground); }
        h3 { color: var(--vscode-textLink-foreground); margin-top: 20px; }
        ul { margin-left: 20px; }
        li { margin: 5px 0; }
      </style>
    </head>
    <body>
      ${content}
    </body>
    </html>
  `;
}

function createDebugLogsHtml(): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { 
          font-family: var(--vscode-font-family); 
          padding: 20px;
          background-color: var(--vscode-editor-background);
          color: var(--vscode-editor-foreground);
        }
        .log-section { 
          margin-bottom: 30px; 
          border: 1px solid var(--vscode-panel-border);
          border-radius: 4px;
          padding: 15px;
        }
        .log-title { 
          color: var(--vscode-textLink-foreground); 
          margin-bottom: 10px;
          font-weight: bold;
        }
        .refresh-btn {
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          margin: 5px;
        }
        .refresh-btn:hover {
          background-color: var(--vscode-button-hoverBackground);
        }
      </style>
    </head>
    <body>
      <h2>Extension Debug Logs</h2>
      <button class="refresh-btn" onclick="refreshLogs()">Refresh Logs</button>
      
      <div class="log-section">
        <div class="log-title">Quick Actions</div>
        <button class="refresh-btn" onclick="openExtensionLogs()">Open Extension Output</button>
        <button class="refresh-btn" onclick="openTelemetryLogs()">Open Telemetry Output</button>
      </div>
      
      <script>
        const vscode = acquireVsCodeApi();
        
        function refreshLogs() {
          vscode.postMessage({ command: 'refresh' });
        }
        
        function openExtensionLogs() {
          vscode.postMessage({ command: 'openExtension' });
        }
        
        function openTelemetryLogs() {
          vscode.postMessage({ command: 'openTelemetry' });
        }
      </script>
    </body>
    </html>
  `;
}

export function deactivate(): void {
  console.log('Awesome Copilot Toolkit extension is now deactivated!');
  container?.dispose();
}
