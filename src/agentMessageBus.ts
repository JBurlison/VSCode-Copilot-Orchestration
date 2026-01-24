/**
 * Agent Message Bus - Handles inter-agent communication
 */

import * as vscode from 'vscode';
import { AgentMessage, AgentQueue, MessageType, AgentMessageEvent, AgentInfo } from './types';

export class AgentMessageBus {
    private static instance: AgentMessageBus;
    private queues: Map<string, AgentMessage[]> = new Map();
    private agents: Map<string, AgentInfo> = new Map();
    private readonly _onMessage = new vscode.EventEmitter<AgentMessageEvent>();
    public readonly onMessage = this._onMessage.event;

    private constructor(private context: vscode.ExtensionContext) {
        this.loadQueues();
        this.initializeKnownAgents();
    }

    public static getInstance(context?: vscode.ExtensionContext): AgentMessageBus {
        if (!AgentMessageBus.instance) {
            if (!context) {
                throw new Error('AgentMessageBus must be initialized with context first');
            }
            AgentMessageBus.instance = new AgentMessageBus(context);
        }
        return AgentMessageBus.instance;
    }

    private initializeKnownAgents(): void {
        // Register built-in agents
        this.registerAgent({
            id: 'orchestrator',
            name: 'orchestrator',
            fullName: 'Orchestrator',
            description: 'Orchestrates multi-agent workflows',
            isActive: true
        });

        this.registerAgent({
            id: 'requirements',
            name: 'requirements',
            fullName: 'Requirements Builder',
            description: 'Helps build and refine project requirements',
            isActive: true
        });
    }

    private loadQueues(): void {
        const stored = this.context.workspaceState.get<Record<string, AgentMessage[]>>('orchestration.queues');
        if (stored) {
            Object.entries(stored).forEach(([agentId, messages]) => {
                this.queues.set(agentId, messages);
            });
        }
    }

    private async saveQueues(): Promise<void> {
        const data: Record<string, AgentMessage[]> = {};
        this.queues.forEach((messages, agentId) => {
            data[agentId] = messages;
        });
        await this.context.workspaceState.update('orchestration.queues', data);
    }

    private generateId(): string {
        return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // ========================================================================
    // Agent Management
    // ========================================================================

    public registerAgent(info: AgentInfo): void {
        this.agents.set(info.id, info);
        if (!this.queues.has(info.id)) {
            this.queues.set(info.id, []);
        }
    }

    public getAgent(agentId: string): AgentInfo | undefined {
        return this.agents.get(agentId);
    }

    public getAllAgents(): AgentInfo[] {
        return Array.from(this.agents.values());
    }

    public updateAgentActivity(agentId: string): void {
        const agent = this.agents.get(agentId);
        if (agent) {
            agent.lastActiveAt = Date.now();
            agent.isActive = true;
        }
    }

    // ========================================================================
    // Message Operations
    // ========================================================================

    public async sendMessage(
        sourceAgent: string,
        targetAgent: string,
        messageType: MessageType,
        content: string,
        metadata?: Record<string, unknown>
    ): Promise<AgentMessage> {
        const message: AgentMessage = {
            id: this.generateId(),
            sourceAgent,
            targetAgent,
            messageType,
            content,
            metadata,
            timestamp: Date.now(),
            processed: false
        };

        // Add to target agent's queue
        if (!this.queues.has(targetAgent)) {
            this.queues.set(targetAgent, []);
        }
        this.queues.get(targetAgent)!.push(message);
        await this.saveQueues();

        // Fire event
        this._onMessage.fire({ message, direction: 'outgoing' });

        // Update source agent activity
        this.updateAgentActivity(sourceAgent);

        return message;
    }

    public async getMessages(
        agentId: string,
        messageType?: MessageType | 'all',
        unprocessedOnly: boolean = true
    ): Promise<AgentMessage[]> {
        const queue = this.queues.get(agentId) || [];
        
        return queue.filter(msg => {
            if (unprocessedOnly && msg.processed) {
                return false;
            }
            if (messageType && messageType !== 'all' && msg.messageType !== messageType) {
                return false;
            }
            return true;
        });
    }

    public async markAsProcessed(messageId: string, agentId: string, response?: string): Promise<boolean> {
        const queue = this.queues.get(agentId);
        if (!queue) {
            return false;
        }

        const message = queue.find(m => m.id === messageId);
        if (!message) {
            return false;
        }

        message.processed = true;
        if (response) {
            message.response = response;
        }
        await this.saveQueues();
        
        // Fire event
        this._onMessage.fire({ message, direction: 'incoming' });
        
        return true;
    }

    public async clearQueue(agentId: string): Promise<void> {
        this.queues.set(agentId, []);
        await this.saveQueues();
    }

    public async clearProcessedMessages(agentId: string): Promise<void> {
        const queue = this.queues.get(agentId);
        if (queue) {
            this.queues.set(agentId, queue.filter(m => !m.processed));
            await this.saveQueues();
        }
    }

    // ========================================================================
    // Handoff Operations
    // ========================================================================

    public async handoffToAgent(
        sourceAgent: string,
        targetAgent: string,
        context: string,
        taskData: Record<string, unknown>
    ): Promise<AgentMessage> {
        return this.sendMessage(
            sourceAgent,
            targetAgent,
            'handoff',
            context,
            { taskData, handoffTime: Date.now() }
        );
    }

    // ========================================================================
    // Query Operations
    // ========================================================================

    public getQueueStats(): Record<string, { total: number; unprocessed: number }> {
        const stats: Record<string, { total: number; unprocessed: number }> = {};
        
        this.queues.forEach((messages, agentId) => {
            stats[agentId] = {
                total: messages.length,
                unprocessed: messages.filter(m => !m.processed).length
            };
        });

        return stats;
    }

    public async getConversationThread(messageId: string): Promise<AgentMessage[]> {
        const allMessages: AgentMessage[] = [];
        this.queues.forEach(queue => {
            allMessages.push(...queue);
        });

        // Find the original message
        const originalMessage = allMessages.find(m => m.id === messageId);
        if (!originalMessage) {
            return [];
        }

        // Get all related messages (simple implementation - just gets direct responses)
        return allMessages.filter(m => 
            m.id === messageId ||
            m.metadata?.replyTo === messageId ||
            originalMessage.metadata?.replyTo === m.id
        ).sort((a, b) => a.timestamp - b.timestamp);
    }

    public dispose(): void {
        this._onMessage.dispose();
    }
}
