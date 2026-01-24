/**
 * Plan Manager - Manages the project plan state with user stories and tasks
 */

import * as vscode from "vscode";
import {
  Plan,
  UserStory,
  Task,
  TaskStatus,
  Priority,
  PlanChangeEvent,
} from "./types";

export class PlanManager {
  private static instance: PlanManager;
  private plan: Plan;
  private readonly _onPlanChanged = new vscode.EventEmitter<PlanChangeEvent>();
  public readonly onPlanChanged = this._onPlanChanged.event;

  private constructor(private context: vscode.ExtensionContext) {
    // Load plan from storage or create new
    this.plan = this.loadPlan();
  }

  public static getInstance(context?: vscode.ExtensionContext): PlanManager {
    if (!PlanManager.instance) {
      if (!context) {
        throw new Error("PlanManager must be initialized with context first");
      }
      PlanManager.instance = new PlanManager(context);
    }
    return PlanManager.instance;
  }

  private loadPlan(): Plan {
    const storedPlan =
      this.context.workspaceState.get<Plan>("orchestration.plan");
    if (storedPlan) {
      return storedPlan;
    }
    return this.createNewPlan();
  }

  private createNewPlan(): Plan {
    const now = Date.now();
    return {
      id: this.generateId(),
      name: "Project Plan",
      description: "Main project plan",
      userStories: [],
      tasks: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async savePlan(): Promise<void> {
    await this.context.workspaceState.update("orchestration.plan", this.plan);
  }

  // ========================================================================
  // Plan Operations
  // ========================================================================

  public getPlan(): Plan {
    return { ...this.plan };
  }

  public async updatePlan(updates: {
    name?: string;
    description?: string;
  }): Promise<Plan> {
    if (updates.name !== undefined) {
      this.plan.name = updates.name;
    }
    if (updates.description !== undefined) {
      this.plan.description = updates.description;
    }
    this.plan.updatedAt = Date.now();
    await this.savePlan();
    this._onPlanChanged.fire({ plan: this.plan, changeType: "full" });
    return { ...this.plan };
  }

  public async resetPlan(): Promise<void> {
    this.plan = this.createNewPlan();
    await this.savePlan();
    this._onPlanChanged.fire({ plan: this.plan, changeType: "full" });
  }

  // ========================================================================
  // User Story Operations
  // ========================================================================

  public getUserStories(): UserStory[] {
    return [...this.plan.userStories].sort((a, b) => a.order - b.order);
  }

  public getUserStory(userStoryId: string): UserStory | undefined {
    return this.plan.userStories.find((s) => s.id === userStoryId);
  }

  public async createUserStory(input: {
    id?: string;
    title: string;
    description?: string;
    status: TaskStatus;
    assignedAgent?: string;
    acceptanceCriteria?: string[];
    storyPoints?: number;
    dependsOn?: string[];
  }): Promise<UserStory> {
    const now = Date.now();
    const userStory: UserStory = {
      id: input.id || this.generateId(),
      title: input.title,
      description: input.description,
      status: input.status,
      assignedAgent: input.assignedAgent,
      order: this.plan.userStories.length,
      acceptanceCriteria: input.acceptanceCriteria,
      storyPoints: input.storyPoints,
      dependsOn: input.dependsOn || [],
      createdAt: now,
      updatedAt: now,
    };

    this.plan.userStories.push(userStory);
    this.plan.updatedAt = now;
    await this.savePlan();
    this._onPlanChanged.fire({
      plan: this.plan,
      changeType: "userStory",
      changedItem: userStory,
    });
    return userStory;
  }

  public async updateUserStory(
    userStoryId: string,
    updates: Partial<Omit<UserStory, "id" | "createdAt">>,
  ): Promise<UserStory | undefined> {
    const storyIndex = this.plan.userStories.findIndex(
      (s) => s.id === userStoryId,
    );
    if (storyIndex === -1) {
      return undefined;
    }

    const now = Date.now();
    const story = this.plan.userStories[storyIndex];
    const updatedStory: UserStory = {
      ...story,
      ...updates,
      id: story.id,
      createdAt: story.createdAt,
      updatedAt: now,
      completedAt:
        updates.status === "completed" && story.status !== "completed"
          ? now
          : story.completedAt,
    };

    this.plan.userStories[storyIndex] = updatedStory;
    this.plan.updatedAt = now;
    await this.savePlan();
    this._onPlanChanged.fire({
      plan: this.plan,
      changeType: "userStory",
      changedItem: updatedStory,
    });
    return updatedStory;
  }

  public async deleteUserStory(userStoryId: string): Promise<boolean> {
    const storyIndex = this.plan.userStories.findIndex(
      (s) => s.id === userStoryId,
    );
    if (storyIndex === -1) {
      return false;
    }

    // Also delete all tasks in this user story
    this.plan.tasks = this.plan.tasks.filter(
      (t) => t.userStoryId !== userStoryId,
    );
    this.plan.userStories.splice(storyIndex, 1);

    // Reorder remaining user stories
    this.plan.userStories.forEach((s, index) => {
      s.order = index;
    });

    this.plan.updatedAt = Date.now();
    await this.savePlan();
    this._onPlanChanged.fire({ plan: this.plan, changeType: "full" });
    return true;
  }

  public async reorderUserStories(userStoryIds: string[]): Promise<void> {
    userStoryIds.forEach((id, index) => {
      const story = this.plan.userStories.find((s) => s.id === id);
      if (story) {
        story.order = index;
      }
    });

    this.plan.updatedAt = Date.now();
    await this.savePlan();
    this._onPlanChanged.fire({ plan: this.plan, changeType: "full" });
  }

  // ========================================================================
  // Task Operations
  // ========================================================================

  public getTasks(userStoryId?: string): Task[] {
    if (userStoryId) {
      return this.plan.tasks.filter((t) => t.userStoryId === userStoryId);
    }
    return [...this.plan.tasks];
  }

  public getTask(taskId: string): Task | undefined {
    return this.plan.tasks.find((t) => t.id === taskId);
  }

  public async createTask(input: {
    id?: string;
    userStoryId: string;
    title: string;
    description?: string;
    status: TaskStatus;
    assignedAgent?: string;
    priority?: Priority;
  }): Promise<Task> {
    // Verify user story exists
    const userStory = this.getUserStory(input.userStoryId);
    if (!userStory) {
      throw new Error(`User Story ${input.userStoryId} not found`);
    }

    const now = Date.now();
    const task: Task = {
      id: input.id || this.generateId(),
      userStoryId: input.userStoryId,
      title: input.title,
      description: input.description,
      status: input.status,
      assignedAgent: input.assignedAgent,
      priority: input.priority || "medium",
      createdAt: now,
      updatedAt: now,
    };

    this.plan.tasks.push(task);
    this.plan.updatedAt = now;
    await this.savePlan();
    this._onPlanChanged.fire({
      plan: this.plan,
      changeType: "task",
      changedItem: task,
    });
    return task;
  }

  public async updateTask(
    taskId: string,
    updates: Partial<Omit<Task, "id" | "createdAt">>,
  ): Promise<Task | undefined> {
    const taskIndex = this.plan.tasks.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) {
      return undefined;
    }

    const now = Date.now();
    const task = this.plan.tasks[taskIndex];
    const updatedTask: Task = {
      ...task,
      ...updates,
      id: task.id,
      createdAt: task.createdAt,
      updatedAt: now,
      completedAt:
        updates.status === "completed" && task.status !== "completed"
          ? now
          : task.completedAt,
    };

    this.plan.tasks[taskIndex] = updatedTask;
    this.plan.updatedAt = now;
    await this.savePlan();
    this._onPlanChanged.fire({
      plan: this.plan,
      changeType: "task",
      changedItem: updatedTask,
    });
    return updatedTask;
  }

  public async deleteTask(taskId: string): Promise<boolean> {
    const taskIndex = this.plan.tasks.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) {
      return false;
    }

    this.plan.tasks.splice(taskIndex, 1);
    this.plan.updatedAt = Date.now();
    await this.savePlan();
    this._onPlanChanged.fire({ plan: this.plan, changeType: "full" });
    return true;
  }

