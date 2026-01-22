/**
 * Data structures for the orchestration system
 */

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  assignedAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  DONE = 'done',
  BLOCKED = 'blocked'
}

export interface Phase {
  id: string;
  title: string;
  description: string;
  tasks: Task[];
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Plan {
  id: string;
  title: string;
  description: string;
  phases: Phase[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentMessage {
  from: string;
  to: string;
  type: MessageType;
  payload: any;
  timestamp: Date;
}

export enum MessageType {
  REQUEST = 'request',
  RESPONSE = 'response',
  NOTIFICATION = 'notification',
  UPDATE = 'update'
}

export interface ChatWindowOptions {
  agent?: string;
  model?: string;
  prompt?: string;
  context?: any;
}
