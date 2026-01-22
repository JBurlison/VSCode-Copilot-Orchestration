# Change Log

All notable changes to the "vscode-copilot-orchestration" extension will be documented in this file.

## [0.0.1] - 2026-01-22

### Added
- Orchestration Agent (`@orchestrator`) for coordinating multiple agents
- Requirements Builder Agent (`@requirements`) for gathering requirements
- Plan Board UI with swim lanes (To Do, In Progress, Done, Blocked)
- Phase and task management
- Agent-to-agent communication bus
- Chat window launcher for starting new chat sessions
- Interactive task status updates via UI clicks
- Real-time plan synchronization between agents and UI
- Commands for plan management
- Complete TypeScript implementation with type safety

### Features
- Create and manage project plans
- Add phases and tasks to plans
- Visual kanban board with status swim lanes
- Click-to-cycle task status updates
- Agent coordination capabilities
- Requirements gathering and categorization
- Plan status reporting

### Infrastructure
- Extension activation on startup
- Chat participant registration for agents
- Webview provider for Plan Board
- State management system
- Event-driven architecture for plan updates
