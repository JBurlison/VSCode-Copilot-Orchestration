# VS Code Copilot Orchestration - Visual Guide

This document provides visual descriptions of the extension's UI and features.

## Extension Overview

The VS Code Copilot Orchestration extension extends GitHub Copilot's chat interface with specialized agents and a visual plan management board.

## Chat Agents

### 1. Orchestrator Agent (@orchestrator)

The Orchestrator Agent appears in the Copilot Chat with the identifier `@orchestrator`. When you address it, you'll see:

```
You: @orchestrator create plan title: "Build REST API" description: "Create a Node.js REST API"

🎯 Orchestrator Agent activated

Creating a new plan...

✅ Created plan: Build REST API

📋 Plan ID: 1737534241000-x7y8z9abc

You can now add phases and tasks to this plan.

[Show Plan Board] (Button)
```

### 2. Requirements Builder Agent (@requirements)

The Requirements Builder Agent helps gather requirements:

```
You: @requirements start

📝 Requirements Builder activated

Let's gather your project requirements! 🚀

I'll help you structure:
- Functional Requirements: What the system should do
- Non-Functional Requirements: Performance, security, etc.
- Constraints: Limitations and boundaries
- Dependencies: External systems and libraries

Tell me about your project. What are you trying to build?
```

## Plan Board UI

### Visual Layout

The Plan Board is a kanban-style board with swim lanes organized by task status:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Plan Board: Build REST API                                          │
│  Create a Node.js REST API                                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐   │
│  │ 📋 To Do   │  │ 🔄 In Prog │  │ ✅ Done    │  │ 🚫 Blocked │   │
│  │    (3)     │  │    (2)     │  │    (1)     │  │    (0)     │   │
│  ├────────────┤  ├────────────┤  ├────────────┤  ├────────────┤   │
│  │            │  │            │  │            │  │            │   │
│  │ ┌────────┐ │  │ ┌────────┐ │  │ ┌────────┐ │  │            │   │
│  │ │Planning│ │  │ │Backend │ │  │ │Setup   │ │  │  No tasks  │   │
│  │ │        │ │  │ │        │ │  │ │        │ │  │            │   │
│  │ │ ⬜ Task│ │  │ │ 🔄 Task│ │  │ │ ✅ Task│ │  │            │   │
│  │ │ ⬜ Task│ │  │ │ 🔄 Task│ │  │ │        │ │  │            │   │
│  │ └────────┘ │  │ └────────┘ │  │ └────────┘ │  │            │   │
│  │            │  │            │  │            │  │            │   │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘   │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Interactive Features

1. **Task Status Cycling**: Click any task to cycle through statuses:
   - To Do (⬜) → In Progress (🔄) → Done (✅) → Blocked (🚫) → To Do

2. **Phase Cards**: Tasks are grouped by their phase, showing the phase title and all tasks within that phase

3. **Status Counters**: Each swim lane shows the count of tasks in that status

4. **Real-time Updates**: When agents add or modify tasks, the board updates automatically

## Complete Workflow Example

### Step 1: Create a Plan

```
@orchestrator create plan title: "E-commerce Website" description: "Full-stack online store"
```

**Agent Response:**
```
🎯 Orchestrator Agent activated

Creating a new plan...

✅ Created plan: E-commerce Website

📋 Plan ID: 1737534241000-abc123def

You can now add phases and tasks to this plan.

[Show Plan Board]
```

### Step 2: Add Phases

```
@orchestrator add phase title: "Setup" description: "Project initialization"
@orchestrator add phase title: "Backend" description: "API and database"
@orchestrator add phase title: "Frontend" description: "User interface"
```

**Agent Response for each:**
```
✅ Added phase: Setup

Phase ID: 1737534241100-xyz789ghi
```

### Step 3: Add Tasks

```
@orchestrator add task title: "Initialize Git repository"
@orchestrator add task title: "Install Node.js dependencies"
@orchestrator add task title: "Setup PostgreSQL database"
```

