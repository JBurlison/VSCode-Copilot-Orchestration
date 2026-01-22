import * as vscode from 'vscode';
import { AgentCommunicationBus } from '../utils/agentCommunication';
import { PlanStateManager } from '../utils/planStateManager';
import { ChatWindowLauncher } from '../utils/chatWindowLauncher';
import { MessageType } from '../types';

/**
 * Orchestration Agent - Coordinates multiple agents to accomplish complex tasks
 */
export class OrchestrationAgent {
  private communicationBus: AgentCommunicationBus;
  private planManager: PlanStateManager;

  constructor(
    private context: vscode.ExtensionContext
  ) {
    this.communicationBus = AgentCommunicationBus.getInstance();
    this.planManager = PlanStateManager.getInstance();
  }

  async handleRequest(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<vscode.ChatResult> {
    const prompt = request.prompt.trim();

    stream.markdown('🎯 **Orchestrator Agent** activated\n\n');

    try {
      // Parse the request
      if (prompt.toLowerCase().includes('create plan') || prompt.toLowerCase().includes('new plan')) {
        return await this.handleCreatePlan(prompt, stream);
      } else if (prompt.toLowerCase().includes('add phase')) {
        return await this.handleAddPhase(prompt, stream);
      } else if (prompt.toLowerCase().includes('add task')) {
        return await this.handleAddTask(prompt, stream);
      } else if (prompt.toLowerCase().includes('coordinate') || prompt.toLowerCase().includes('delegate')) {
        return await this.handleCoordination(prompt, stream);
      } else if (prompt.toLowerCase().includes('status')) {
        return await this.handleStatus(stream);
      } else {
        return await this.handleGeneralRequest(prompt, stream);
      }
    } catch (error) {
      stream.markdown(`\n\n❌ Error: ${error}\n`);
      return { errorDetails: { message: String(error) } };
    }
  }

  private async handleCreatePlan(prompt: string, stream: vscode.ChatResponseStream): Promise<vscode.ChatResult> {
    stream.markdown('Creating a new plan...\n\n');
    
    const title = this.extractValue(prompt, 'title') || 'New Project Plan';
    const description = this.extractValue(prompt, 'description') || prompt;

    const plan = this.planManager.createPlan(title, description);
    
    stream.markdown(`✅ Created plan: **${plan.title}**\n\n`);
    stream.markdown(`📋 Plan ID: ${plan.id}\n\n`);
    stream.markdown('You can now add phases and tasks to this plan.\n');

    // Show the plan UI
    vscode.commands.executeCommand('copilot-orchestration.showPlanUI');

    return { metadata: { planId: plan.id } };
  }

  private async handleAddPhase(prompt: string, stream: vscode.ChatResponseStream): Promise<vscode.ChatResult> {
    const currentPlan = this.planManager.getCurrentPlan();
    if (!currentPlan) {
      stream.markdown('⚠️ No active plan. Please create a plan first.\n');
      return {};
    }

    const title = this.extractValue(prompt, 'title') || this.extractTitle(prompt);
    const description = this.extractValue(prompt, 'description') || prompt;

    const phase = this.planManager.addPhase(currentPlan.id, title, description);
    
    if (phase) {
      stream.markdown(`✅ Added phase: **${phase.title}**\n\n`);
      stream.markdown(`Phase ID: ${phase.id}\n`);
    } else {
      stream.markdown('❌ Failed to add phase\n');
    }

    return { metadata: { phaseId: phase?.id } };
  }

  private async handleAddTask(prompt: string, stream: vscode.ChatResponseStream): Promise<vscode.ChatResult> {
    const currentPlan = this.planManager.getCurrentPlan();
    if (!currentPlan) {
      stream.markdown('⚠️ No active plan. Please create a plan first.\n');
      return {};
    }

    if (currentPlan.phases.length === 0) {
      stream.markdown('⚠️ No phases in the current plan. Please add a phase first.\n');
      return {};
    }

    const title = this.extractValue(prompt, 'title') || this.extractTitle(prompt);
    const description = this.extractValue(prompt, 'description') || prompt;
    
    // Add to the last phase by default
    const phase = currentPlan.phases[currentPlan.phases.length - 1];
    const task = this.planManager.addTask(currentPlan.id, phase.id, title, description);
    
    if (task) {
      stream.markdown(`✅ Added task: **${task.title}** to phase **${phase.title}**\n\n`);
      stream.markdown(`Task ID: ${task.id}\n`);
    } else {
      stream.markdown('❌ Failed to add task\n');
    }

    return { metadata: { taskId: task?.id } };
  }

  private async handleCoordination(prompt: string, stream: vscode.ChatResponseStream): Promise<vscode.ChatResult> {
    stream.markdown('🤝 Coordinating with other agents...\n\n');

    // Example: Break down the task and delegate to other agents
    stream.markdown('I can help coordinate multiple agents for your task:\n\n');
    stream.markdown('1. **Requirements Builder**: Gather detailed requirements\n');
    stream.markdown('2. **Implementation Agents**: Execute specific subtasks\n');
    stream.markdown('3. **Review Agents**: Validate the results\n\n');
    
    stream.button({
      command: 'copilot-orchestration.newChatWindow',
      title: 'Launch Requirements Builder',
      arguments: ['requirements']
    });

    return {};
  }

  private async handleStatus(stream: vscode.ChatResponseStream): Promise<vscode.ChatResult> {
    const currentPlan = this.planManager.getCurrentPlan();
    
    if (!currentPlan) {
      stream.markdown('No active plan.\n');
      return {};
    }

    stream.markdown(`# 📊 Current Plan Status\n\n`);
    stream.markdown(`**${currentPlan.title}**\n\n`);
    stream.markdown(`${currentPlan.description}\n\n`);
    stream.markdown(`## Phases (${currentPlan.phases.length})\n\n`);

    for (const phase of currentPlan.phases) {
      const totalTasks = phase.tasks.length;
      const completedTasks = phase.tasks.filter(t => t.status === 'done').length;
      stream.markdown(`### ${phase.title}\n`);
      stream.markdown(`- Tasks: ${completedTasks}/${totalTasks} completed\n`);
      
      if (phase.tasks.length > 0) {
        for (const task of phase.tasks) {
          const statusIcon = task.status === 'done' ? '✅' : 
                           task.status === 'in_progress' ? '🔄' : 
                           task.status === 'blocked' ? '🚫' : '⬜';
          stream.markdown(`  - ${statusIcon} ${task.title}\n`);
        }
      }
      stream.markdown('\n');
    }

    return {};
  }

  private async handleGeneralRequest(prompt: string, stream: vscode.ChatResponseStream): Promise<vscode.ChatResult> {
    stream.markdown('I can help you orchestrate complex tasks by coordinating multiple agents.\n\n');
    stream.markdown('**Available commands:**\n');
    stream.markdown('- `create plan` - Create a new project plan\n');
    stream.markdown('- `add phase` - Add a phase to the current plan\n');
    stream.markdown('- `add task` - Add a task to the current phase\n');
    stream.markdown('- `status` - View the current plan status\n');
    stream.markdown('- `coordinate` - Coordinate with other agents\n\n');
    
    stream.button({
      command: 'copilot-orchestration.showPlanUI',
      title: 'Show Plan Board'
    });

    return {};
  }

  private extractValue(text: string, key: string): string | null {
    const regex = new RegExp(`${key}[:\\s]+["\']?([^"\'\\n]+)["\']?`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : null;
  }

  private extractTitle(text: string): string {
    // Extract the first quoted string or the main subject
    const quotedMatch = text.match(/["']([^"']+)["']/);
    if (quotedMatch) {
      return quotedMatch[1];
    }
    
    // Remove common command words and return the rest
    const cleaned = text
      .replace(/^(add|create|new)\s+(phase|task)\s+/i, '')
      .split('\n')[0]
      .trim();
    
    return cleaned.substring(0, 100);
  }
}
