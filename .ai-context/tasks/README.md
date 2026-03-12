# Tasks README

This folder contains executable tasks for AI agents working with the hyper-decor project.

## How to Use Tasks

To execute a task, use the format: `run task:<number>`

Example: `run task:1` executes the first task in the list.

## Available Tasks (Priority Order)

1. **project_review.md** - 🚨 **START HERE** - Complete analysis of hyper-decor current state
2. **create_decorator.md** - Generate new decorators following established patterns
3. **optimize_performance.md** - Performance analysis and optimization (45k+ req/sec target)
4. **fix_tests.md** - Fix DI tests and improve coverage (currently 8/8 passing, 3 skipped)
5. **validate_build.md** - Build validation and deployment readiness checks

## 🤖 For AI Agents

**CRITICAL**: Always start with `run task:1` to understand the current project state before making any modifications.

**Current Project Status:**
- ✅ Production-ready (v1.0.61)
- ✅ Core functionality complete
- ✅ Build system optimized  
- ⚠️ Some DI tests need fixing
- 🎯 Performance target: 45k+ req/sec

## Task Guidelines

- Each task file contains specific instructions for the agent
- Tasks should be executed in order when starting with the project
- Always read the project rules before executing any task
- Provide detailed output and next steps after completing each task

## Adding New Tasks

When adding new tasks:
1. Create a new `.md` file with a descriptive name
2. Follow the task template structure
3. Update this README with the new task description
4. Test the task with an AI agent before committing