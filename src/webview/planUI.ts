/**
 * Plan UI Webview Provider - Displays user stories and tasks in a swim lane board
 */

import * as vscode from 'vscode';
import { PlanManager } from '../planManager';
import { Plan, UserStory, Task, TaskStatus, WebviewMessage } from '../types';

export class PlanUIProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'copilot-orchestration.planView';
    private _view?: vscode.WebviewView;
    private planManager: PlanManager;

    constructor(
        private readonly context: vscode.ExtensionContext,
        planManager: PlanManager
    ) {
        this.planManager = planManager;

        // Listen for plan changes
        this.planManager.onPlanChanged(() => {
            this.refresh();
        });
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken
    ): void | Thenable<void> {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri]
        };

        webviewView.webview.html = this.getHtmlContent(webviewView.webview);

        // Handle messages from webview
        webviewView.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
            await this.handleMessage(message);
        });
    }

    private async handleMessage(message: WebviewMessage): Promise<void> {
        switch (message.type) {
            case 'requestPlan':
                this.sendPlanToWebview();
                break;
            case 'updateUserStory':
                await this.handleUpdateUserStory(message.payload as Partial<UserStory> & { id: string });
                break;
            case 'updateTask':
                const taskData = message.payload as Partial<Task> & { id: string; userStoryId?: string };
                if (taskData.userStoryId) {
                    await this.handleUpdateTask(taskData as Partial<Task> & { id: string; userStoryId: string });
                } else {
                    const existingTask = this.planManager.getTask(taskData.id);
                    if (existingTask) {
                        await this.planManager.updateTask(taskData.id, taskData);
                    }
                }
                break;
            case 'deleteUserStory':
                await this.planManager.deleteUserStory((message.payload as { id: string }).id);
                break;
            case 'deleteTask':
                await this.planManager.deleteTask((message.payload as { id: string }).id);
                break;
            case 'moveTask':
                const { taskId, newUserStoryId, newStatus } = message.payload as { taskId: string; newUserStoryId?: string; newStatus?: TaskStatus };
                if (newUserStoryId) {
                    await this.planManager.moveTask(taskId, newUserStoryId);
                }
                if (newStatus) {
                    await this.planManager.updateTask(taskId, { status: newStatus });
                }
                break;
        }
    }

    private async handleUpdateUserStory(data: Partial<UserStory> & { id: string }): Promise<void> {
        const existing = this.planManager.getUserStory(data.id);
        if (existing) {
            await this.planManager.updateUserStory(data.id, data);
        } else {
            await this.planManager.createUserStory({
                id: data.id,
                title: data.title || 'New User Story',
                status: data.status || 'not-started',
                description: data.description,
                assignedAgent: data.assignedAgent,
                acceptanceCriteria: data.acceptanceCriteria,
                storyPoints: data.storyPoints
            });
        }
    }

    private async handleUpdateTask(data: Partial<Task> & { id: string; userStoryId: string }): Promise<void> {
        const existing = this.planManager.getTask(data.id);
        if (existing) {
            await this.planManager.updateTask(data.id, data);
        } else {
            await this.planManager.createTask({
                id: data.id,
                userStoryId: data.userStoryId,
                title: data.title || 'New Task',
                status: data.status || 'not-started',
                description: data.description,
                assignedAgent: data.assignedAgent,
                priority: data.priority
            });
        }
    }

    public refresh(): void {
        if (this._view) {
            this.sendPlanToWebview();
        }
    }

    private sendPlanToWebview(): void {
        if (this._view) {
            const plan = this.planManager.getPlan();
            this._view.webview.postMessage({
                type: 'planUpdated',
                payload: plan
            });
        }
    }

    public getHtmlContent(webview: vscode.Webview): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline';">
    <title>Plan UI</title>
    <style>
        :root {
            --status-not-started: #3794ff;
            --status-in-progress: #cca700;
            --status-blocked: #f14c4c;
            --status-completed: #89d185;
            --bg-primary: var(--vscode-editor-background);
            --bg-secondary: var(--vscode-sideBar-background);
            --border-color: var(--vscode-panel-border);
            --text-primary: var(--vscode-foreground);
            --text-secondary: var(--vscode-descriptionForeground);
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--text-primary);
            background: var(--bg-primary);
            padding: 8px;
            overflow-x: auto;
        }

        .board-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--border-color);
        }

        .board-title {
            font-size: 14px;
            font-weight: 600;
        }

        .board-actions button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 4px 8px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
            margin-left: 4px;
        }

        .board-actions button:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .swim-lanes {
            display: flex;
            gap: 12px;
            min-height: 300px;
        }

        .swim-lane {
            flex: 1;
            min-width: 200px;
            max-width: 300px;
            background: var(--bg-secondary);
            border-radius: 6px;
            padding: 8px;
            display: flex;
            flex-direction: column;
        }

        .swim-lane-header {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px;
            margin-bottom: 8px;
            border-radius: 4px;
            font-weight: 600;
            font-size: 12px;
        }

        .swim-lane.not-started .swim-lane-header { background: rgba(55, 148, 255, 0.15); border-left: 3px solid var(--status-not-started); }
        .swim-lane.in-progress .swim-lane-header { background: rgba(204, 167, 0, 0.15); border-left: 3px solid var(--status-in-progress); }
        .swim-lane.blocked .swim-lane-header { background: rgba(241, 76, 76, 0.15); border-left: 3px solid var(--status-blocked); }
        .swim-lane.completed .swim-lane-header { background: rgba(137, 209, 133, 0.15); border-left: 3px solid var(--status-completed); }

        .swim-lane-count {
            background: var(--border-color);
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 10px;
            margin-left: auto;
        }

        .cards-container {
            flex: 1;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 8px;
            min-height: 100px;
        }

        .cards-container.drag-over {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 4px;
        }

        .story-card {
            background: var(--vscode-editor-background);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            padding: 10px;
            cursor: grab;
        }

        .story-card:hover {
            border-color: var(--vscode-focusBorder);
        }

        .story-card.dragging {
            opacity: 0.5;
            cursor: grabbing;
        }

        .story-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 6px;
        }

        .story-title {
            font-weight: 600;
            font-size: 12px;
            flex: 1;
        }

        .story-points {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 10px;
            margin-left: 6px;
        }

        .story-description {
            font-size: 11px;
            color: var(--text-secondary);
            margin-bottom: 8px;
        }

        .story-meta {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
            margin-bottom: 8px;
        }

        .story-tasks {
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid var(--border-color);
        }

        .tasks-header {
            font-size: 10px;
            color: var(--text-secondary);
            margin-bottom: 6px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .task-item {
            display: flex;
            align-items: flex-start;
            gap: 6px;
            padding: 6px;
            margin: 4px 0;
            border-radius: 3px;
            font-size: 11px;
            background: rgba(255, 255, 255, 0.03);
            border-left: 2px solid transparent;
        }

        .task-item:hover {
            background: rgba(255, 255, 255, 0.08);
        }

        .task-item.not-started { border-left-color: var(--status-not-started); }
        .task-item.in-progress { border-left-color: var(--status-in-progress); }
        .task-item.blocked { border-left-color: var(--status-blocked); }
        .task-item.completed { border-left-color: var(--status-completed); }

        .task-checkbox {
            width: 14px;
            height: 14px;
            cursor: pointer;
            margin-top: 1px;
        }

        .task-content {
            flex: 1;
        }

        .task-title {
            display: block;
        }

        .task-title.completed {
            text-decoration: line-through;
            color: var(--text-secondary);
        }

        .priority-badge {
            font-size: 9px;
            padding: 1px 4px;
            border-radius: 3px;
            text-transform: uppercase;
        }

        .priority-badge.critical { background: rgba(241, 76, 76, 0.3); color: #f14c4c; }
        .priority-badge.high { background: rgba(255, 167, 38, 0.3); color: #ffa726; }
        .priority-badge.medium { background: rgba(204, 167, 0, 0.3); color: #cca700; }
        .priority-badge.low { background: rgba(137, 209, 133, 0.3); color: #89d185; }

        .agent-badge {
            font-size: 9px;
            padding: 1px 4px;
            border-radius: 3px;
            background: rgba(55, 148, 255, 0.2);
            color: var(--status-not-started);
        }

        .empty-state {
            text-align: center;
            padding: 20px;
            color: var(--text-secondary);
            font-size: 11px;
        }

        .add-btn {
            width: 100%;
            padding: 6px;
            margin-top: 8px;
            background: transparent;
            border: 1px dashed var(--border-color);
            border-radius: 4px;
            color: var(--text-secondary);
            cursor: pointer;
            font-size: 11px;
        }

        .add-btn:hover {
            border-color: var(--vscode-focusBorder);
            color: var(--text-primary);
        }

        .delete-btn {
            background: transparent;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            padding: 2px 4px;
            font-size: 12px;
            opacity: 0;
            transition: opacity 0.2s;
        }

        .story-card:hover .delete-btn,
        .task-item:hover .delete-btn {
            opacity: 1;
        }

        .delete-btn:hover {
            color: var(--status-blocked);
        }

        .acceptance-criteria {
            font-size: 10px;
            color: var(--text-secondary);
            margin-top: 6px;
        }

        .acceptance-criteria ul {
            margin: 4px 0 0 16px;
            padding: 0;
        }

        .acceptance-criteria li {
            margin: 2px 0;
        }
    </style>
</head>
<body>
    <div class="board-header">
        <span class="board-title">📋 Project Plan</span>
        <div class="board-actions">
            <button onclick="addUserStory()">+ User Story</button>
            <button onclick="refreshPlan()">↻ Refresh</button>
        </div>
    </div>

    <div class="swim-lanes" id="swimLanes">
        <!-- Swim lanes will be rendered here -->
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let currentPlan = null;
        const statuses = ['not-started', 'in-progress', 'blocked', 'completed'];
        const statusLabels = {
            'not-started': '🔵 Not Started',
            'in-progress': '🟡 In Progress',
            'blocked': '🔴 Blocked',
            'completed': '🟢 Completed'
        };

        // Request initial plan data
        vscode.postMessage({ type: 'requestPlan' });

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'planUpdated') {
                currentPlan = message.payload;
                renderBoard();
            }
        });

        function renderBoard() {
            const container = document.getElementById('swimLanes');
            container.innerHTML = '';

            statuses.forEach(status => {
                const lane = createSwimLane(status);
                container.appendChild(lane);
            });
        }

        function createSwimLane(status) {
            const stories = currentPlan?.userStories?.filter(s => s.status === status) || [];
            const taskCount = stories.reduce((sum, s) => {
                const tasks = currentPlan?.tasks?.filter(t => t.userStoryId === s.id) || [];
                return sum + tasks.length;
            }, 0);

            const lane = document.createElement('div');
            lane.className = \`swim-lane \${status}\`;
            lane.dataset.status = status;

            lane.innerHTML = \`
                <div class="swim-lane-header">
                    \${statusLabels[status]}
                    <span class="swim-lane-count">\${stories.length} stories</span>
                </div>
                <div class="cards-container" data-status="\${status}">
                    \${stories.length === 0 ? '<div class="empty-state">No user stories</div>' : ''}
                    \${stories.map(story => createStoryCard(story)).join('')}
                </div>
                <button class="add-btn" onclick="addUserStoryToStatus('\${status}')">+ Add User Story</button>
            \`;

            // Setup drag and drop
            const cardsContainer = lane.querySelector('.cards-container');
            cardsContainer.addEventListener('dragover', handleDragOver);
            cardsContainer.addEventListener('drop', handleDrop);
            cardsContainer.addEventListener('dragleave', handleDragLeave);

            return lane;
        }

        function createStoryCard(story) {
            const tasks = currentPlan?.tasks?.filter(t => t.userStoryId === story.id) || [];
            const completedTasks = tasks.filter(t => t.status === 'completed').length;
            
            return \`
                <div class="story-card" draggable="true" data-story-id="\${story.id}"
                     ondragstart="handleDragStart(event)" ondragend="handleDragEnd(event)">
                    <div class="story-header">
                        <span class="story-title">\${escapeHtml(story.title)}</span>
                        \${story.storyPoints ? \`<span class="story-points">\${story.storyPoints} pts</span>\` : ''}
                        <button class="delete-btn" onclick="deleteUserStory('\${story.id}')" title="Delete User Story">×</button>
                    </div>
                    \${story.description ? \`<div class="story-description">\${escapeHtml(story.description)}</div>\` : ''}
                    <div class="story-meta">
                        \${story.assignedAgent ? \`<span class="agent-badge">@\${story.assignedAgent}</span>\` : ''}
                    </div>
                    \${story.acceptanceCriteria && story.acceptanceCriteria.length > 0 ? \`
                        <div class="acceptance-criteria">
                            <strong>Acceptance Criteria:</strong>
                            <ul>
                                \${story.acceptanceCriteria.map(ac => \`<li>\${escapeHtml(ac)}</li>\`).join('')}
                            </ul>
                        </div>
                    \` : ''}
                    <div class="story-tasks">
                        <div class="tasks-header">Tasks (\${completedTasks}/\${tasks.length})</div>
                        \${tasks.map(task => createTaskItem(task)).join('')}
                        <button class="add-btn" onclick="addTask('\${story.id}')">+ Add Task</button>
                    </div>
                </div>
            \`;
        }

        function createTaskItem(task) {
            const isCompleted = task.status === 'completed';
            return \`
                <div class="task-item \${task.status}" data-task-id="\${task.id}">
                    <input type="checkbox" class="task-checkbox" 
                           \${isCompleted ? 'checked' : ''} 
                           onchange="toggleTaskComplete('\${task.id}', this.checked)">
                    <div class="task-content">
                        <span class="task-title \${isCompleted ? 'completed' : ''}">\${escapeHtml(task.title)}</span>
                    </div>
                    \${task.priority ? \`<span class="priority-badge \${task.priority}">\${task.priority}</span>\` : ''}
                    <button class="delete-btn" onclick="deleteTask('\${task.id}')" title="Delete Task">×</button>
                </div>
            \`;
        }

        // Drag and drop handlers
        function handleDragStart(e) {
            e.target.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', e.target.dataset.storyId);
        }

        function handleDragEnd(e) {
            e.target.classList.remove('dragging');
            document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        }

        function handleDragOver(e) {
            e.preventDefault();
            e.currentTarget.classList.add('drag-over');
        }

        function handleDragLeave(e) {
            e.currentTarget.classList.remove('drag-over');
        }

        function handleDrop(e) {
            e.preventDefault();
            e.currentTarget.classList.remove('drag-over');
            
            const storyId = e.dataTransfer.getData('text/plain');
            const newStatus = e.currentTarget.dataset.status;
            
            if (storyId && newStatus) {
                vscode.postMessage({
                    type: 'updateUserStory',
                    payload: { id: storyId, status: newStatus }
                });
            }
        }

        // Action handlers
        function addUserStory() {
            const title = prompt('Enter user story title:');
            if (title) {
                const id = 'story-' + Date.now();
                vscode.postMessage({
                    type: 'updateUserStory',
                    payload: { id, title, status: 'not-started' }
                });
            }
        }

        function addUserStoryToStatus(status) {
            const title = prompt('Enter user story title:');
            if (title) {
                const id = 'story-' + Date.now();
                vscode.postMessage({
                    type: 'updateUserStory',
                    payload: { id, title, status }
                });
            }
        }

        function addTask(userStoryId) {
            const title = prompt('Enter task title:');
            if (title) {
                const id = 'task-' + Date.now();
                vscode.postMessage({
                    type: 'updateTask',
                    payload: { id, userStoryId, title, status: 'not-started' }
                });
            }
        }

        function deleteUserStory(storyId) {
            if (confirm('Delete this user story and all its tasks?')) {
                vscode.postMessage({
                    type: 'deleteUserStory',
                    payload: { id: storyId }
                });
            }
        }

        function deleteTask(taskId) {
            vscode.postMessage({
                type: 'deleteTask',
                payload: { id: taskId }
            });
        }

        function toggleTaskComplete(taskId, isCompleted) {
            vscode.postMessage({
                type: 'updateTask',
                payload: { 
                    id: taskId, 
                    status: isCompleted ? 'completed' : 'not-started'
                }
            });
        }

        function refreshPlan() {
            vscode.postMessage({ type: 'requestPlan' });
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    </script>
</body>
</html>`;
    }
}

/**
 * Opens the Plan UI in a full webview panel
 */
export class PlanUIPanel {
    public static currentPanel: PlanUIPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private readonly context: vscode.ExtensionContext;
    private readonly planManager: PlanManager;
    private disposables: vscode.Disposable[] = [];

    public static createOrShow(context: vscode.ExtensionContext, planManager: PlanManager): void {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (PlanUIPanel.currentPanel) {
            PlanUIPanel.currentPanel.panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'copilotOrchestrationPlan',
            'Project Plan',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [context.extensionUri]
            }
        );

        PlanUIPanel.currentPanel = new PlanUIPanel(panel, context, planManager);
    }

    private constructor(
        panel: vscode.WebviewPanel,
        context: vscode.ExtensionContext,
        planManager: PlanManager
    ) {
        this.panel = panel;
        this.context = context;
        this.planManager = planManager;

        this.update();

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        this.panel.webview.onDidReceiveMessage(
            async (message: WebviewMessage) => {
                await this.handleMessage(message);
            },
            null,
            this.disposables
        );

        // Listen for plan changes
        this.planManager.onPlanChanged(() => {
            this.sendPlanToWebview();
        });
    }

    private async handleMessage(message: WebviewMessage): Promise<void> {
        switch (message.type) {
            case 'requestPlan':
                this.sendPlanToWebview();
                break;
            case 'updateUserStory':
                await this.handleUpdateUserStory(message.payload as Partial<UserStory> & { id: string });
                break;
            case 'updateTask':
                await this.handleUpdateTask(message.payload as Partial<Task> & { id: string; userStoryId: string });
                break;
            case 'deleteUserStory':
                await this.planManager.deleteUserStory((message.payload as { id: string }).id);
                break;
            case 'deleteTask':
                await this.planManager.deleteTask((message.payload as { id: string }).id);
                break;
        }
    }

    private async handleUpdateUserStory(data: Partial<UserStory> & { id: string }): Promise<void> {
        const existing = this.planManager.getUserStory(data.id);
        if (existing) {
            await this.planManager.updateUserStory(data.id, data);
        } else {
            await this.planManager.createUserStory({
                id: data.id,
                title: data.title || 'New User Story',
                status: data.status || 'not-started',
                description: data.description,
                assignedAgent: data.assignedAgent
            });
        }
    }

    private async handleUpdateTask(data: Partial<Task> & { id: string; userStoryId: string }): Promise<void> {
        const existing = this.planManager.getTask(data.id);
        if (existing) {
            await this.planManager.updateTask(data.id, data);
        } else if (data.userStoryId) {
            await this.planManager.createTask({
                id: data.id,
                userStoryId: data.userStoryId,
                title: data.title || 'New Task',
                status: data.status || 'not-started',
                description: data.description,
                assignedAgent: data.assignedAgent,
                priority: data.priority
            });
        }
    }

    private sendPlanToWebview(): void {
        const plan = this.planManager.getPlan();
        this.panel.webview.postMessage({
            type: 'planUpdated',
            payload: plan
        });
    }

    private update(): void {
        const provider = new PlanUIProvider(this.context, this.planManager);
        this.panel.webview.html = provider.getHtmlContent(this.panel.webview);
        this.sendPlanToWebview();
    }

    public dispose(): void {
        PlanUIPanel.currentPanel = undefined;
        this.panel.dispose();
        while (this.disposables.length) {
            const d = this.disposables.pop();
            if (d) {
                d.dispose();
            }
        }
    }
}
