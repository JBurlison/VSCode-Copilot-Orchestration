/**
 * Orchestrator Chat Participant - Coordinates multi-agent workflows
 * Uses VS Code's language model tool calling to interact with the plan board
 */

import * as vscode from "vscode";
import { PlanManager } from "../planManager";
import { AgentMessageBus } from "../agentMessageBus";
import { AgentMessage } from "../types";

export class OrchestratorParticipant {
  public static readonly ID = "copilot-orchestration.orchestrator";
  private planManager: PlanManager;
  private messageBus: AgentMessageBus;

  constructor(
    private context: vscode.ExtensionContext,
    planManager: PlanManager,
    messageBus: AgentMessageBus,
  ) {
    this.planManager = planManager;
    this.messageBus = messageBus;
  }

  public register(): vscode.Disposable {
    const participant = vscode.chat.createChatParticipant(
      OrchestratorParticipant.ID,
      this.handleRequest.bind(this),
    );

    participant.iconPath = vscode.Uri.joinPath(
      this.context.extensionUri,
      "media",
      "orchestrator.svg",
    );

    return participant;
  }

  private async handleRequest(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
  ): Promise<vscode.ChatResult> {
    // Check for pending messages from other agents
    const pendingMessages = await this.messageBus.getMessages(
      "orchestrator",
      "all",
      true,
    );

    // Handle commands
    if (request.command) {
      switch (request.command) {
        case "plan":
          return this.handlePlanCommand(request, stream, token);
        case "delegate":
          return this.handleDelegateCommand(request, stream, token);
        case "status":
          return this.handleStatusCommand(request, stream, token);
        case "execute":
          return this.handleExecuteCommand(request, stream, token);
        case "review":
          return this.handleReviewCommand(request, stream, token);
      }
    }

    // Default behavior - use language model with tools to handle the request
    return this.handleWithTools(
      request,
      context,
      stream,
      token,
      pendingMessages,
    );
  }

