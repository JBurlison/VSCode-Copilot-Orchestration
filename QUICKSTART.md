# Quick Start Guide

This guide will help you get started with the VS Code Copilot Orchestration extension.

## Installation

1. Clone this repository
2. Open the folder in VS Code
3. Run `npm install`
4. Run `npm run compile`
5. Press F5 to launch the Extension Development Host

## First Steps

### 1. Open Copilot Chat

Press `Ctrl+Alt+I` (Windows/Linux) or `Cmd+Option+I` (Mac) to open the Copilot Chat panel.

### 2. Try the Orchestrator Agent

Type in the chat:
```
@orchestrator create plan title: "Build a TODO App" description: "A simple task management application"
```

The orchestrator will:
- Create a new plan
- Show you the plan ID
- Open the Plan Board UI automatically

### 3. Add Phases to Your Plan

```
@orchestrator add phase title: "Setup" description: "Initialize project and dependencies"
@orchestrator add phase title: "Backend" description: "Build API and database"
@orchestrator add phase title: "Frontend" description: "Create user interface"
@orchestrator add phase title: "Testing" description: "Write tests and QA"
```

### 4. Add Tasks to Phases

```
@orchestrator add task title: "Install Node.js and npm"
@orchestrator add task title: "Setup Git repository"
@orchestrator add task title: "Design database schema"
```

Tasks are automatically added to the most recent phase.

### 5. View the Plan Board

Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`) and run:
```
Copilot Orchestration: Show Plan Board
```

You'll see a kanban board with four swim lanes:
- 📋 **To Do**: New tasks that haven't been started
- 🔄 **In Progress**: Tasks currently being worked on
- ✅ **Done**: Completed tasks
- 🚫 **Blocked**: Tasks that are blocked by dependencies

### 6. Update Task Status

Click on any task in the Plan Board to cycle through statuses:
- To Do → In Progress → Done → Blocked → To Do

### 7. Check Plan Status

At any time, you can ask the orchestrator for a status update:
```
@orchestrator status
```

This will show you:
- Plan title and description
- All phases
- Tasks in each phase with their status

### 8. Use the Requirements Builder

Start a requirements gathering session:
```
@requirements start
```

Then describe your requirements:
```
@requirements feature: User authentication with email and password
@requirements feature: Task creation and editing
@requirements feature: Task priorities and due dates
@requirements constraint: Must work on mobile devices
@requirements finalize
```

The Requirements Builder will:
- Categorize your requirements
- Create phases in your plan
- Organize requirements logically

## Advanced Usage

### Launch New Chat Windows

Use the command palette:
```
Copilot Orchestration: New Orchestrated Chat
```

Select an agent to start a fresh chat session with that agent.

### Agent Coordination

Ask the orchestrator to coordinate with other agents:
```
@orchestrator coordinate with requirements builder to gather API specifications
```

The orchestrator can:
- Break down complex tasks
- Delegate to specialized agents
- Track progress across multiple workstreams

## Example Workflow

Here's a complete example workflow:

1. **Create a plan**
   ```
   @orchestrator create plan title: "E-commerce Website" description: "Build a full-stack e-commerce platform"
   ```

2. **Gather requirements**
   ```
   @requirements start
   @requirements feature: Product catalog with search
   @requirements feature: Shopping cart and checkout
   @requirements feature: User accounts and order history
   @requirements feature: Admin panel for inventory management
   @requirements constraint: Must support 1000 concurrent users
   @requirements security: PCI DSS compliance for payments
   @requirements finalize
   ```

3. **Add implementation phases**
   ```
   @orchestrator add phase title: "Architecture" description: "System design and tech stack selection"
   @orchestrator add phase title: "Backend Development" description: "API and database implementation"
   @orchestrator add phase title: "Frontend Development" description: "User interface and UX"
   @orchestrator add phase title: "Integration" description: "Connect all components"
   @orchestrator add phase title: "Deployment" description: "CI/CD and production deployment"
   ```

4. **Break down into tasks**
   ```
   @orchestrator add task title: "Design database schema for products, users, orders"
   @orchestrator add task title: "Set up Express.js API server"
   @orchestrator add task title: "Implement authentication endpoints"
   @orchestrator add task title: "Create product listing API"
   @orchestrator add task title: "Build shopping cart logic"
   ```

5. **Track progress**
   - Open the Plan Board
   - Click tasks to update their status as you work
   - Check `@orchestrator status` regularly

6. **Coordinate work**
   ```
   @orchestrator I've completed the authentication. What should I work on next?
   ```

## Tips and Tricks

### Quick Plan Creation

You can create a plan and add phases in one message:
```
@orchestrator create plan title: "Mobile App" description: "iOS and Android app"
Then add these phases:
1. Design - UI/UX mockups
2. Development - Build the app
3. Testing - QA and bug fixes
4. Launch - Deploy to app stores
```

### Using Context

Provide context to agents for better coordination:
```
@orchestrator I'm building a React app with TypeScript and Node.js backend. Help me structure the development plan.
```

### Checking Message History

The agent communication bus keeps a history of messages between agents. This is useful for debugging and understanding agent coordination.

### Multiple Plans

You can create multiple plans, but only one plan is "current" at a time. The most recently created plan becomes the current plan.

## Troubleshooting

### Extension Not Loading

1. Check the Debug Console for errors
2. Make sure you ran `npm install` and `npm run compile`
3. Try reloading the Extension Development Host window

### Agents Not Responding

1. Make sure you're using `@orchestrator` or `@requirements` to address the agents
2. Check that the extension is activated (you should see a notification on startup)

### Plan Board Not Updating

1. Close and reopen the Plan Board
2. Make a change in the chat (e.g., add a task) to trigger an update
3. Check the Debug Console for errors

## Next Steps

- Explore the source code in `src/` to understand how agents work
- Customize the agents for your specific workflow
- Add new agents by following the pattern in `src/agents/`
- Extend the Plan Board UI with new features

## Support

For issues, questions, or contributions, please visit the GitHub repository.
