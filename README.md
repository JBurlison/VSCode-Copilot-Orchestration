# Copilot Orchestration Extension

A VS Code extension that extends Copilot Chat UI with agent orchestration, inter-agent communication, and a visual plan management interface.

## Features

### 🤖 Chat Participants

#### Orchestrator (`@orchestrator`)
The main coordination agent that manages multi-agent workflows.

**Commands:**
- `/plan` - View and manage your project plan
- `/delegate` - Delegate tasks to other agents
- `/status` - Get status of all agents and tasks

#### Requirements Builder (`@requirements`)
Helps build and refine project requirements.

**Commands:**
- `/gather` - Start gathering requirements through guided questions
- `/analyze` - Analyze and categorize existing requirements
- `/export` - Export approved requirements to the project plan

### 🛠️ Language Model Tools

These tools are available for agents to use during conversations:

| Tool | Description |
|------|-------------|
| `launchChat` | Launch a new chat window with a specific agent |
| `sendAgentMessage` | Send messages between agents for coordination |
| `updatePhase` | Create or update a phase in the project plan |
| `updateTask` | Create or update a task within a phase |
| `getPlanStatus` | Get the current status of the project plan |
| `getAgentQueue` | Check for pending messages from other agents |

### 📋 Plan UI

A visual Kanban-style board with swim lanes organized by status:
- 🔵 Not Started
- 🟡 In Progress
- 🔴 Blocked
- 🟢 Completed

**Features:**
- Drag and drop phases between status lanes
- Add phases and tasks inline
- Visual progress tracking
- Agent assignment display
- Priority badges for tasks

## Installation

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run compile` to compile TypeScript
4. Press `F5` to launch the extension in a new VS Code window

## Usage

### Starting an Orchestrated Workflow

1. Open the Command Palette (`Ctrl+Shift+P`)
2. Run "Copilot Orchestration: Launch Agent Chat"
3. Select the Orchestrator agent
4. Describe your project or task

### Managing Your Plan

1. Open the Command Palette (`Ctrl+Shift+P`)
2. Run "Copilot Orchestration: Open Plan UI"
3. Use the visual board to track progress

### Agent Communication Example

```
@orchestrator /delegate to requirements: We need to gather requirements for a new e-commerce platform
```

The orchestrator will hand off the task to the requirements agent, which can then:
1. Gather requirements from the user
2. Analyze and categorize them
3. Export them back to the project plan

## Architecture

```
src/
├── extension.ts           # Main entry point
├── types.ts              # TypeScript interfaces
├── planManager.ts        # Plan state management
├── agentMessageBus.ts    # Inter-agent communication
├── participants/
│   ├── orchestrator.ts   # Orchestrator chat participant
│   └── requirements.ts   # Requirements builder participant
├── webview/
│   └── planUI.ts        # Plan UI webview provider
└── tools/
    └── languageModelTools.ts  # LM tool implementations
```

## API

This extension exports APIs that other extensions can use:

```typescript
const orchestration = vscode.extensions.getExtension('jburlison.copilot-orchestration');
if (orchestration) {
    const api = orchestration.exports;
    const planManager = api.getPlanManager();
    const messageBus = api.getMessageBus();
}
```

## Development

### Building

```bash
npm run compile    # One-time compile
npm run watch      # Watch mode
```

### Testing

```bash
npm run test
```

### Packaging

```bash
npx vsce package
```

## Requirements

- VS Code 1.95.0 or higher
- GitHub Copilot Chat extension

## Extension Settings

This extension contributes the following settings:

*Coming soon*

## Known Issues

- Initial release - please report issues on GitHub

## Release Notes

### 0.1.0

Initial release with:
- Orchestrator and Requirements Builder chat participants
- Plan UI with swim lanes
- Inter-agent communication system
- Language model tools for plan management

## License

MIT