  private async handleWithTools(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
    pendingMessages: AgentMessage[],
  ): Promise<vscode.ChatResult> {
    // Inform about pending messages if any
    if (pendingMessages.length > 0) {
      stream.markdown(
        `📬 **${pendingMessages.length} pending message(s) from other agents**\n\n`,
      );
      for (const msg of pendingMessages.slice(0, 3)) {
        stream.markdown(
          `- From **${msg.sourceAgent}**: ${msg.content.substring(0, 100)}...\n`,
        );
      }
      stream.markdown("\n---\n\n");
    }

    const isPlanRequest = this.isPlanCreationPrompt(request.prompt);
    const approvalRequested = this.isApprovalPhrase(request.prompt);
    if (approvalRequested && !isPlanRequest) {
      const approvalState = this.getApprovalState();

      if (approvalState.pending) {
        await this.setApprovalState({ pending: false, approved: true });
        return this.handleExecuteCommand(request, stream, token);
      }

      stream.markdown(
        "⚠️ No plan is pending approval. Create or modify a plan first.\n",
      );
      return { metadata: { command: "approve" } };
    }

    const isReviewRequest = this.isReviewPrompt(request.prompt);

    // Get current plan state to provide context
    const planSummary = this.planManager.getPlanSummary();
    const userStories = this.planManager.getUserStories();
    const currentPlanContext = this.buildPlanContext(userStories, planSummary);

    // Build the system prompt for the orchestrator
    const systemPrompt = this.buildSystemPrompt(currentPlanContext);

    try {
      // Select a chat model
      const models = await vscode.lm.selectChatModels({
        vendor: "copilot",
        family: "gpt-4o",
      });

      if (models.length === 0) {
        stream.markdown(
          "⚠️ No language model available. Please ensure GitHub Copilot is active.\n",
        );
        return this.showHelp(stream);
      }

      const model = models[0];

      // Build conversation history from context
      const messages: vscode.LanguageModelChatMessage[] = [
        vscode.LanguageModelChatMessage.User(systemPrompt),
      ];

      // Add previous turns from chat context
      for (const turn of context.history) {
        if (turn instanceof vscode.ChatRequestTurn) {
          messages.push(vscode.LanguageModelChatMessage.User(turn.prompt));
        } else if (turn instanceof vscode.ChatResponseTurn) {
          const responseText = turn.response
            .filter(
              (part): part is vscode.ChatResponseMarkdownPart =>
                part instanceof vscode.ChatResponseMarkdownPart,
            )
            .map((part) => part.value.value)
            .join("");
          if (responseText) {
            messages.push(
              vscode.LanguageModelChatMessage.Assistant(responseText),
            );
          }
        }
      }

      // Add the current request
      messages.push(vscode.LanguageModelChatMessage.User(request.prompt));

      // Get available tools
      const tools = this.getAvailableTools();

      // Send request with tool support
      const response = await model.sendRequest(messages, { tools }, token);

      // Process the response, handling tool calls
      const toolResults: Map<string, vscode.LanguageModelToolResult> =
        new Map();
      let planMutated = false;
      const createdReviewStoryIds: string[] = [];

      for await (const part of response.stream) {
        if (part instanceof vscode.LanguageModelTextPart) {
          stream.markdown(part.value);
        } else if (part instanceof vscode.LanguageModelToolCallPart) {
          // Execute the tool call
          stream.markdown(
            `\n🔧 *Executing: ${this.formatToolName(part.name)}...*\n`,
          );

          try {
            // Check if the tool is available
            const availableToolNames = vscode.lm.tools.map((t) => t.name);
            if (!availableToolNames.includes(part.name)) {
              stream.markdown(
                `⚠️ Tool "${part.name}" is not available. Available tools: ${availableToolNames.join(", ") || "none"}\n\n`,
              );
              continue;
            }

            if (this.isPlanMutationTool(part.name)) {
              planMutated = true;
            }

            const result = await vscode.lm.invokeTool(
              part.name,
              {
                input: part.input,
                toolInvocationToken: request.toolInvocationToken,
              },
              token,
            );

            toolResults.set(part.callId, result);

            // Show success feedback
            const resultText = this.extractToolResultText(result);
            if (resultText) {
              stream.markdown(
                `✅ ${this.formatToolResult(part.name, resultText)}\n\n`,
              );

              const reviewStoryId = this.extractReviewStoryId(
                part.name,
                resultText,
              );
              if (
                reviewStoryId &&
                !createdReviewStoryIds.includes(reviewStoryId)
              ) {
                createdReviewStoryIds.push(reviewStoryId);
              }
            }
          } catch (error) {
            stream.markdown(
              `❌ Tool error: ${error instanceof Error ? error.message : "Unknown error"}\n\n`,
            );
          }
        }
      }

      // If tools were called, continue the conversation with tool results
      if (toolResults.size > 0) {
        // Add tool results to messages
        const toolResultMessages: vscode.LanguageModelChatMessage[] = [];
        for (const [callId, result] of toolResults) {
          const resultText = this.extractToolResultText(result);
          toolResultMessages.push(
            vscode.LanguageModelChatMessage.User(
              `Tool execution completed. Result: ${resultText}`,
            ),
          );
        }

        messages.push(...toolResultMessages);
        messages.push(
          vscode.LanguageModelChatMessage.User(
            "Summarize what was just created or updated on the board.",
          ),
        );

        // Get follow-up response
        const followUp = await model.sendRequest(messages, {}, token);
        stream.markdown("\n");
        for await (const chunk of followUp.text) {
          stream.markdown(chunk);
        }
      }

      if (planMutated && !isReviewRequest) {
        const reviewState = this.getReviewState();
        if (reviewState.halted) {
          await this.setReviewState({ halted: false, haltedPlanUpdatedAt: 0 });
        }
      }

      if (isReviewRequest) {
        if (createdReviewStoryIds.length === 0) {
          await this.setReviewState({
            inProgress: false,
            halted: true,
            haltedPlanUpdatedAt: this.planManager.getPlan().updatedAt,
          });
          stream.markdown(
            "\n✅ No new code review artifacts found. Review cycle halted.\n",
          );
        } else {
          await this.setReviewState({ inProgress: false, halted: false });
          for (const storyId of createdReviewStoryIds) {
            await this.executeTasksForStory(storyId, stream);
          }
        }
      }

      if (!isReviewRequest) {
        await this.maybeStartReviewCycle(stream);
      }

      if (planMutated) {
        await this.setApprovalState({ pending: true, approved: false });

        // Add buttons for approval workflow
        stream.markdown("\n\n---\n\n");
        stream.markdown("**📋 Plan ready for review.**\n\n");
        stream.markdown("Once you've reviewed the plan above, you can:\n");
        stream.markdown("- Say `approve` or `looks good` to start execution\n");
        stream.markdown("- Say `make changes` to modify the plan\n");
        stream.markdown(
          "- Use `/execute` to start delegating tasks to agents\n\n",
        );
      }

      stream.button({
        command: "copilot-orchestration.openPlanUI",
        title: "📋 Open Plan UI",
      });
    } catch (error) {
      if (error instanceof vscode.LanguageModelError) {
        stream.markdown(`⚠️ Language model error: ${error.message}\n\n`);
      } else {
        stream.markdown(
          `⚠️ Error: ${error instanceof Error ? error.message : "Unknown error"}\n\n`,
        );
      }
      return this.showHelp(stream);
    }

    return { metadata: { command: "orchestrate" } };
  }

