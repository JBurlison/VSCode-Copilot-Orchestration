/**
 * Language Model Tools - Implements the tools available for agents
 */

import * as vscode from "vscode";
import { PlanManager } from "../planManager";
import { AgentMessageBus } from "../agentMessageBus";
import {
  LaunchChatInput,
  SendAgentMessageInput,
  UpdateUserStoryInput,
  UpdateTaskInput,
  GetPlanStatusInput,
  GetAgentQueueInput,
} from "../types";

/**
 * Registers all language model tools for the extension
 */
export function registerTools(
  context: vscode.ExtensionContext,
  planManager: PlanManager,
  messageBus: AgentMessageBus,
): vscode.Disposable[] {
  const disposables: vscode.Disposable[] = [];

  console.log("[Copilot Orchestration] Registering language model tools...");

  // Launch Chat Tool
  disposables.push(vscode.lm.registerTool("launchChat", new LaunchChatTool()));
  console.log("[Copilot Orchestration] Registered tool: launchChat");

  // Send Agent Message Tool
  disposables.push(
    vscode.lm.registerTool(
      "sendAgentMessage",
      new SendAgentMessageTool(messageBus),
    ),
  );
  console.log("[Copilot Orchestration] Registered tool: sendAgentMessage");

  // Update User Story Tool
  disposables.push(
    vscode.lm.registerTool(
      "updateUserStory",
      new UpdateUserStoryTool(planManager),
    ),
  );
  console.log("[Copilot Orchestration] Registered tool: updateUserStory");

  // Update Task Tool
  disposables.push(
    vscode.lm.registerTool("updateTask", new UpdateTaskTool(planManager)),
  );
  console.log("[Copilot Orchestration] Registered tool: updateTask");

  // Get Plan Status Tool
  disposables.push(
    vscode.lm.registerTool("getPlanStatus", new GetPlanStatusTool(planManager)),
  );
  console.log("[Copilot Orchestration] Registered tool: getPlanStatus");

  // Get Agent Queue Tool
  disposables.push(
    vscode.lm.registerTool("getAgentQueue", new GetAgentQueueTool(messageBus)),
  );
  console.log("[Copilot Orchestration] Registered tool: getAgentQueue");

  console.log(
    "[Copilot Orchestration] All tools registered. Available tools:",
    vscode.lm.tools.map((t) => t.name),
  );

  return disposables;
}

/**
 * Launch Chat Tool - Opens a new chat window with a specific agent
 */
class LaunchChatTool implements vscode.LanguageModelTool<LaunchChatInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<LaunchChatInput>,
    token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    const { agentId, prompt, model } = options.input;

    try {
      // Execute the command to open a chat with the agent
      await vscode.commands.executeCommand("workbench.action.chat.open", {
        query: `@${agentId} ${prompt}`,
        mode: model, // Optional model preference
      });

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `Successfully launched chat with agent @${agentId}. The chat window has been opened with the provided prompt.`,
        ),
      ]);
    } catch (error) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `Failed to launch chat: ${error instanceof Error ? error.message : "Unknown error"}`,
        ),
      ]);
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<LaunchChatInput>,
    token: vscode.CancellationToken,
  ): Promise<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: `Launching chat with @${options.input.agentId}...`,
    };
  }
}

/**
 * Send Agent Message Tool - Sends messages between agents
 */
class SendAgentMessageTool implements vscode.LanguageModelTool<SendAgentMessageInput> {
  constructor(private messageBus: AgentMessageBus) {}

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<SendAgentMessageInput>,
    token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    const { targetAgent, messageType, content, metadata } = options.input;

    try {
      // Determine source agent from context (default to 'orchestrator')
      const sourceAgent = "orchestrator";

      const message = await this.messageBus.sendMessage(
        sourceAgent,
        targetAgent,
        messageType,
        content,
        metadata,
      );

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          JSON.stringify(
            {
              success: true,
              messageId: message.id,
              targetAgent,
              messageType,
              timestamp: message.timestamp,
            },
            null,
            2,
          ),
        ),
      ]);
    } catch (error) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `Failed to send message: ${error instanceof Error ? error.message : "Unknown error"}`,
        ),
      ]);
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<SendAgentMessageInput>,
    token: vscode.CancellationToken,
  ): Promise<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: `Sending ${options.input.messageType} to @${options.input.targetAgent}...`,
    };
  }
}

/**
 * Update User Story Tool - Creates or updates a user story in the plan
 */
class UpdateUserStoryTool implements vscode.LanguageModelTool<UpdateUserStoryInput> {
  constructor(private planManager: PlanManager) {}

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<UpdateUserStoryInput>,
    token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    const {
      userStoryId,
      title,
      status,
      description,
      assignedAgent,
      storyPoints,
      acceptanceCriteria,
      dependsOn,
    } = options.input;

