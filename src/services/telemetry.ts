import * as vscode from 'vscode';

export class TelemetryService {
  private readonly context: vscode.ExtensionContext;
  private readonly outputChannel: vscode.OutputChannel;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.outputChannel = vscode.window.createOutputChannel('Awesome Copilot Toolkit Telemetry');
  }

  trackEvent(eventName: string, properties?: Record<string, string | number>): void {
    // Only track if telemetry is enabled
    if (!vscode.env.isTelemetryEnabled) {
      return;
    }

    try {
      // In a real extension, you would send this to your telemetry service
      // For now, we'll just log it to the output channel for debugging
      const timestamp = new Date().toISOString();
      const eventData = {
        timestamp,
        event: eventName,
        properties: properties || {},
      };

      this.outputChannel.appendLine(`[TELEMETRY] ${JSON.stringify(eventData)}`);
      
      // You could also use vscode.telemetry.sendTelemetryEvent if available
      // vscode.telemetry.sendTelemetryEvent(eventName, properties);
    } catch (error) {
      // Silently fail telemetry to avoid breaking the extension
      console.debug('Telemetry failed:', error);
    }
  }

  trackIndexBuilt(itemCount: number): void {
    this.trackEvent('index_built', { itemCount });
  }

  trackItemInstalled(itemType: string, itemId: string): void {
    this.trackEvent('item_installed', { itemType, itemId });
  }

  trackPreviewOpened(itemType: string, itemId: string): void {
    this.trackEvent('preview_opened', { itemType, itemId });
  }

  trackCommandExecuted(commandName: string): void {
    this.trackEvent('command_executed', { command: commandName });
  }

  trackError(errorType: string, errorMessage: string): void {
    this.trackEvent('error_occurred', { errorType, errorMessage: errorMessage.substring(0, 100) });
  }

  showOutput(): void {
    this.outputChannel.show();
  }
}