  private buildSystemPrompt(planContext: string): string {
    return `You are the Orchestrator agent for a VS Code extension that manages project plans with user stories and tasks.

Your job is to:
1. Create and manage user stories (similar to Agile user stories) on the plan board
2. Create and manage tasks within those user stories
3. Update status of items (not-started, in-progress, blocked, completed)
4. Coordinate work between agents
5. Provide status updates and summaries
6. Handle plan approval and execution

CURRENT PLAN STATE:
${planContext}

AVAILABLE TOOLS:
- updateUserStory: Create or update a user story. Requires: userStoryId (unique ID you generate like "story-1"), title, status. Optional: description, storyPoints (1-13), acceptanceCriteria (array), assignedAgent.
- updateTask: Create or update a task. Requires: taskId (unique ID like "task-1-1"), userStoryId (must match existing story), title, status. Optional: description, priority (low/medium/high/critical), assignedAgent.
- getPlanStatus: Get current state of all items.

IMPORTANT GUIDELINES:
1. When creating NEW items, generate sequential unique IDs: "story-1", "story-2" for stories, "task-1-1", "task-1-2" for tasks.
2. ALWAYS use the tools to create/update items - don't just describe what you would do.
3. For new plans: First create user stories, then add tasks to each story.
4. Set initial status to "not-started" for new items.
5. After creating items, briefly confirm what was added.

APPROVAL WORKFLOW:
- If the user says "approve", "approved", "looks good", "LGTM", "execute", or similar approval phrases, tell them to use the /execute command to start delegating tasks to agents.
- If the user wants changes, use the tools to update the plan accordingly.

When the user asks to create a plan, add stories, or add tasks - USE THE TOOLS to actually create them on the board.`;
  }

  private buildPlanContext(userStories: any[], summary: any): string {
    if (userStories.length === 0) {
      return "The plan is currently empty. No user stories or tasks exist yet.";
    }

    let context = `Total: ${summary.totalUserStories} user stories, ${summary.totalTasks} tasks\n\n`;
    context += "Existing items:\n";

    for (const story of userStories) {
      const tasks = this.planManager.getTasks(story.id);
      context += `- [${story.status}] "${story.title}" (ID: ${story.id})`;
      if (story.storyPoints) context += ` - ${story.storyPoints} pts`;
      context += "\n";

      for (const task of tasks) {
        context += `  - [${task.status}] "${task.title}" (ID: ${task.id})\n`;
      }
    }

    return context;
  }

