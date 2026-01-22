# VSCode Copilot Orchestration

Multi-agent workflows with orchestrator and plan UI for VS Code Copilot.

## Features

This VS Code extension extends the Copilot Chat UI with powerful orchestration capabilities:

### 🎯 Orchestration Agent (`@orchestrator`)
Coordinates multiple agents to accomplish complex tasks. The orchestrator can:
- Create and manage project plans
- Break down complex tasks into phases
- Delegate work to specialized agents
- Track progress across multiple workstreams

### 📝 Requirements Builder Agent (`@requirements`)
Helps gather and structure project requirements:
- Guides you through requirements gathering
- Categorizes requirements (functional, performance, security, UI/UX)
- Automatically organizes requirements into phases
- Integrates with the plan board

### 📊 Plan Board UI
Visual kanban-style board with swim lanes:
- **Swim Lanes**: Organize tasks by status (To Do, In Progress, Done, Blocked)
- **Phase Cards**: Group tasks by project phase
- **Interactive**: Click tasks to cycle through statuses
- **Real-time Updates**: Automatically syncs with agent changes

### 🔧 Tools and Utilities

#### Chat Window Launcher
- Launch new chat windows with specific agents
- Pass context between chats
- Support for model selection

#### Agent Communication Bus
- Agents can send messages to each other
- Coordinate work across multiple agents
- Share context and state

## Usage

### Getting Started

1. Open VS Code Chat (`Ctrl+Alt+I` or `Cmd+Option+I`)
2. Type `@orchestrator` or `@requirements` to interact with the agents

### Creating a Plan

```
@orchestrator create plan title: "My Project" description: "Build a new feature"
```

### Adding Phases

```
@orchestrator add phase title: "Planning" description: "Design and architecture"
@orchestrator add phase title: "Implementation" description: "Code the feature"
@orchestrator add phase title: "Testing" description: "Test and validate"
```

### Adding Tasks

```
@orchestrator add task title: "Design database schema"
@orchestrator add task title: "Implement API endpoints"
@orchestrator add task title: "Write unit tests"
```

### Viewing the Plan Board

Use the command palette (`Ctrl+Shift+P` or `Cmd+Shift+P`):
```
Copilot Orchestration: Show Plan Board
```

Or use the chat command:
```
@orchestrator status
```

### Using Requirements Builder

```
@requirements start
@requirements feature: User authentication with OAuth
@requirements constraint: Must support mobile devices
@requirements finalize
```

### Launching New Chat Windows

Use the command palette:
```
Copilot Orchestration: New Orchestrated Chat
```

Or use buttons in the chat interface.

## Agent Coordination Example

```
@orchestrator I need to build a REST API with authentication

The orchestrator will:
1. Create a plan
2. Coordinate with @requirements to gather details
3. Break down into phases and tasks
4. Track progress on the plan board
```

## Architecture

### Core Components

- **Extension Entry Point** (`src/extension.ts`): Activates agents and registers commands
- **Agents** (`src/agents/`): Orchestrator and Requirements Builder agents
- **Views** (`src/views/`): Plan Board webview UI
- **Utils** (`src/utils/`):
  - `agentCommunication.ts`: Message bus for agent-to-agent communication
  - `chatWindowLauncher.ts`: Launch new chat windows with context
  - `planStateManager.ts`: State management for plans, phases, and tasks

### Data Model

```typescript
Plan
├── phases: Phase[]
    ├── tasks: Task[]
    │   ├── status: TaskStatus (todo | in_progress | done | blocked)
    │   ├── title: string
    │   └── description: string
    └── order: number
```

## Development

### Prerequisites

- Node.js 18.x or higher
- VS Code 1.85.0 or higher

### Building

```bash
npm install
npm run compile
```

### Running

1. Press F5 to open a new VS Code window with the extension loaded
2. Open the chat and type `@orchestrator` or `@requirements`
3. View the Plan Board with `Ctrl+Shift+P` → "Show Plan Board"

### Watching for Changes

```bash
npm run watch
```

## Commands

- `copilot-orchestration.showPlanUI` - Show the Plan Board
- `copilot-orchestration.newChatWindow` - Launch a new chat with an agent
- `copilot-orchestration.updatePhase` - Update a phase (used by agents)
- `copilot-orchestration.updateTaskStatus` - Update task status (used by agents)
- `copilot-orchestration.sendAgentMessage` - Send a message to another agent

## Extension Settings

This extension contributes the following settings:

Currently no user-configurable settings. Configuration coming in future releases.

## Known Issues

- Icon files are placeholders - custom icons coming soon
- Drag and drop between swim lanes not yet implemented
- Agent-to-agent communication UI needs enhancement

## Release Notes

### 0.0.1

Initial release with:
- Orchestration Agent
- Requirements Builder Agent
- Plan Board UI with swim lanes
- Agent communication mechanism
- Chat window launcher

## Contributing

This is an open-source project. Contributions are welcome!

## License

MIT
