import * as vscode from 'vscode';
import { ChatWindowOptions } from '../types';

/**
 * Utility for launching new chat windows with specific configurations
 */
export class ChatWindowLauncher {
  /**
   * Launch a new chat window with the specified options
   */
  static async launchChatWindow(options: ChatWindowOptions): Promise<void> {
    try {
      // Build the chat request
      let chatPrompt = options.prompt || '';
      
      if (options.agent) {
        // Address the specific agent
        chatPrompt = `@${options.agent} ${chatPrompt}`;
      }

      if (options.context) {
        // Add context to the prompt
        chatPrompt += `\n\nContext: ${JSON.stringify(options.context, null, 2)}`;
      }

      // Open the chat view and send the prompt
      await vscode.commands.executeCommand('workbench.action.chat.open', {
        query: chatPrompt
      });

      vscode.window.showInformationMessage(
        `Launched chat window${options.agent ? ` with @${options.agent}` : ''}`
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to launch chat window: ${error}`);
      throw error;
    }
  }

  /**
   * Launch a chat window with the orchestrator agent
   */
  static async launchOrchestrator(task: string, context?: any): Promise<void> {
    await this.launchChatWindow({
      agent: 'orchestrator',
      prompt: task,
      context
    });
  }

  /**
   * Launch a chat window with the requirements builder agent
   */
  static async launchRequirementsBuilder(context?: any): Promise<void> {
    await this.launchChatWindow({
      agent: 'requirements',
      prompt: 'Help me gather and structure requirements for my project',
      context
    });
  }
}
