/**
 * Requirements Builder Chat Participant - Helps build and refine project requirements
 */

import * as vscode from 'vscode';
import { PlanManager } from '../planManager';
import { AgentMessageBus } from '../agentMessageBus';
import { AgentMessage } from '../types';

export interface Requirement {
    id: string;
    title: string;
    description: string;
    type: 'functional' | 'non-functional' | 'constraint';
    priority: 'must-have' | 'should-have' | 'could-have' | 'wont-have';
    status: 'draft' | 'reviewed' | 'approved' | 'rejected';
    acceptanceCriteria: string[];
    relatedUserStoryId?: string;
}

export class RequirementsParticipant {
    public static readonly ID = 'copilot-orchestration.requirements';
    private planManager: PlanManager;
    private messageBus: AgentMessageBus;
    private requirements: Map<string, Requirement> = new Map();

    constructor(
        private context: vscode.ExtensionContext,
        planManager: PlanManager,
        messageBus: AgentMessageBus
    ) {
        this.planManager = planManager;
        this.messageBus = messageBus;
        this.loadRequirements();
    }

    private loadRequirements(): void {
        const stored = this.context.workspaceState.get<Record<string, Requirement>>('orchestration.requirements');
        if (stored) {
            Object.entries(stored).forEach(([id, req]) => {
                this.requirements.set(id, req);
            });
        }
    }

    private async saveRequirements(): Promise<void> {
        const data: Record<string, Requirement> = {};
        this.requirements.forEach((req, id) => {
            data[id] = req;
        });
        await this.context.workspaceState.update('orchestration.requirements', data);
    }

    public register(): vscode.Disposable {
        const participant = vscode.chat.createChatParticipant(
            RequirementsParticipant.ID,
            this.handleRequest.bind(this)
        );

        participant.iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'requirements.svg');