    try {
      // Check if user story exists
      const existingStory = this.planManager.getUserStory(userStoryId);

      let userStory;
      if (existingStory) {
        userStory = await this.planManager.updateUserStory(userStoryId, {
          title,
          status,
          description,
          assignedAgent,
          storyPoints,
          acceptanceCriteria,
          dependsOn,
        });
      } else {
        userStory = await this.planManager.createUserStory({
          id: userStoryId,
          title,
          status,
          description,
          assignedAgent,
          storyPoints,
          acceptanceCriteria,
          dependsOn,
        });
      }

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          JSON.stringify(
            {
              success: true,
              action: existingStory ? "updated" : "created",
              userStory,
            },
            null,
            2,
          ),
        ),
      ]);
    } catch (error) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `Failed to update user story: ${error instanceof Error ? error.message : "Unknown error"}`,
        ),
      ]);
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<UpdateUserStoryInput>,
    token: vscode.CancellationToken,
  ): Promise<vscode.PreparedToolInvocation> {
    const existing = this.planManager.getUserStory(options.input.userStoryId);
    return {
      invocationMessage: existing
        ? `Updating user story "${options.input.title}"...`
        : `Creating user story "${options.input.title}"...`,
    };
  }
}

/**
 * Update Task Tool - Creates or updates a task in the plan
 */
class UpdateTaskTool implements vscode.LanguageModelTool<UpdateTaskInput> {
  constructor(private planManager: PlanManager) {}

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<UpdateTaskInput>,
    token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    const {
      taskId,
      userStoryId,
      title,
      status,
      description,
      assignedAgent,
      priority,
    } = options.input;

    try {
      // Verify user story exists
      const userStory = this.planManager.getUserStory(userStoryId);
      if (!userStory) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(
            `Failed: User Story "${userStoryId}" does not exist. Please create the user story first.`,
          ),
        ]);
      }

      // Check if task exists
      const existingTask = this.planManager.getTask(taskId);

      let task;
      if (existingTask) {
        task = await this.planManager.updateTask(taskId, {
          userStoryId,
          title,
          status,
          description,
          assignedAgent,
          priority,
        });
      } else {
        task = await this.planManager.createTask({
          id: taskId,
          userStoryId,
          title,
          status,
          description,
          assignedAgent,
          priority,
        });
      }

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          JSON.stringify(
            {
              success: true,
              action: existingTask ? "updated" : "created",
              task,
            },
            null,
            2,
          ),
        ),
      ]);
    } catch (error) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `Failed to update task: ${error instanceof Error ? error.message : "Unknown error"}`,
        ),
      ]);
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<UpdateTaskInput>,
    token: vscode.CancellationToken,
  ): Promise<vscode.PreparedToolInvocation> {
    const existing = this.planManager.getTask(options.input.taskId);
    return {
      invocationMessage: existing
        ? `Updating task "${options.input.title}"...`
        : `Creating task "${options.input.title}"...`,
    };
  }
}

/**
 * Get Plan Status Tool - Retrieves current plan state
 */
class GetPlanStatusTool implements vscode.LanguageModelTool<GetPlanStatusInput> {
  constructor(private planManager: PlanManager) {}

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<GetPlanStatusInput>,
    token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    const { includeCompleted = true, filterByAgent } = options.input;

    try {
      let userStories = this.planManager.getUserStories();
      let tasks = this.planManager.getTasks();

      // Apply filters
      if (!includeCompleted) {
        userStories = userStories.filter((s) => s.status !== "completed");
        tasks = tasks.filter((t) => t.status !== "completed");
      }

      if (filterByAgent) {
        userStories = userStories.filter(
          (s) => s.assignedAgent === filterByAgent,
        );
        tasks = tasks.filter((t) => t.assignedAgent === filterByAgent);
      }

      const summary = this.planManager.getPlanSummary();

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          JSON.stringify(
            {
              summary,
              userStories: userStories.map((s) => ({
                id: s.id,
                title: s.title,
                status: s.status,
                storyPoints: s.storyPoints,
                assignedAgent: s.assignedAgent,
                taskCount: tasks.filter((t) => t.userStoryId === s.id).length,
              })),
              tasks: tasks.map((t) => ({
                id: t.id,
                userStoryId: t.userStoryId,
                title: t.title,
                status: t.status,
                priority: t.priority,
                assignedAgent: t.assignedAgent,
              })),
            },
            null,
            2,
          ),
        ),
      ]);
    } catch (error) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `Failed to get plan status: ${error instanceof Error ? error.message : "Unknown error"}`,
        ),
      ]);
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<GetPlanStatusInput>,
    token: vscode.CancellationToken,
  ): Promise<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: "Retrieving plan status...",
    };
  }
}

/**
 * Get Agent Queue Tool - Retrieves pending messages for an agent
 */
class GetAgentQueueTool implements vscode.LanguageModelTool<GetAgentQueueInput> {
  constructor(private messageBus: AgentMessageBus) {}

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<GetAgentQueueInput>,
    token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    const { agentId, messageType = "all" } = options.input;

    try {
      const messages = await this.messageBus.getMessages(
        agentId,
        messageType,
        true,
      );
      const stats = this.messageBus.getQueueStats();

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          JSON.stringify(
            {
              agentId,
              queueStats: stats[agentId] || { total: 0, unprocessed: 0 },
              pendingMessages: messages.map((m) => ({
                id: m.id,
                from: m.sourceAgent,
                type: m.messageType,
                content: m.content,
                timestamp: new Date(m.timestamp).toISOString(),
              })),
            },
            null,
            2,
          ),
        ),
      ]);
    } catch (error) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `Failed to get agent queue: ${error instanceof Error ? error.message : "Unknown error"}`,
        ),
      ]);
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<GetAgentQueueInput>,
    token: vscode.CancellationToken,
  ): Promise<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: `Checking message queue for @${options.input.agentId}...`,
    };
  }
}
