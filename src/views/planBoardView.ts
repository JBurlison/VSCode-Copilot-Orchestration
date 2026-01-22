import * as vscode from 'vscode';
import { PlanStateManager } from '../utils/planStateManager';
import { Plan, Phase, Task, TaskStatus } from '../types';

/**
 * Webview provider for the Plan Board UI
 */
export class PlanBoardProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'copilot-orchestration.planBoard';
  private view?: vscode.WebviewView;
  private planManager: PlanStateManager;

  constructor(
    private readonly context: vscode.ExtensionContext
  ) {
    this.planManager = PlanStateManager.getInstance();
    
    // Listen for plan changes and update the view
    this.planManager.onPlanChanged(() => {
      this.updateView();
    });
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ) {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(data => {
      this.handleMessage(data);
    });

    // Initial render
    this.updateView();
  }

  private updateView() {
    if (this.view) {
      const plan = this.planManager.getCurrentPlan();
      this.view.webview.postMessage({
        type: 'updatePlan',
        plan: plan ? this.serializePlan(plan) : null
      });
    }
  }

  private handleMessage(message: any) {
    switch (message.type) {
      case 'updateTaskStatus':
        this.handleUpdateTaskStatus(message);
        break;
      case 'createPlan':
        this.handleCreatePlan(message);
        break;
      case 'addPhase':
        this.handleAddPhase(message);
        break;
      case 'addTask':
        this.handleAddTask(message);
        break;
    }
  }

  private handleUpdateTaskStatus(message: any) {
    const { planId, phaseId, taskId, status } = message;
    this.planManager.updateTaskStatus(planId, phaseId, taskId, status);
  }

  private handleCreatePlan(message: any) {
    const { title, description } = message;
    this.planManager.createPlan(title, description);
  }

  private handleAddPhase(message: any) {
    const plan = this.planManager.getCurrentPlan();
    if (plan) {
      this.planManager.addPhase(plan.id, message.title, message.description);
    }
  }

  private handleAddTask(message: any) {
    const plan = this.planManager.getCurrentPlan();
    if (plan && message.phaseId) {
      this.planManager.addTask(plan.id, message.phaseId, message.title, message.description);
    }
  }

  private serializePlan(plan: Plan): any {
    return {
      ...plan,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
      phases: plan.phases.map(phase => ({
        ...phase,
        createdAt: phase.createdAt.toISOString(),
        updatedAt: phase.updatedAt.toISOString(),
        tasks: phase.tasks.map(task => ({
          ...task,
          createdAt: task.createdAt.toISOString(),
          updatedAt: task.updatedAt.toISOString()
        }))
      }))
    };
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Plan Board</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: var(--vscode-font-family);
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            padding: 10px;
            overflow-x: auto;
        }
        
        .header {
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        .header h1 {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 5px;
        }
        
        .header p {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        
        .actions {
            margin-bottom: 15px;
            display: flex;
            gap: 10px;
        }
        
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            cursor: pointer;
            border-radius: 2px;
            font-size: 12px;
        }
        
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .board {
            display: flex;
            gap: 15px;
            min-height: 400px;
            padding-bottom: 20px;
        }
        
        .swim-lane {
            flex: 1;
            min-width: 250px;
            background-color: var(--vscode-sideBar-background);
            border-radius: 4px;
            padding: 10px;
        }
        
        .swim-lane-header {
            font-weight: 600;
            margin-bottom: 10px;
            padding-bottom: 5px;
            border-bottom: 2px solid var(--vscode-panel-border);
            font-size: 13px;
        }
        
        .swim-lane-header .count {
            float: right;
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            border-radius: 10px;
            padding: 2px 8px;
            font-size: 11px;
        }
        
        .phase-card {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 10px;
            margin-bottom: 10px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .phase-card:hover {
            border-color: var(--vscode-focusBorder);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }
        
        .phase-title {
            font-weight: 600;
            margin-bottom: 5px;
            font-size: 13px;
        }
        
        .phase-description {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 8px;
        }
        
        .task-list {
            margin-top: 8px;
        }
        
        .task-item {
            display: flex;
            align-items: center;
            padding: 5px;
            margin: 4px 0;
            background-color: var(--vscode-input-background);
            border-radius: 3px;
            font-size: 11px;
            cursor: pointer;
        }
        
        .task-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        
        .task-status {
            width: 16px;
            height: 16px;
            margin-right: 6px;
            flex-shrink: 0;
        }
        
        .task-title {
            flex: 1;
        }
        
        .task-item.todo .task-status::before {
            content: "⬜";
        }
        
        .task-item.in_progress .task-status::before {
            content: "🔄";
        }
        
        .task-item.done .task-status::before {
            content: "✅";
        }
        
        .task-item.blocked .task-status::before {
            content: "🚫";
        }
        
        .empty-state {
            text-align: center;
            padding: 40px 20px;
            color: var(--vscode-descriptionForeground);
        }
        
        .empty-state h2 {
            font-size: 16px;
            margin-bottom: 10px;
        }
        
        .empty-state p {
            font-size: 12px;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div id="app">
        <div class="empty-state">
            <h2>No Active Plan</h2>
            <p>Create a plan with the @orchestrator agent to get started</p>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let currentPlan = null;

        // Listen for messages from the extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'updatePlan':
                    currentPlan = message.plan;
                    render();
                    break;
            }
        });

        function render() {
            const app = document.getElementById('app');
            
            if (!currentPlan) {
                app.innerHTML = \`
                    <div class="empty-state">
                        <h2>No Active Plan</h2>
                        <p>Create a plan with the @orchestrator agent to get started</p>
                    </div>
                \`;
                return;
            }

            // Group tasks by status
            const tasksByStatus = {
                todo: [],
                in_progress: [],
                done: [],
                blocked: []
            };

            currentPlan.phases.forEach(phase => {
                phase.tasks.forEach(task => {
                    if (!tasksByStatus[task.status]) {
                        tasksByStatus[task.status] = [];
                    }
                    tasksByStatus[task.status].push({ ...task, phase });
                });
            });

            app.innerHTML = \`
                <div class="header">
                    <h1>\${escapeHtml(currentPlan.title)}</h1>
                    <p>\${escapeHtml(currentPlan.description)}</p>
                </div>
                
                <div class="board">
                    <div class="swim-lane">
                        <div class="swim-lane-header">
                            📋 To Do
                            <span class="count">\${tasksByStatus.todo.length}</span>
                        </div>
                        \${renderTasks(tasksByStatus.todo)}
                    </div>
                    
                    <div class="swim-lane">
                        <div class="swim-lane-header">
                            🔄 In Progress
                            <span class="count">\${tasksByStatus.in_progress.length}</span>
                        </div>
                        \${renderTasks(tasksByStatus.in_progress)}
                    </div>
                    
                    <div class="swim-lane">
                        <div class="swim-lane-header">
                            ✅ Done
                            <span class="count">\${tasksByStatus.done.length}</span>
                        </div>
                        \${renderTasks(tasksByStatus.done)}
                    </div>
                    
                    <div class="swim-lane">
                        <div class="swim-lane-header">
                            🚫 Blocked
                            <span class="count">\${tasksByStatus.blocked.length}</span>
                        </div>
                        \${renderTasks(tasksByStatus.blocked)}
                    </div>
                </div>
            \`;

            // Add event listeners
            document.querySelectorAll('.task-item').forEach(el => {
                el.addEventListener('click', () => {
                    const taskId = el.dataset.taskId;
                    const phaseId = el.dataset.phaseId;
                    const currentStatus = el.dataset.status;
                    cycleTaskStatus(phaseId, taskId, currentStatus);
                });
            });
        }

        function renderTasks(tasks) {
            if (tasks.length === 0) {
                return '<div style="padding: 10px; text-align: center; color: var(--vscode-descriptionForeground); font-size: 11px;">No tasks</div>';
            }

            // Group by phase
            const tasksByPhase = {};
            tasks.forEach(task => {
                if (!tasksByPhase[task.phase.id]) {
                    tasksByPhase[task.phase.id] = {
                        phase: task.phase,
                        tasks: []
                    };
                }
                tasksByPhase[task.phase.id].tasks.push(task);
            });

            return Object.values(tasksByPhase).map(group => \`
                <div class="phase-card">
                    <div class="phase-title">\${escapeHtml(group.phase.title)}</div>
                    <div class="task-list">
                        \${group.tasks.map(task => \`
                            <div class="task-item \${task.status}" 
                                 data-task-id="\${task.id}" 
                                 data-phase-id="\${task.phase.id}"
                                 data-status="\${task.status}">
                                <span class="task-status"></span>
                                <span class="task-title">\${escapeHtml(task.title)}</span>
                            </div>
                        \`).join('')}
                    </div>
                </div>
            \`).join('');
        }

        function cycleTaskStatus(phaseId, taskId, currentStatus) {
            const statusCycle = ['todo', 'in_progress', 'done', 'blocked'];
            const currentIndex = statusCycle.indexOf(currentStatus);
            const nextStatus = statusCycle[(currentIndex + 1) % statusCycle.length];

            vscode.postMessage({
                type: 'updateTaskStatus',
                planId: currentPlan.id,
                phaseId: phaseId,
                taskId: taskId,
                status: nextStatus
            });
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Initial render
        render();
    </script>
</body>
</html>`;
  }
}
