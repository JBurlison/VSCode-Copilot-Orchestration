/**
 * Copilot Orchestration Extension - Main Entry Point
 */

import * as vscode from "vscode";
import { PlanManager } from "./planManager";
import { AgentMessageBus } from "./agentMessageBus";
import { OrchestratorParticipant } from "./participants/orchestrator";
import { RequirementsParticipant } from "./participants/requirements";
import { PlanUIProvider, PlanUIPanel } from "./webview/planUI";
import { registerTools } from "./tools/languageModelTools";

export function activate(context: vscode.ExtensionContext) {
  console.log("Copilot Orchestration extension is now active");

  // Initialize core services
  const planManager = PlanManager.getInstance(context);
  const messageBus = AgentMessageBus.getInstance(context);

  // Register chat participants
  const orchestratorParticipant = new OrchestratorParticipant(
    context,
    planManager,
    messageBus,
  );
  context.subscriptions.push(orchestratorParticipant.register());

  const requirementsParticipant = new RequirementsParticipant(
    context,
    planManager,
    messageBus,
  );
  context.subscriptions.push(requirementsParticipant.register());

  // Register webview provider for Plan UI in sidebar
  const planUIProvider = new PlanUIProvider(context, planManager);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      PlanUIProvider.viewType,
      planUIProvider,
    ),
  );

  // Register language model tools
  const toolDisposables = registerTools(context, planManager, messageBus);
  toolDisposables.forEach((d) => context.subscriptions.push(d));

  // Log registered tools for debugging
  console.log(
    "Registered tools:",
    vscode.lm.tools.map((t) => t.name),
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("copilot-orchestration.openPlanUI", () => {
      PlanUIPanel.createOrShow(context, planManager);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "copilot-orchestration.launchAgentChat",
      async () => {
        const agents = messageBus.getAllAgents();
        const agentItems = agents.map((a) => ({
          label: `@${a.name}`,
          description: a.fullName,
          detail: a.description,
          agentId: a.id,
        }));

        const selected = await vscode.window.showQuickPick(agentItems, {
          placeHolder: "Select an agent to chat with",
        });

        if (selected) {
          const prompt = await vscode.window.showInputBox({
            prompt: `Enter your message for @${selected.agentId}`,
            placeHolder: "What would you like to ask?",
          });

          if (prompt) {
            await vscode.commands.executeCommand("workbench.action.chat.open", {
              query: `@${selected.agentId} ${prompt}`,
            });
          }
        }
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "copilot-orchestration.showAgentStatus",
      async () => {
        const agents = messageBus.getAllAgents();
        const queueStats = messageBus.getQueueStats();
        const planSummary = planManager.getPlanSummary();

        // Create a status message
        let statusMessage = "## Agent Status\n\n";

        for (const agent of agents) {
          const stats = queueStats[agent.id] || { total: 0, unprocessed: 0 };
          const activeEmoji = agent.isActive ? "🟢" : "⚪";
          statusMessage += `${activeEmoji} **${agent.fullName}** (@${agent.name})\n`;
          statusMessage += `   - Pending messages: ${stats.unprocessed}\n`;
          statusMessage += `   - Total messages: ${stats.total}\n\n`;
        }

        statusMessage += "## Plan Summary\n\n";
        statusMessage += `- User Stories: ${planSummary.totalUserStories}\n`;
        statusMessage += `- Tasks: ${planSummary.totalTasks}\n`;
        statusMessage += `- In Progress: ${planSummary.tasksByStatus["in-progress"]}\n`;
        statusMessage += `- Completed: ${planSummary.tasksByStatus["completed"]}\n`;

        // Show in a new untitled markdown document
        const doc = await vscode.workspace.openTextDocument({
          content: statusMessage,
          language: "markdown",
        });
        await vscode.window.showTextDocument(doc, { preview: true });
      },
    ),
  );

  // Create status bar item
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100,
  );
  statusBarItem.command = "copilot-orchestration.openPlanUI";
  statusBarItem.text = "$(project) Orchestration";
  statusBarItem.tooltip = "Open Project Plan";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Update status bar with task counts
  const updateStatusBar = () => {
    const summary = planManager.getPlanSummary();
    const inProgress = summary.tasksByStatus["in-progress"];
    const total = summary.totalTasks;
    statusBarItem.text = `$(project) ${inProgress}/${total} tasks`;
  };

  planManager.onPlanChanged(updateStatusBar);
  updateStatusBar();

  // Listen for agent messages and show notifications
  messageBus.onMessage((event) => {
    if (event.direction === "incoming") {
      return; // Don't notify on our own messages being processed
    }

    const msg = event.message;
    if (msg.messageType === "handoff") {
      vscode.window
        .showInformationMessage(
          `Task handed off to @${msg.targetAgent}: ${msg.content.substring(0, 50)}...`,
          "View",
        )
        .then((selection) => {
          if (selection === "View") {
            vscode.commands.executeCommand("workbench.action.chat.open", {
              query: `@${msg.targetAgent}`,
            });
          }
        });
    }
  });

  return {
    // Export APIs for other extensions
    getPlanManager: () => planManager,
    getMessageBus: () => messageBus,
  };
}

export function deactivate() {
  console.log("Copilot Orchestration extension is now deactivated");
}