        return participant;
    }

    private async handleRequest(
        request: vscode.ChatRequest,
        context: vscode.ChatContext,
        stream: vscode.ChatResponseStream,
        token: vscode.CancellationToken
    ): Promise<vscode.ChatResult> {
        // Check for pending messages from orchestrator
        const pendingMessages = await this.messageBus.getMessages('requirements', 'all', true);
        
        // Handle commands
        if (request.command) {
            switch (request.command) {
                case 'gather':
                    return this.handleGatherCommand(request, stream, token);
                case 'analyze':
                    return this.handleAnalyzeCommand(request, stream, token);
                case 'export':
                    return this.handleExportCommand(request, stream, token);
            }
        }

        // Process any handoffs from orchestrator
        const handoffs = pendingMessages.filter(m => m.messageType === 'handoff');
        if (handoffs.length > 0) {
            return this.handleHandoff(handoffs[0], request, stream, token);
        }

        // Default behavior
        return this.handleGeneralRequest(request, stream, token);
    }

    private async handleGatherCommand(
        request: vscode.ChatRequest,
        stream: vscode.ChatResponseStream,
        token: vscode.CancellationToken
    ): Promise<vscode.ChatResult> {
        stream.markdown('## 📝 Requirements Gathering\n\n');
        stream.markdown('Let me help you gather requirements for your project.\n\n');

        stream.markdown('### Questions to Consider:\n\n');
        stream.markdown('1. **What is the main purpose of this project?**\n');
        stream.markdown('2. **Who are the primary users?**\n');
        stream.markdown('3. **What are the must-have features?**\n');
        stream.markdown('4. **What are the nice-to-have features?**\n');
        stream.markdown('5. **Are there any technical constraints?**\n');
        stream.markdown('6. **What are the performance requirements?**\n');
        stream.markdown('7. **Are there security requirements?**\n');
        stream.markdown('8. **What is the timeline?**\n\n');

        stream.markdown('Please describe your project and I will help you structure the requirements.\n');

        return { metadata: { command: 'gather' } };
    }

    private async handleAnalyzeCommand(
        request: vscode.ChatRequest,
        stream: vscode.ChatResponseStream,
        token: vscode.CancellationToken
    ): Promise<vscode.ChatResult> {
        stream.markdown('## 🔍 Requirements Analysis\n\n');

        if (this.requirements.size === 0) {
            stream.markdown('No requirements defined yet.\n\n');
            stream.markdown('Use `/gather` to start collecting requirements.\n');
            return { metadata: { command: 'analyze' } };
        }

        // Group requirements by type
        const functional: Requirement[] = [];
        const nonFunctional: Requirement[] = [];
        const constraints: Requirement[] = [];

        this.requirements.forEach(req => {
            switch (req.type) {
                case 'functional': functional.push(req); break;
                case 'non-functional': nonFunctional.push(req); break;
                case 'constraint': constraints.push(req); break;
            }
        });

        stream.markdown('### Functional Requirements\n\n');
        this.renderRequirementList(stream, functional);

        stream.markdown('### Non-Functional Requirements\n\n');
        this.renderRequirementList(stream, nonFunctional);

        stream.markdown('### Constraints\n\n');
        this.renderRequirementList(stream, constraints);

        // Summary
        stream.markdown('### Summary\n\n');
        const byPriority = this.groupByPriority();
        stream.markdown(`- **Must Have:** ${byPriority['must-have']?.length || 0}\n`);
        stream.markdown(`- **Should Have:** ${byPriority['should-have']?.length || 0}\n`);
        stream.markdown(`- **Could Have:** ${byPriority['could-have']?.length || 0}\n`);
        stream.markdown(`- **Won't Have:** ${byPriority['wont-have']?.length || 0}\n`);

        return { metadata: { command: 'analyze' } };
    }

    private async handleExportCommand(
        request: vscode.ChatRequest,
        stream: vscode.ChatResponseStream,
        token: vscode.CancellationToken
    ): Promise<vscode.ChatResult> {
        stream.markdown('## 📤 Exporting Requirements to Plan\n\n');

        if (this.requirements.size === 0) {
            stream.markdown('No requirements to export.\n');
            return { metadata: { command: 'export' } };
        }

        // Create phases based on requirement groups
        const approvedReqs = Array.from(this.requirements.values()).filter(r => r.status === 'approved');
        
        if (approvedReqs.length === 0) {
            stream.markdown('⚠️ No approved requirements to export. Please review and approve requirements first.\n');
            return { metadata: { command: 'export' } };
        }

        stream.markdown('Creating user stories from approved requirements...\n\n');

        // Group by priority for user stories
        const mustHave = approvedReqs.filter(r => r.priority === 'must-have');
        const shouldHave = approvedReqs.filter(r => r.priority === 'should-have');
        const couldHave = approvedReqs.filter(r => r.priority === 'could-have');

        if (mustHave.length > 0) {
            const userStory = await this.planManager.createUserStory({
                title: 'Core Features (Must Have)',
                description: 'Essential requirements that must be implemented',
                status: 'not-started',
                storyPoints: mustHave.length * 3
            });

            for (const req of mustHave) {
                await this.planManager.createTask({
                    userStoryId: userStory.id,
                    title: req.title,
                    description: req.description,
                    status: 'not-started',
                    priority: 'high'
                });
            }

            stream.markdown(`✅ Created user story: **${userStory.title}** with ${mustHave.length} tasks\n`);
        }

        if (shouldHave.length > 0) {
            const userStory = await this.planManager.createUserStory({
                title: 'Important Features (Should Have)',
                description: 'High-priority requirements',
                status: 'not-started',
                storyPoints: shouldHave.length * 2
            });

            for (const req of shouldHave) {
                await this.planManager.createTask({
                    userStoryId: userStory.id,
                    title: req.title,
                    description: req.description,
                    status: 'not-started',
                    priority: 'medium'
                });
            }

            stream.markdown(`✅ Created user story: **${userStory.title}** with ${shouldHave.length} tasks\n`);
        }

        if (couldHave.length > 0) {
            const userStory = await this.planManager.createUserStory({
                title: 'Nice to Have Features',
                description: 'Optional enhancements',
                status: 'not-started',
                storyPoints: couldHave.length * 1
            });

            for (const req of couldHave) {
                await this.planManager.createTask({
                    userStoryId: userStory.id,
                    title: req.title,
                    description: req.description,
                    status: 'not-started',
                    priority: 'low'
                });
            }

            stream.markdown(`✅ Created user story: **${userStory.title}** with ${couldHave.length} tasks\n`);
        }

        stream.markdown('\n📋 Requirements exported to plan successfully!\n');

        // Notify orchestrator
        await this.messageBus.sendMessage(
            'requirements',
            'orchestrator',
            'notification',
            `Exported ${approvedReqs.length} requirements to the project plan.`,
            { exportedCount: approvedReqs.length }
        );

        stream.button({
            command: 'copilot-orchestration.openPlanUI',
            title: 'View Plan'
        });

        return { metadata: { command: 'export' } };
    }

    private async handleHandoff(
        handoff: AgentMessage,
        request: vscode.ChatRequest,
        stream: vscode.ChatResponseStream,
        token: vscode.CancellationToken
    ): Promise<vscode.ChatResult> {
        stream.markdown('## 📬 Task from Orchestrator\n\n');
        stream.markdown(`*${handoff.content}*\n\n`);

        // Mark as processed
        await this.messageBus.markAsProcessed(handoff.id, 'requirements', 'Acknowledged');

        stream.markdown('I will help with this task. What would you like me to focus on?\n');

        return { metadata: { command: 'handoff' } };
    }

    private async handleGeneralRequest(
        request: vscode.ChatRequest,
        stream: vscode.ChatResponseStream,
        token: vscode.CancellationToken
    ): Promise<vscode.ChatResult> {
        stream.markdown('## 📋 Requirements Builder\n\n');
        stream.markdown('I can help you build and manage project requirements.\n\n');

        stream.markdown('**Available Commands:**\n');
        stream.markdown('- `/gather` - Start gathering requirements through guided questions\n');
        stream.markdown('- `/analyze` - Analyze and categorize existing requirements\n');
        stream.markdown('- `/export` - Export approved requirements to the project plan\n\n');

        stream.markdown('You can also tell me about your project and I will help structure the requirements.\n');

        return { metadata: { command: 'general' } };
    }

    private renderRequirementList(stream: vscode.ChatResponseStream, requirements: Requirement[]): void {
        if (requirements.length === 0) {
            stream.markdown('*None defined*\n\n');
            return;
        }

        for (const req of requirements) {
            const statusEmoji = this.getStatusEmoji(req.status);
            const priorityBadge = `[${req.priority}]`;
            stream.markdown(`- ${statusEmoji} **${req.title}** ${priorityBadge}\n`);
            if (req.description) {
                stream.markdown(`  ${req.description}\n`);
            }
        }
        stream.markdown('\n');
    }

    private groupByPriority(): Record<string, Requirement[]> {
        const groups: Record<string, Requirement[]> = {};
        this.requirements.forEach(req => {
            if (!groups[req.priority]) {
                groups[req.priority] = [];
            }
            groups[req.priority].push(req);
        });
        return groups;
    }

    private getStatusEmoji(status: string): string {
        switch (status) {
            case 'draft': return '📝';
            case 'reviewed': return '👀';
            case 'approved': return '✅';
            case 'rejected': return '❌';
            default: return '⚪';
        }
    }

    // Public methods for adding requirements programmatically
    public async addRequirement(req: Omit<Requirement, 'id'>): Promise<Requirement> {
        const id = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const requirement: Requirement = { ...req, id };
        this.requirements.set(id, requirement);
        await this.saveRequirements();
        return requirement;
    }

    public getRequirements(): Requirement[] {
        return Array.from(this.requirements.values());
    }
}