**Agent Response for each:**
```
✅ Added task: Initialize Git repository to phase Frontend

Task ID: 1737534241200-task001
```

### Step 4: View Plan Board

Open the Plan Board using:
- Command Palette: `Copilot Orchestration: Show Plan Board`
- Or click the [Show Plan Board] button in the chat

The board will display all phases and tasks organized by status.

### Step 5: Update Task Status

**In the Plan Board UI:**
- Click on "Initialize Git repository" task
- Status changes: To Do → In Progress
- Click again: In Progress → Done
- The task card moves to the corresponding swim lane

### Step 6: Check Status in Chat

```
@orchestrator status
```

**Agent Response:**
```
# 📊 Current Plan Status

E-commerce Website

Full-stack online store

## Phases (3)

### Setup
- Tasks: 1/2 completed
  - ✅ Initialize Git repository
  - ⬜ Install Node.js dependencies

### Backend
- Tasks: 0/1 completed
  - ⬜ Setup PostgreSQL database

### Frontend
- Tasks: 0/0 completed
```

## Requirements Builder Workflow

### Starting a Session

```
@requirements start
```

**Response:**
```
📝 Requirements Builder activated

Let's gather your project requirements! 🚀

I'll help you structure:
- Functional Requirements: What the system should do
- Non-Functional Requirements: Performance, security, etc.
- Constraints: Limitations and boundaries
- Dependencies: External systems and libraries

Tell me about your project. What are you trying to build?
```

### Adding Requirements

```
@requirements feature: User authentication with OAuth
```

**Response:**
```
📌 Feature Requirement Captured

Feature: User authentication with OAuth

✅ Added to plan as phase: User authentication with OAuth

What else should this feature include?
```

### Adding Constraints

```
@requirements constraint: Must support 10,000 concurrent users
```

**Response:**
```
⚠️ Constraint Noted

Constraint: Must support 10,000 concurrent users

I'll keep this in mind when building the plan.
```

### Finalizing

```
@requirements finalize
```

**Response:**
```
✨ Finalizing Requirements

Your requirements have been organized into 3 phases.

### Summary

1. User authentication with OAuth
   Implementation of: User authentication with OAuth

2. Performance
   Performance requirements and implementation

3. Core Features
   Core Features requirements and implementation

You can now work with the orchestrator to break these down into tasks.

[View Plan Board]
```

## Command Palette Integration

The extension adds commands to the VS Code Command Palette:

1. **Copilot Orchestration: Show Plan Board**
   - Opens the visual plan board in a side panel
   - Displays the current plan with all phases and tasks

2. **Copilot Orchestration: New Orchestrated Chat**
   - Opens a quick pick menu to select an agent
   - Launches a new chat window with the selected agent

## Agent Coordination Features

### Delegating to Other Agents

```
@orchestrator coordinate with requirements builder to gather API specifications
```

**Response:**
```
🤝 Coordinating with other agents...

I can help coordinate multiple agents for your task:

1. Requirements Builder: Gather detailed requirements
2. Implementation Agents: Execute specific subtasks
3. Review Agents: Validate the results

[Launch Requirements Builder]
```

### Message Bus

Behind the scenes, agents can communicate using the Agent Communication Bus:
- Send messages to other agents
- Track message history
- Coordinate complex workflows

## UI Theme Support

The Plan Board automatically adapts to your VS Code theme:
- **Dark themes**: Dark background with light text
- **Light themes**: Light background with dark text
- Uses VS Code's native color variables for consistency

## Future Enhancements (Not Yet Implemented)

- Drag and drop tasks between swim lanes
- Custom swim lane configurations
- Task assignment to specific agents
- Due dates and priorities
- Export plans to markdown or JSON
- Multiple plan views (list, timeline, dependencies)

---

**Note**: This is a visual guide. The actual appearance may vary based on your VS Code theme and settings.