  public async moveTask(
    taskId: string,
    newUserStoryId: string,
  ): Promise<Task | undefined> {
    return this.updateTask(taskId, { userStoryId: newUserStoryId });
  }

  // ========================================================================
  // Status Helpers
  // ========================================================================

  public getUserStoriesByStatus(status: TaskStatus): UserStory[] {
    return this.plan.userStories.filter((s) => s.status === status);
  }

  public getTasksByStatus(status: TaskStatus): Task[] {
    return this.plan.tasks.filter((t) => t.status === status);
  }

  public getTasksByAgent(agentId: string): Task[] {
    return this.plan.tasks.filter((t) => t.assignedAgent === agentId);
  }

  public getUserStoriesByAgent(agentId: string): UserStory[] {
    return this.plan.userStories.filter((s) => s.assignedAgent === agentId);
  }

  public getPlanSummary(): {
    totalUserStories: number;
    totalTasks: number;
    userStoriesByStatus: Record<TaskStatus, number>;
    tasksByStatus: Record<TaskStatus, number>;
  } {
    const userStoriesByStatus: Record<TaskStatus, number> = {
      "not-started": 0,
      "in-progress": 0,
      blocked: 0,
      completed: 0,
    };

    const tasksByStatus: Record<TaskStatus, number> = {
      "not-started": 0,
      "in-progress": 0,
      blocked: 0,
      completed: 0,
    };

    this.plan.userStories.forEach((s) => userStoriesByStatus[s.status]++);
    this.plan.tasks.forEach((t) => tasksByStatus[t.status]++);

    return {
      totalUserStories: this.plan.userStories.length,
      totalTasks: this.plan.tasks.length,
      userStoriesByStatus,
      tasksByStatus,
    };
  }

