import * as vscode from 'vscode';
import { IndexService } from './indexService';
import { QuickPickService } from '../ui/quickPick';
import { TelemetryService } from './telemetry';
import { StatusBarService } from './statusBar';
import { SidebarProvider } from '../ui/sidebarProvider';
import { CommandHandler } from './commandHandler';

export class ServiceContainer {
  private _indexService?: IndexService;
  private _quickPickService?: QuickPickService;
  private _telemetryService?: TelemetryService;
  private _statusBarService?: StatusBarService;
  private _sidebarProvider?: SidebarProvider;
  private _commandHandler?: CommandHandler;

  constructor(private context: vscode.ExtensionContext) {}

  get indexService(): IndexService {
    if (!this._indexService) {
      this._indexService = new IndexService(this.context);
    }
    return this._indexService;
  }

  get quickPickService(): QuickPickService {
    if (!this._quickPickService) {
      this._quickPickService = new QuickPickService(this.indexService);
    }
    return this._quickPickService;
  }

  get telemetryService(): TelemetryService {
    if (!this._telemetryService) {
      this._telemetryService = new TelemetryService(this.context);
    }
    return this._telemetryService;
  }

  get statusBarService(): StatusBarService {
    if (!this._statusBarService) {
      this._statusBarService = new StatusBarService();
    }
    return this._statusBarService;
  }

  get sidebarProvider(): SidebarProvider {
    if (!this._sidebarProvider) {
      this._sidebarProvider = new SidebarProvider(this.context, this.indexService);
    }
    return this._sidebarProvider;
  }

  get commandHandler(): CommandHandler {
    if (!this._commandHandler) {
      this._commandHandler = new CommandHandler(
        this.indexService,
        this.quickPickService,
        this.telemetryService
      );
    }
    return this._commandHandler;
  }

  dispose(): void {
    // Clean up any resources if needed
    this._statusBarService?.dispose();
  }
}
