import * as vscode from 'vscode';
import { AgentMessage } from '../types';

/**
 * Central message bus for agent-to-agent communication
 */
export class AgentCommunicationBus {
  private static instance: AgentCommunicationBus;
  private messageHandlers: Map<string, Array<(message: AgentMessage) => void>> = new Map();
  private messageHistory: AgentMessage[] = [];

  private constructor() {}

  static getInstance(): AgentCommunicationBus {
    if (!AgentCommunicationBus.instance) {
      AgentCommunicationBus.instance = new AgentCommunicationBus();
    }
    return AgentCommunicationBus.instance;
  }

  /**
   * Register a handler for messages to a specific agent
   */
  registerHandler(agentId: string, handler: (message: AgentMessage) => void): vscode.Disposable {
    if (!this.messageHandlers.has(agentId)) {
      this.messageHandlers.set(agentId, []);
    }
    this.messageHandlers.get(agentId)!.push(handler);

    return {
      dispose: () => {
        const handlers = this.messageHandlers.get(agentId);
        if (handlers) {
          const index = handlers.indexOf(handler);
          if (index > -1) {
            handlers.splice(index, 1);
          }
        }
      }
    };
  }

  /**
   * Send a message to another agent
   */
  sendMessage(message: AgentMessage): void {
    this.messageHistory.push(message);
    
    const handlers = this.messageHandlers.get(message.to);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          console.error(`Error handling message for agent ${message.to}:`, error);
        }
      });
    }
  }

  /**
   * Get message history
   */
  getHistory(agentId?: string): AgentMessage[] {
    if (agentId) {
      return this.messageHistory.filter(m => m.to === agentId || m.from === agentId);
    }
    return [...this.messageHistory];
  }

  /**
   * Clear message history
   */
  clearHistory(): void {
    this.messageHistory = [];
  }
}