  // ========================================================================
  // Dependency Management
  // ========================================================================

  /**
   * Check if all dependencies of a story are completed
   */
  public areDependenciesSatisfied(userStoryId: string): boolean {
    const story = this.getUserStory(userStoryId);
    if (!story || !story.dependsOn || story.dependsOn.length === 0) {
      return true;
    }

    return story.dependsOn.every((depId) => {
      const dep = this.getUserStory(depId);
      return dep && dep.status === "completed";
    });
  }

  /**
   * Get user stories that are ready to execute (not started and all dependencies satisfied)
   */
  public getReadyStories(): UserStory[] {
    return this.plan.userStories.filter(
      (story) =>
        story.status === "not-started" &&
        this.areDependenciesSatisfied(story.id),
    );
  }

  /**
   * Get user stories that are blocked by dependencies
   */
  public getBlockedByDependencies(): UserStory[] {
    return this.plan.userStories.filter(
      (story) =>
        story.status === "not-started" &&
        !this.areDependenciesSatisfied(story.id),
    );
  }

  /**
   * Get the dependency tree as an adjacency list for visualization
   */
  public getDependencyTree(): Map<
    string,
    { story: UserStory; dependsOn: UserStory[]; dependedOnBy: UserStory[] }
  > {
    const tree = new Map<
      string,
      { story: UserStory; dependsOn: UserStory[]; dependedOnBy: UserStory[] }
    >();

    // Initialize all stories
    for (const story of this.plan.userStories) {
      tree.set(story.id, {
        story,
        dependsOn: [],
        dependedOnBy: [],
      });
    }

    // Build relationships
    for (const story of this.plan.userStories) {
      if (story.dependsOn) {
        for (const depId of story.dependsOn) {
          const depNode = tree.get(depId);
          const storyNode = tree.get(story.id);
          if (depNode && storyNode) {
            storyNode.dependsOn.push(depNode.story);
            depNode.dependedOnBy.push(story);
          }
        }
      }
    }

    return tree;
  }

  /**
   * Get root stories (stories with no dependencies - entry points)
   */
  public getRootStories(): UserStory[] {
    return this.plan.userStories.filter(
      (story) => !story.dependsOn || story.dependsOn.length === 0,
    );
  }

  /**
   * Get leaf stories (stories that no other story depends on - exit points)
   */
  public getLeafStories(): UserStory[] {
    const dependedOn = new Set<string>();
    for (const story of this.plan.userStories) {
      if (story.dependsOn) {
        story.dependsOn.forEach((id) => dependedOn.add(id));
      }
    }
    return this.plan.userStories.filter((story) => !dependedOn.has(story.id));
  }

  /**
   * Validate that dependencies form a valid DAG (no cycles)
   */
  public validateDependencies(): { valid: boolean; cycles?: string[][] } {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[][] = [];

    const detectCycle = (storyId: string, path: string[]): boolean => {
      visited.add(storyId);
      recursionStack.add(storyId);

      const story = this.getUserStory(storyId);
      if (story?.dependsOn) {
        for (const depId of story.dependsOn) {
          if (!visited.has(depId)) {
            if (detectCycle(depId, [...path, depId])) {
              return true;
            }
          } else if (recursionStack.has(depId)) {
            // Found a cycle
            const cycleStart = path.indexOf(depId);
            cycles.push(path.slice(cycleStart));
            return true;
          }
        }
      }

      recursionStack.delete(storyId);
      return false;
    };

    for (const story of this.plan.userStories) {
      if (!visited.has(story.id)) {
        detectCycle(story.id, [story.id]);
      }
    }

    return cycles.length > 0 ? { valid: false, cycles } : { valid: true };
  }

  /**
   * Get stories in topological order (respecting dependencies)
   */
  public getStoriesInExecutionOrder(): UserStory[] {
    const result: UserStory[] = [];
    const visited = new Set<string>();

    const visit = (storyId: string) => {
      if (visited.has(storyId)) return;
      visited.add(storyId);

      const story = this.getUserStory(storyId);
      if (!story) return;

      // Visit dependencies first
      if (story.dependsOn) {
        for (const depId of story.dependsOn) {
          visit(depId);
        }
      }

      result.push(story);
    };

    for (const story of this.plan.userStories) {
      visit(story.id);
    }

    return result;
  }

  public dispose(): void {
    this._onPlanChanged.dispose();
  }
}
