/**
 * Type definitions for Copilot Orchestration Extension
 */

// ============================================================================
// Status Types
// ============================================================================

export type TaskStatus =
  | "not-started"
  | "in-progress"
  | "blocked"
  | "completed";
export type Priority = "low" | "medium" | "high" | "critical";
export type MessageType = "request" | "response" | "notification" | "handoff";

// ============================================================================
// Plan Types
// ============================================================================

export interface Task {
  id: string;
  userStoryId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  assignedAgent?: string;
  priority?: Priority;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  metadata?: Record<string, unknown>;
}

export interface UserStory {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  assignedAgent?: string;
  order: number;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  acceptanceCriteria?: string[];
  storyPoints?: number;
  /** IDs of user stories this story depends on (must complete before this can start) */
  dependsOn?: string[];
  metadata?: Record<string, unknown>;
}

export interface Plan {
  id: string;
  name: string;
  description?: string;
  userStories: UserStory[];
  tasks: Task[];
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// Agent Communication Types
// ============================================================================

export interface AgentMessage {
  id: string;
  sourceAgent: string;
  targetAgent: string;
  messageType: MessageType;
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
  processed: boolean;
  response?: string;
}

export interface AgentInfo {
  id: string;
  name: string;
  fullName: string;
  description: string;
  isActive: boolean;
  lastActiveAt?: number;
}

export interface AgentQueue {
  agentId: string;
  messages: AgentMessage[];
}

// ============================================================================
// Tool Input Types
// ============================================================================

export interface LaunchChatInput {
  agentId: string;
  prompt: string;
  model?: string;
}

export interface SendAgentMessageInput {
  targetAgent: string;
  messageType: MessageType;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateUserStoryInput {
  userStoryId: string;
  title: string;
  status: TaskStatus;
  description?: string;
  assignedAgent?: string;
  acceptanceCriteria?: string[];
  storyPoints?: number;
  /** IDs of user stories this story depends on */
  dependsOn?: string[];
}

export interface UpdateTaskInput {
  taskId: string;
  userStoryId: string;
  title: string;
  status: TaskStatus;
  description?: string;
  assignedAgent?: string;
  priority?: Priority;
}

export interface GetPlanStatusInput {
  includeCompleted?: boolean;
  filterByAgent?: string;
}

export interface GetAgentQueueInput {
  agentId: string;
  messageType?: MessageType | "all";
}

// ============================================================================
// Webview Message Types
// ============================================================================

export type WebviewMessageType =
  | "planUpdated"
  | "userStoryUpdated"
  | "taskUpdated"
  | "requestPlan"
  | "updateUserStory"
  | "updateTask"
  | "deleteUserStory"
  | "deleteTask"
  | "reorderUserStories"
  | "moveTask";

export interface WebviewMessage {
  type: WebviewMessageType;
  payload?: unknown;
}

export interface PlanUpdatedMessage extends WebviewMessage {
  type: "planUpdated";
  payload: Plan;
}

export interface UserStoryUpdatedMessage extends WebviewMessage {
  type: "userStoryUpdated";
  payload: UserStory;
}

export interface TaskUpdatedMessage extends WebviewMessage {
  type: "taskUpdated";
  payload: Task;
}

// ============================================================================
// Event Types
// ============================================================================

export interface PlanChangeEvent {
  plan: Plan;
  changeType: "userStory" | "task" | "full";
  changedItem?: UserStory | Task;
}

export interface AgentMessageEvent {
  message: AgentMessage;
  direction: "incoming" | "outgoing";
}
