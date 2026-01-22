import * as vscode from 'vscode';
import { PlanStateManager } from '../utils/planStateManager';
import { AgentCommunicationBus } from '../utils/agentCommunication';
import { MessageType } from '../types';

/**
 * Requirements Builder Agent - Helps gather and structure project requirements
 */
export class RequirementsBuilderAgent {
  private planManager: PlanStateManager;
  private communicationBus: AgentCommunicationBus;
  private requirementsSessions: Map<string, any> = new Map();

  constructor(
    private context: vscode.ExtensionContext
  ) {
    this.planManager = PlanStateManager.getInstance();
    this.communicationBus = AgentCommunicationBus.getInstance();
  }

  async handleRequest(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<vscode.ChatResult> {
    const prompt = request.prompt.trim();

    stream.markdown('📝 **Requirements Builder** activated\n\n');

    try {
      if (prompt.toLowerCase().includes('start') || prompt.toLowerCase().includes('begin')) {
        return await this.handleStartSession(stream);
      } else if (prompt.toLowerCase().includes('feature') || prompt.toLowerCase().includes('functionality')) {
        return await this.handleFeatureRequirement(prompt, stream);
      } else if (prompt.toLowerCase().includes('constraint') || prompt.toLowerCase().includes('limitation')) {
        return await this.handleConstraint(prompt, stream);
      } else if (prompt.toLowerCase().includes('finalize') || prompt.toLowerCase().includes('complete')) {
        return await this.handleFinalize(stream);
      } else {
        return await this.handleGeneralRequirement(prompt, stream);
      }
    } catch (error) {
      stream.markdown(`\n\n❌ Error: ${error}\n`);
      return { errorDetails: { message: String(error) } };
    }
  }

  private async handleStartSession(stream: vscode.ChatResponseStream): Promise<vscode.ChatResult> {
    stream.markdown('Let\'s gather your project requirements! 🚀\n\n');
    stream.markdown('I\'ll help you structure:\n');
    stream.markdown('- **Functional Requirements**: What the system should do\n');
    stream.markdown('- **Non-Functional Requirements**: Performance, security, etc.\n');
    stream.markdown('- **Constraints**: Limitations and boundaries\n');
    stream.markdown('- **Dependencies**: External systems and libraries\n\n');
    stream.markdown('Tell me about your project. What are you trying to build?\n');

    return {};
  }

  private async handleFeatureRequirement(prompt: string, stream: vscode.ChatResponseStream): Promise<vscode.ChatResult> {
    stream.markdown('📌 **Feature Requirement Captured**\n\n');
    
    // Parse the feature from the prompt
    const feature = this.extractFeature(prompt);
    
    stream.markdown(`**Feature**: ${feature}\n\n`);
    
    // Create a phase for this requirement in the current plan
    const currentPlan = this.planManager.getCurrentPlan();
    if (currentPlan) {
      const phase = this.planManager.addPhase(
        currentPlan.id,
        feature,
        `Implementation of: ${feature}`
      );
      
      if (phase) {
        stream.markdown(`✅ Added to plan as phase: **${phase.title}**\n\n`);
      }
    } else {
      stream.markdown('💡 Tip: Create a plan with the orchestrator to track this requirement.\n\n');
    }

    stream.markdown('What else should this feature include?\n');

    return { metadata: { feature } };
  }

  private async handleConstraint(prompt: string, stream: vscode.ChatResponseStream): Promise<vscode.ChatResult> {
    stream.markdown('⚠️ **Constraint Noted**\n\n');
    
    const constraint = this.extractConstraint(prompt);
    stream.markdown(`**Constraint**: ${constraint}\n\n`);
    stream.markdown('I\'ll keep this in mind when building the plan.\n');

    return { metadata: { constraint } };
  }

  private async handleFinalize(stream: vscode.ChatResponseStream): Promise<vscode.ChatResult> {
    stream.markdown('✨ **Finalizing Requirements**\n\n');
    
    const currentPlan = this.planManager.getCurrentPlan();
    if (currentPlan) {
      stream.markdown(`Your requirements have been organized into **${currentPlan.phases.length} phases**.\n\n`);
      
      stream.markdown('### Summary\n\n');
      for (let i = 0; i < currentPlan.phases.length; i++) {
        const phase = currentPlan.phases[i];
        stream.markdown(`${i + 1}. **${phase.title}**\n`);
        stream.markdown(`   ${phase.description}\n\n`);
      }
      
      stream.markdown('You can now work with the orchestrator to break these down into tasks.\n\n');
      
      stream.button({
        command: 'copilot-orchestration.showPlanUI',
        title: 'View Plan Board'
      });
    } else {
      stream.markdown('No active plan found. Create a plan with the orchestrator first.\n');
    }

    return {};
  }

  private async handleGeneralRequirement(prompt: string, stream: vscode.ChatResponseStream): Promise<vscode.ChatResult> {
    stream.markdown('I\'m analyzing your requirement...\n\n');
    
    // Try to categorize the requirement
    if (this.isPerformanceRelated(prompt)) {
      stream.markdown('📊 This appears to be a **performance requirement**.\n\n');
    } else if (this.isSecurityRelated(prompt)) {
      stream.markdown('🔒 This appears to be a **security requirement**.\n\n');
    } else if (this.isUIRelated(prompt)) {
      stream.markdown('🎨 This appears to be a **UI/UX requirement**.\n\n');
    } else {
      stream.markdown('📋 This appears to be a **functional requirement**.\n\n');
    }

    stream.markdown(`**Requirement**: ${prompt}\n\n`);
    
    // Add to the current plan if exists
    const currentPlan = this.planManager.getCurrentPlan();
    if (currentPlan) {
      const category = this.categorizeRequirement(prompt);
      let phase = currentPlan.phases.find(p => p.title.includes(category));
      
      if (!phase) {
        const newPhase = this.planManager.addPhase(
          currentPlan.id,
          category,
          `${category} requirements and implementation`
        );
        if (newPhase) {
          phase = newPhase;
        }
      }
      
      if (phase) {
        this.planManager.addTask(
          currentPlan.id,
          phase.id,
          this.extractTitle(prompt),
          prompt
        );
        stream.markdown(`✅ Added to plan under **${phase.title}**\n\n`);
      }
    }

    stream.markdown('Any other requirements or constraints?\n');

    return {};
  }

  private extractFeature(text: string): string {
    const cleaned = text
      .replace(/^(feature|add|create|implement)\s+/i, '')
      .split('\n')[0]
      .trim();
    return cleaned.substring(0, 100) || 'New Feature';
  }

  private extractConstraint(text: string): string {
    const cleaned = text
      .replace(/^(constraint|limitation|must|should)\s+/i, '')
      .split('\n')[0]
      .trim();
    return cleaned || text;
  }

  private extractTitle(text: string): string {
    const firstLine = text.split('\n')[0].trim();
    return firstLine.substring(0, 100) || 'Requirement';
  }

  private isPerformanceRelated(text: string): boolean {
    return /performance|speed|fast|optimize|latency|throughput/i.test(text);
  }

  private isSecurityRelated(text: string): boolean {
    return /security|secure|authentication|authorization|encrypt|protect/i.test(text);
  }

  private isUIRelated(text: string): boolean {
    return /ui|ux|interface|design|layout|visual|display|user experience/i.test(text);
  }

  private categorizeRequirement(text: string): string {
    if (this.isPerformanceRelated(text)) return 'Performance';
    if (this.isSecurityRelated(text)) return 'Security';
    if (this.isUIRelated(text)) return 'UI/UX';
    return 'Core Features';
  }
}
