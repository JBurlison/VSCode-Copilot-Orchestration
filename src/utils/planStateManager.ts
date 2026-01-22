import * as vscode from 'vscode';
import { Plan, Phase, Task, TaskStatus } from '../types';

/**
 * State manager for plans, phases, and tasks
 */
export class PlanStateManager {
  private static instance: PlanStateManager;
  private plans: Map<string, Plan> = new Map();
  private currentPlanId: string | null = null;
  private changeEmitter = new vscode.EventEmitter<Plan>();
  public readonly onPlanChanged = this.changeEmitter.event;

  private constructor() {}

  static getInstance(): PlanStateManager {
    if (!PlanStateManager.instance) {
      PlanStateManager.instance = new PlanStateManager();
    }
    return PlanStateManager.instance;
  }

  /**
   * Create a new plan
   */
  createPlan(title: string, description: string): Plan {
    const plan: Plan = {
      id: this.generateId(),
      title,
      description,
      phases: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.plans.set(plan.id, plan);
    this.currentPlanId = plan.id;
    this.changeEmitter.fire(plan);
    return plan;
  }

  /**
   * Get the current plan
   */
  getCurrentPlan(): Plan | null {
    if (!this.currentPlanId) {
      return null;
    }
    return this.plans.get(this.currentPlanId) || null;
  }

  /**
   * Add a phase to a plan
   */
  addPhase(planId: string, title: string, description: string): Phase | null {
    const plan = this.plans.get(planId);
    if (!plan) {
      return null;
    }

    const phase: Phase = {
      id: this.generateId(),
      title,
      description,
      tasks: [],
      order: plan.phases.length,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    plan.phases.push(phase);
    plan.updatedAt = new Date();
    this.changeEmitter.fire(plan);
    return phase;
  }

  /**
   * Add a task to a phase
   */
  addTask(planId: string, phaseId: string, title: string, description: string): Task | null {
    const plan = this.plans.get(planId);
    if (!plan) {
      return null;
    }

    const phase = plan.phases.find(p => p.id === phaseId);
    if (!phase) {
      return null;
    }

    const task: Task = {
      id: this.generateId(),
      title,
      description,
      status: TaskStatus.TODO,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    phase.tasks.push(task);
    phase.updatedAt = new Date();
    plan.updatedAt = new Date();
    this.changeEmitter.fire(plan);
    return task;
  }

  /**
   * Update task status
   */
  updateTaskStatus(planId: string, phaseId: string, taskId: string, status: TaskStatus): boolean {
    const plan = this.plans.get(planId);
    if (!plan) {
      return false;
    }

    const phase = plan.phases.find(p => p.id === phaseId);
    if (!phase) {
      return false;
    }

    const task = phase.tasks.find(t => t.id === taskId);
    if (!task) {
      return false;
    }

    task.status = status;
    task.updatedAt = new Date();
    phase.updatedAt = new Date();
    plan.updatedAt = new Date();
    this.changeEmitter.fire(plan);
    return true;
  }

  /**
   * Update phase
   */
  updatePhase(planId: string, phaseId: string, updates: Partial<Phase>): boolean {
    const plan = this.plans.get(planId);
    if (!plan) {
      return false;
    }

    const phase = plan.phases.find(p => p.id === phaseId);
    if (!phase) {
      return false;
    }

    Object.assign(phase, updates, { updatedAt: new Date() });
    plan.updatedAt = new Date();
    this.changeEmitter.fire(plan);
    return true;
  }

  /**
   * Get all plans
   */
  getAllPlans(): Plan[] {
    return Array.from(this.plans.values());
  }

  /**
   * Get a specific plan
   */
  getPlan(planId: string): Plan | null {
    return this.plans.get(planId) || null;
  }

  /**
   * Set current plan
   */
  setCurrentPlan(planId: string): boolean {
    if (this.plans.has(planId)) {
      this.currentPlanId = planId;
      const plan = this.plans.get(planId)!;
      this.changeEmitter.fire(plan);
      return true;
    }
    return false;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