  private getAvailableTools(): vscode.LanguageModelChatTool[] {
    return [
      {
        name: "updateUserStory",
        description:
          "Create or update a user story on the plan board. Use this to add new user stories or modify existing ones.",
        inputSchema: {
          type: "object",
          properties: {
            userStoryId: {
              type: "string",
              description:
                'Unique ID for the user story (e.g., "story-1", "story-2")',
            },
            title: { type: "string", description: "Title of the user story" },
            status: {
              type: "string",
              enum: ["not-started", "in-progress", "blocked", "completed"],
              description: "Status",
            },
            description: {
              type: "string",
              description: "Detailed description",
            },
            storyPoints: { type: "number", description: "Story points (1-13)" },
            acceptanceCriteria: {
              type: "array",
              items: { type: "string" },
              description: "Acceptance criteria list",
            },
            assignedAgent: { type: "string", description: "Assigned agent" },
          },
          required: ["userStoryId", "title", "status"],
        },
      },
      {
        name: "updateTask",
        description:
          "Create or update a task within a user story. The userStoryId must match an existing user story.",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: 'Unique ID for the task (e.g., "task-1-1")',
            },
            userStoryId: {
              type: "string",
              description: "ID of the parent user story",
            },
            title: { type: "string", description: "Title of the task" },
            status: {
              type: "string",
              enum: ["not-started", "in-progress", "blocked", "completed"],
              description: "Status",
            },
            description: { type: "string", description: "Description" },
            priority: {
              type: "string",
              enum: ["low", "medium", "high", "critical"],
              description: "Priority",
            },
            assignedAgent: { type: "string", description: "Assigned agent" },
          },
          required: ["taskId", "userStoryId", "title", "status"],
        },
      },
      {
        name: "getPlanStatus",
        description: "Get the current status of all user stories and tasks.",
        inputSchema: {
          type: "object",
          properties: {
            includeCompleted: {
              type: "boolean",
              description: "Include completed items",
            },
            filterByAgent: { type: "string", description: "Filter by agent" },
          },
        },
      },
    ];
  }

  private formatToolName(name: string): string {
    if (name.includes("UserStory")) return "Update User Story";
    if (name.includes("Task")) return "Update Task";
    if (name.includes("Status")) return "Get Plan Status";
    return name;
  }

  private extractToolResultText(
    result: vscode.LanguageModelToolResult,
  ): string {
    if (!result.content) return "";

    for (const part of result.content) {
      if (part instanceof vscode.LanguageModelTextPart) {
        return part.value;
      }
    }
    return "";
  }

  private formatToolResult(toolName: string, resultText: string): string {
    try {
      const result = JSON.parse(resultText);
      if (result.success) {
        if (toolName.includes("UserStory")) {
          return `User story "${result.userStory?.title}" ${result.action}`;
        } else if (toolName.includes("Task")) {
          return `Task "${result.task?.title}" ${result.action}`;
        }
      }
      return result.success ? "Operation completed" : `Failed: ${resultText}`;
    } catch {
      return resultText.substring(0, 100);
    }
  }

  private getApprovalState(): { pending: boolean; approved: boolean } {
    return (
      this.context.workspaceState.get<{ pending: boolean; approved: boolean }>(
        "orchestration.planApproval",
      ) ?? { pending: false, approved: false }
    );
  }

  private async setApprovalState(update: {
    pending?: boolean;
    approved?: boolean;
  }): Promise<void> {
    const current = this.getApprovalState();
    const next = { ...current, ...update };
    await this.context.workspaceState.update(
      "orchestration.planApproval",
      next,
    );
  }

  private isApprovalPhrase(text: string): boolean {
    const normalized = text.trim().toLowerCase();
    const shortApproval =
      /^(approve|approved|lgtm|looks good|looks great|ship it|go ahead|start|execute|run it|yes|okay|ok|do it)(\s+the\s+plan|\s+plan)?[.!\s]*$/i.test(
        normalized,
      );
    if (shortApproval) return true;

    if (normalized.length > 120) return false;

    return /\b(approve|approved|lgtm|looks good|looks great|ship it)\b/i.test(
      normalized,
    );
  }

  private isPlanCreationPrompt(text: string): boolean {
    const normalized = text.toLowerCase();
    return (
      /\b(create|build|draft|generate|make)\b/.test(normalized) &&
      /\b(plan|user story|user stories|stories|tasks)\b/.test(normalized)
    );
  }

  private isPlanMutationTool(toolName: string): boolean {
    return toolName === "updateUserStory" || toolName === "updateTask";
  }

  private getReviewState(): {
    inProgress: boolean;
    halted: boolean;
    cycle: number;
    haltedPlanUpdatedAt: number;
  } {
    return (
      this.context.workspaceState.get<{
        inProgress: boolean;
        halted: boolean;
        cycle: number;
        haltedPlanUpdatedAt: number;
      }>("orchestration.reviewState") ?? {
        inProgress: false,
        halted: false,
        cycle: 0,
        haltedPlanUpdatedAt: 0,
      }
    );
  }

  private async setReviewState(update: {
    inProgress?: boolean;
    halted?: boolean;
    cycle?: number;
    haltedPlanUpdatedAt?: number;
  }): Promise<void> {
    const current = this.getReviewState();
    const next = { ...current, ...update };
    await this.context.workspaceState.update("orchestration.reviewState", next);
  }

  private isReviewPrompt(text: string): boolean {
    const normalized = text.toLowerCase();
    return /\b(code review|review cycle|review the plan|review artifacts|review phase)\b/i.test(
      normalized,
    );
  }

  private extractReviewStoryId(
    toolName: string,
    resultText: string,
  ): string | null {
    if (!toolName.includes("updateUserStory")) {
      return null;
    }

    try {
      const result = JSON.parse(resultText);
      const title: string | undefined = result?.userStory?.title;
      const id: string | undefined = result?.userStory?.id;
      if (!title || !id) return null;
      if (!/^Code Review Cycle\s+\d+/i.test(title)) return null;
      return id;
    } catch {
      return null;
    }
  }

  private isPlanComplete(): boolean {
    const summary = this.planManager.getPlanSummary();
    return (
      summary.totalTasks > 0 &&
      summary.tasksByStatus.completed === summary.totalTasks
    );
  }

  private getNextReviewCycleNumber(): number {
    const userStories = this.planManager.getUserStories();
    let maxCycle = 0;
    for (const story of userStories) {
      const match = /^Code Review Cycle\s+(\d+)/i.exec(story.title);
      if (match) {
        const num = Number(match[1]);
        if (!Number.isNaN(num)) {
          maxCycle = Math.max(maxCycle, num);
        }
      }
    }
    return maxCycle + 1;
  }

  private buildReviewPrompt(cycle: number): string {
    return (
      `Start code review cycle ${cycle}. Review the current implementation and plan.\n\n` +
      `Create a user story titled "Code Review Cycle ${cycle}" and add tasks for each review item to fix. ` +
      `If there are no issues, respond with "No review artifacts found" and do NOT create any user stories or tasks.`
    );
  }

  private async startReviewCycle(
    stream?: vscode.ChatResponseStream,
  ): Promise<void> {
    const reviewState = this.getReviewState();
    if (reviewState.inProgress) {
      if (stream) {
        stream.markdown("⚠️ A code review cycle is already in progress.\n");
      }
      return;
    }

    const cycle = this.getNextReviewCycleNumber();
    await this.setReviewState({ inProgress: true, halted: false, cycle });

    if (stream) {
      stream.markdown(`🔍 Starting code review cycle ${cycle}...\n\n`);
    }

    await vscode.commands.executeCommand("workbench.action.chat.open", {
      query: `@orchestrator ${this.buildReviewPrompt(cycle)}`,
    });
  }

  private async maybeStartReviewCycle(
    stream?: vscode.ChatResponseStream,
  ): Promise<void> {
    if (!this.isPlanComplete()) return;

    const reviewState = this.getReviewState();
    const plan = this.planManager.getPlan();

    if (reviewState.inProgress) return;

    if (
      reviewState.halted &&
      plan.updatedAt <= reviewState.haltedPlanUpdatedAt
    ) {
      return;
    }

    await this.startReviewCycle(stream);
  }

  private async executeTasksForStory(
    storyId: string,
    stream: vscode.ChatResponseStream,
  ): Promise<void> {
    const story = this.planManager.getUserStory(storyId);
    if (!story) return;

    const tasks = this.planManager
      .getTasks(storyId)
      .filter((task) => task.status === "not-started");

    if (tasks.length === 0) return;

    stream.markdown(`\n### 🚀 Executing ${story.title}\n\n`);

    for (const task of tasks) {
      const agent = task.assignedAgent || "orchestrator";
      await this.planManager.updateTask(task.id, { status: "in-progress" });

      const taskPrompt = this.buildTaskPrompt(task, story);

      await this.messageBus.sendMessage(
        "orchestrator",
        agent,
        "handoff",
        taskPrompt,
        {
          taskId: task.id,
          userStoryId: story.id,
          taskTitle: task.title,
          storyTitle: story.title,
          priority: task.priority,
        },
      );

      try {
        await vscode.commands.executeCommand("workbench.action.chat.open", {
          query: `@${agent} ${taskPrompt}`,
        });
        stream.markdown(`✅ Chat launched for @${agent} - ${task.title}\n`);
        await new Promise((resolve) => setTimeout(resolve, 400));
      } catch (error) {
        stream.markdown(
          `⚠️ Could not launch chat for ${task.title}: ${error instanceof Error ? error.message : "Unknown error"}\n`,
        );
      }
    }
  }

  private showHelp(stream: vscode.ChatResponseStream): vscode.ChatResult {
    stream.markdown("## 🎯 Orchestrator\n\n");
    stream.markdown(
      "I can help you coordinate your project. Here are some things I can do:\n\n",
    );
    stream.markdown("- `/plan` - View your project plan\n");
    stream.markdown("- `/delegate` - Delegate tasks to other agents\n");
    stream.markdown("- `/status` - Get status overview\n\n");
    stream.markdown(
      "- `/execute` - Start delegating tasks to agents after approval\n\n",
    );
    stream.markdown("- `/review` - Start a code review cycle\n\n");

    stream.markdown("**Examples:**\n");
    stream.markdown(
      '- "Create a plan for a web app with authentication and dashboard"\n',
    );
    stream.markdown('- "Add a user story for payment processing"\n');
    stream.markdown(
      '- "Add tasks to story-1 for database setup and API design"\n',
    );
    stream.markdown('- "Mark story-1 as in-progress"\n');
    stream.markdown('- "Approve the plan"\n');
    stream.markdown('- "Execute the plan"\n');
    stream.markdown('- "Start a code review"\n');

    return { metadata: { command: "help" } };
  }

  private async handlePlanCommand(
    request: vscode.ChatRequest,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
  ): Promise<vscode.ChatResult> {
    stream.markdown("## 📋 Project Plan\n\n");

    const userStories = this.planManager.getUserStories();

    if (userStories.length === 0) {
      stream.markdown("No user stories defined yet.\n\n");
      stream.markdown("**Ask me to create a plan**, for example:\n");
      stream.markdown('- "Create a plan for building a web application"\n');
      stream.markdown(
        '- "Add user stories for authentication, dashboard, and settings"\n',
      );
    } else {
      for (const story of userStories) {
        const statusEmoji = this.getStatusEmoji(story.status);
        const points = story.storyPoints ? ` (${story.storyPoints} pts)` : "";
        stream.markdown(`### ${statusEmoji} ${story.title}${points}\n`);
        stream.markdown(`*ID: ${story.id}*\n`);

        if (story.description) {
          stream.markdown(`${story.description}\n\n`);
        }

        const tasks = this.planManager.getTasks(story.id);
        if (tasks.length > 0) {
          stream.markdown("**Tasks:**\n");
          for (const task of tasks) {
            const taskEmoji = this.getStatusEmoji(task.status);
            const priorityBadge = task.priority ? ` [${task.priority}]` : "";
            stream.markdown(
              `- ${taskEmoji} ${task.title}${priorityBadge} *(${task.id})*\n`,
            );
          }
        } else {
          stream.markdown("*No tasks defined*\n");
        }
        stream.markdown("\n");
      }
    }

    stream.button({
      command: "copilot-orchestration.openPlanUI",
      title: "Open Plan UI",
    });

    return { metadata: { command: "plan" } };
  }

  private async handleDelegateCommand(
    request: vscode.ChatRequest,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
  ): Promise<vscode.ChatResult> {
    stream.markdown("## 🔄 Delegating Task\n\n");

    const prompt = request.prompt;

    if (prompt.toLowerCase().includes("requirements")) {
      stream.markdown("Delegating to **Requirements Builder** agent...\n\n");

      await this.messageBus.handoffToAgent(
        "orchestrator",
        "requirements",
        prompt,
        { type: "delegation", originalRequest: prompt },
      );

      stream.markdown("✅ Task delegated successfully.\n\n");
      stream.markdown(
        "Use `@requirements` to interact with the Requirements Builder.\n",
      );
    } else {
      stream.markdown("Please specify which agent to delegate to:\n\n");
      stream.markdown("- `@orchestrator /delegate to requirements: <task>`\n");
    }

    return { metadata: { command: "delegate" } };
  }

  private async handleStatusCommand(
    request: vscode.ChatRequest,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
  ): Promise<vscode.ChatResult> {
    stream.markdown("## 📊 Status Overview\n\n");

    const summary = this.planManager.getPlanSummary();

    stream.markdown("### Plan Status\n\n");
    stream.markdown(`- **Total User Stories:** ${summary.totalUserStories}\n`);
    stream.markdown(`- **Total Tasks:** ${summary.totalTasks}\n\n`);

    stream.markdown("**User Stories by Status:**\n");
    stream.markdown(
      `- 🔵 Not Started: ${summary.userStoriesByStatus["not-started"]}\n`,
    );
    stream.markdown(
      `- 🟡 In Progress: ${summary.userStoriesByStatus["in-progress"]}\n`,
    );
    stream.markdown(
      `- 🔴 Blocked: ${summary.userStoriesByStatus["blocked"]}\n`,
    );
    stream.markdown(
      `- 🟢 Completed: ${summary.userStoriesByStatus["completed"]}\n\n`,
    );

    stream.markdown("**Tasks by Status:**\n");
    stream.markdown(
      `- 🔵 Not Started: ${summary.tasksByStatus["not-started"]}\n`,
    );
    stream.markdown(
      `- 🟡 In Progress: ${summary.tasksByStatus["in-progress"]}\n`,
    );
    stream.markdown(`- 🔴 Blocked: ${summary.tasksByStatus["blocked"]}\n`);
    stream.markdown(
      `- 🟢 Completed: ${summary.tasksByStatus["completed"]}\n\n`,
    );

    const agents = this.messageBus.getAllAgents();
    const queueStats = this.messageBus.getQueueStats();

    stream.markdown("### Agent Status\n\n");
    for (const agent of agents) {
      const stats = queueStats[agent.id] || { total: 0, unprocessed: 0 };
      const activeEmoji = agent.isActive ? "🟢" : "⚪";
      stream.markdown(
        `- ${activeEmoji} **${agent.fullName}**: ${stats.unprocessed} pending messages\n`,
      );
    }

    await this.maybeStartReviewCycle(stream);

    return { metadata: { command: "status" } };
  }

  private async handleReviewCommand(
    request: vscode.ChatRequest,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
  ): Promise<vscode.ChatResult> {
    stream.markdown("## 🔍 Code Review Cycle\n\n");

    if (!this.isPlanComplete()) {
      stream.markdown(
        "⚠️ The plan is not complete yet. Finish all tasks before starting code review.\n",
      );
      return { metadata: { command: "review" } };
    }

    await this.startReviewCycle(stream);

    return { metadata: { command: "review" } };
  }

  private async handleExecuteCommand(
    request: vscode.ChatRequest,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
  ): Promise<vscode.ChatResult> {
    stream.markdown("## 🚀 Executing Plan\n\n");

    const userStories = this.planManager.getUserStories();

    if (userStories.length === 0) {
      stream.markdown(
        "⚠️ No plan exists. Create a plan first before executing.\n",
      );
      return { metadata: { command: "execute" } };
    }

    // Get all tasks across all user stories
    const allTasks: Array<{ task: any; story: any }> = [];
    for (const story of userStories) {
      const tasks = this.planManager.getTasks(story.id);
      for (const task of tasks) {
        if (task.status === "not-started") {
          allTasks.push({ task, story });
        }
      }
    }

    if (allTasks.length === 0) {
      stream.markdown("✅ All tasks are already in progress or completed.\n");
      return { metadata: { command: "execute" } };
    }

    stream.markdown(`Found **${allTasks.length} tasks** to delegate.\n\n`);
    stream.markdown("### Launching Agent Workflows\n\n");

    // Process each task and launch chat windows
    for (const { task, story } of allTasks) {
      const agent = task.assignedAgent || "orchestrator";

      // Update task status to in-progress
      await this.planManager.updateTask(task.id, { status: "in-progress" });

      // Build the task prompt
      const taskPrompt = this.buildTaskPrompt(task, story);

      stream.markdown(`#### 🔧 ${task.title}\n`);
      stream.markdown(`*User Story: ${story.title}*\n`);
      stream.markdown(`*Assigned to: @${agent}*\n\n`);

      // Send message to the agent via message bus
      await this.messageBus.sendMessage(
        "orchestrator",
        agent,
        "handoff",
        taskPrompt,
        {
          taskId: task.id,
          userStoryId: story.id,
          taskTitle: task.title,
          storyTitle: story.title,
          priority: task.priority,
        },
      );

      // Launch a chat window for the agent
      try {
        await vscode.commands.executeCommand("workbench.action.chat.open", {
          query: `@${agent} ${taskPrompt}`,
        });
        stream.markdown(`✅ Chat launched for @${agent}\n\n`);

        // Small delay to prevent overwhelming the UI
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        stream.markdown(
          `⚠️ Could not launch chat: ${error instanceof Error ? error.message : "Unknown error"}\n\n`,
        );
      }
    }

    stream.markdown("---\n\n");
    stream.markdown("### 📊 Execution Summary\n\n");
    stream.markdown(`- **${allTasks.length}** tasks delegated to agents\n`);
    stream.markdown(`- All tasks marked as **in-progress**\n`);
    stream.markdown(`- Chat windows opened for each agent\n\n`);
    stream.markdown("Use `/status` to monitor progress.\n");

    stream.button({
      command: "copilot-orchestration.openPlanUI",
      title: "📋 Open Plan UI",
    });

    return { metadata: { command: "execute" } };
  }

  private buildTaskPrompt(task: any, story: any): string {
    let prompt = `## Task Assignment\n\n`;
    prompt += `**Task:** ${task.title}\n`;
    prompt += `**User Story:** ${story.title}\n`;

    if (task.description) {
      prompt += `**Description:** ${task.description}\n`;
    }

    if (task.priority) {
      prompt += `**Priority:** ${task.priority}\n`;
    }

    if (story.acceptanceCriteria && story.acceptanceCriteria.length > 0) {
      prompt += `\n**Acceptance Criteria:**\n`;
      for (const criteria of story.acceptanceCriteria) {
        prompt += `- ${criteria}\n`;
      }
    }

    prompt += `\n**Instructions:** Please complete this task. When done, report back with your results.`;

    return prompt;
  }

  private getStatusEmoji(status: string): string {
    switch (status) {
      case "not-started":
        return "🔵";
      case "in-progress":
        return "🟡";
      case "blocked":
        return "🔴";
      case "completed":
        return "🟢";
      default:
        return "⚪";
    }
  }
}
