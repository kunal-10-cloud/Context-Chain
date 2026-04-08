# Persistent AI — Multi-Agent Context Hub

## Problem Statement
A unified AI workspace where users chat with multiple AI models (GPT 5.2, GPT-4o, Claude Sonnet 4.5, Claude Opus 4.5, Gemini 3 Flash) in a tab-based interface, with automatic and on-demand extraction of structured intelligence (decisions, code, architecture choices, TODOs, unanswered questions) that chains seamlessly across model sessions.

## Architecture
- **Frontend**: React + Tailwind CSS, 3-panel layout (Sidebar | Chat Tabs | Context Panel)
- **Backend**: FastAPI (Python), RESTful API with /api prefix
- **Database**: MongoDB (projects, sessions, messages, extracted_intelligence collections)
- **AI Integration**: emergentintegrations library with Emergent Universal Key
- **Auth**: None (single-user mode v1)

## User Personas
- Solo developer/researcher who uses multiple AI models for different tasks
- Wants structured knowledge extraction across conversations
- Needs context continuity between model sessions

## Core Requirements (Static)
1. Multi-Model Chat Interface with tab system
2. Model Selector per tab (5 models)
3. Automatic Context Extraction (every 4 messages)
4. On-Demand "Extract Insights" button
5. Context Chain Across Tabs (inject context from prior sessions)
6. Session Timeline / Context Dashboard (right panel)
7. Project Organization (group sessions)

## What's Been Implemented (Feb 2026)
- [x] Full backend API (projects CRUD, sessions CRUD, chat, messages, extraction, intelligence, context injection)
- [x] 5 AI models integrated (GPT 5.2, GPT-4o, Claude Sonnet 4.5, Claude Opus 4.5, Gemini 3 Flash)
- [x] Tab-based chat interface with model info bar
- [x] **SSE message streaming** — AI responses stream word-by-word in real-time via Server-Sent Events
- [x] Streaming cursor (blinking blue bar) during response generation
- [x] Auto-extraction every 4 messages + manual "Extract Insights"
- [x] Context Panel with search, type filters (decision, code, architecture, todo, question)
- [x] Context injection dialog (load intelligence from other sessions)
- [x] Swiss high-contrast design (Cabinet Grotesk, IBM Plex Sans, JetBrains Mono)
- [x] **Keyboard shortcuts**: Cmd/Ctrl+N new session, Cmd/Ctrl+W close tab, Cmd/Ctrl+E extract insights, Cmd/Ctrl+B toggle sidebar, Cmd/Ctrl+Shift+I toggle context panel
- [x] **Multi-line textarea** with Enter to send, Shift+Enter for newline, auto-expanding height
- [x] Project creation/deletion, session creation/deletion
- [x] Markdown rendering in AI responses

## Prioritized Backlog
### P0 (Critical)
- None remaining

### P1 (High)
- Message streaming (SSE) for real-time AI response display
- Session renaming
- Keyboard shortcuts (Cmd+Enter to send, Cmd+N new session)
- Export extracted intelligence as markdown/JSON

### P2 (Medium)
- Drag-and-drop session reordering
- Session search
- Bulk intelligence export per project
- Context injection preview before confirming
- Token usage tracking per session/model

### P3 (Low)
- Dark mode toggle
- Code syntax highlighting in chat
- Conversation branching (fork a session)
- Multi-user/team support
- External conversation import

## Next Tasks
1. Add message streaming for real-time AI response display
2. Session renaming inline
3. Keyboard shortcuts for power users
4. Export intelligence as structured documents
