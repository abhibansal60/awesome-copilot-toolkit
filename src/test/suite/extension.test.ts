import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('Extension should be present', () => {
    assert.ok(vscode.extensions.getExtension('awesome-copilot-toolkit'));
  });

  test('Extension should activate', async () => {
    const extension = vscode.extensions.getExtension('awesome-copilot-toolkit');
    if (extension) {
      await extension.activate();
      assert.ok(extension.isActive);
    }
  });

  test('Commands should be registered', async () => {
    const commands = await vscode.commands.getCommands();
    
    const expectedCommands = [
      'awesomeCopilotToolkit.browseAll',
      'awesomeCopilotToolkit.browseCustomInstructions',
      'awesomeCopilotToolkit.browseReusablePrompts',
      'awesomeCopilotToolkit.browseCustomChatModes',
      'awesomeCopilotToolkit.refreshIndex',
      'awesomeCopilotToolkit.clearCache',
    ];

    for (const command of expectedCommands) {
      assert.ok(commands.includes(command), `Command ${command} should be registered`);
    }
  });

  test('Configuration should be available', () => {
    const config = vscode.workspace.getConfiguration('awesomeCopilotToolkit');
    
    assert.ok(config.has('defaultInstallLocation'));
    assert.ok(config.has('cacheTtlHours'));
    assert.ok(config.has('useDeepLinksWhenAvailable'));
    
    const defaultLocation = config.get('defaultInstallLocation');
    assert.strictEqual(defaultLocation, 'workspace');
    
    const cacheTtl = config.get('cacheTtlHours');
    assert.strictEqual(cacheTtl, 24);
    
    const useDeepLinks = config.get('useDeepLinksWhenAvailable');
    assert.strictEqual(useDeepLinks, true);
  });
});
