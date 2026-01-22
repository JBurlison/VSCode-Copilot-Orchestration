import * as vscode from 'vscode';
import { OrchestrationAgent } from './agents/orchestrationAgent';
import { RequirementsBuilderAgent } from './agents/requirementsBuilderAgent';
import { PlanBoardProvider } from './views/planBoardView';
import { ChatWindowLauncher } from './utils/chatWindowLauncher';
import { PlanStateManager } from './utils/planStateManager';
import { AgentCommunicationBus } from './utils/agentCommunication';

/**
 * Main extension activation function
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('Copilot Orchestration extension is now active');

    // Initialize singletons
    const planManager = PlanStateManager.getInstance();
    const communicationBus = AgentCommunicationBus.getInstance();

    // Create agents
    const orchestrationAgent = new OrchestrationAgent(context);
    const requirementsAgent = new RequirementsBuilderAgent(context);

    // Register chat participants
    const orchestratorParticipant = vscode.chat.createChatParticipant(
        'copilot-orchestration.orchestrator',
        async (request, chatContext, stream, token) => {
            return await orchestrationAgent.handleRequest(request, chatContext, stream, token);
        }
    );
    orchestratorParticipant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'resources', 'orchestrator.png');

    const requirementsParticipant = vscode.chat.createChatParticipant(
        'copilot-orchestration.requirements',
        async (request, chatContext, stream, token) => {
            return await requirementsAgent.handleRequest(request, chatContext, stream, token);
        }
    );
    requirementsParticipant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'resources', 'requirements.png');

    // Register webview provider for plan board
    const planBoardProvider = new PlanBoardProvider(context);
    const planBoardView = vscode.window.registerWebviewViewProvider(
        PlanBoardProvider.viewType,
        planBoardProvider
    );

    // Register commands
    const showPlanUICommand = vscode.commands.registerCommand(
        'copilot-orchestration.showPlanUI',
        async () => {
            // Create or show the webview panel
            const panel = vscode.window.createWebviewPanel(
                'planBoard',
                'Plan Board',
                vscode.ViewColumn.Beside,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            // Manually set up the webview for the panel
            const planManager = PlanStateManager.getInstance();
            const currentPlan = planManager.getCurrentPlan();

            panel.webview.options = {
                enableScripts: true,
                localResourceRoots: [context.extensionUri]
            };

            // Create provider instance to get HTML
            const provider = new PlanBoardProvider(context);
            panel.webview.html = provider.getHtmlForWebviewPublic(panel.webview);

            // Handle messages from webview
            panel.webview.onDidReceiveMessage(data => {
                provider.handleMessagePublic(data);
            });

            // Listen for plan changes
            const disposable = planManager.onPlanChanged((plan) => {
                panel.webview.postMessage({
                    type: 'updatePlan',
                    plan: plan ? provider.serializePlanPublic(plan) : null
                });
            });

            // Clean up on disposal
            panel.onDidDispose(() => {
                disposable.dispose();
            });

            // Send initial plan data
            if (currentPlan) {
                panel.webview.postMessage({
                    type: 'updatePlan',
                    plan: provider.serializePlanPublic(currentPlan)
                });
            }
        }
    );

    const newChatWindowCommand = vscode.commands.registerCommand(
        'copilot-orchestration.newChatWindow',
        async (agent?: string) => {
            if (agent === 'requirements') {
                await ChatWindowLauncher.launchRequirementsBuilder();
            } else if (agent === 'orchestrator') {
                await ChatWindowLauncher.launchOrchestrator('Help me with my task');
            } else {
                // Show quick pick
                const selection = await vscode.window.showQuickPick(
                    [
                        { label: '$(organization) Orchestrator', value: 'orchestrator' },
                        { label: '$(checklist) Requirements Builder', value: 'requirements' }
                    ],
                    {
                        placeHolder: 'Select an agent to chat with'
                    }
                );

                if (selection) {
                    if (selection.value === 'requirements') {
                        await ChatWindowLauncher.launchRequirementsBuilder();
                    } else {
                        await ChatWindowLauncher.launchOrchestrator('Help me with my task');
                    }
                }
            }
        }
    );

    // Register agent tools
    const updatePhaseCommand = vscode.commands.registerCommand(
        'copilot-orchestration.updatePhase',
        async (planId: string, phaseId: string, updates: any) => {
            return planManager.updatePhase(planId, phaseId, updates);
        }
    );

    const updateTaskCommand = vscode.commands.registerCommand(
        'copilot-orchestration.updateTaskStatus',
        async (planId: string, phaseId: string, taskId: string, status: any) => {
            return planManager.updateTaskStatus(planId, phaseId, taskId, status);
        }
    );

    const sendMessageCommand = vscode.commands.registerCommand(
        'copilot-orchestration.sendAgentMessage',
        async (message: any) => {
            communicationBus.sendMessage(message);
        }
    );

    // Add all disposables to context
    context.subscriptions.push(
        orchestratorParticipant,
        requirementsParticipant,
        planBoardView,
        showPlanUICommand,
        newChatWindowCommand,
        updatePhaseCommand,
        updateTaskCommand,
        sendMessageCommand
    );

    // Show welcome message
    vscode.window.showInformationMessage(
        'Copilot Orchestration is ready! Try @orchestrator or @requirements in chat.'
    );
}

/**
 * Extension deactivation function
 */
export function deactivate() {
    console.log('Copilot Orchestration extension is now deactivated');
}
