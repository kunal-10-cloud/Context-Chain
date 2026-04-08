from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks, Request
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import json
import asyncio
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Model mapping: display_key -> (provider, model_id)
MODEL_MAP = {
    "gpt-5.2": ("openai", "gpt-5.2"),
    "gpt-4o": ("openai", "gpt-4o"),
    "claude-sonnet-4.5": ("anthropic", "claude-sonnet-4-5-20250929"),
    "claude-opus-4.5": ("anthropic", "claude-opus-4-5-20251101"),
    "gemini-3-flash": ("gemini", "gemini-3-flash-preview"),
}

# --- Pydantic Models ---
class ProjectCreate(BaseModel):
    name: str
    description: str = ""

class SessionCreate(BaseModel):
    project_id: str
    title: str
    model: str

class ChatRequest(BaseModel):
    session_id: str
    content: str

class ContextInjectRequest(BaseModel):
    session_ids: List[str]

class TitleUpdate(BaseModel):
    title: str

# --- Project Endpoints ---
@api_router.post("/projects")
async def create_project(data: ProjectCreate):
    now = datetime.now(timezone.utc).isoformat()
    project = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "description": data.description,
        "created_at": now,
        "updated_at": now,
    }
    await db.projects.insert_one(project)
    project.pop("_id", None)
    return project

@api_router.get("/projects")
async def list_projects():
    projects = await db.projects.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return projects

@api_router.put("/projects/{project_id}")
async def update_project(project_id: str, data: ProjectCreate):
    now = datetime.now(timezone.utc).isoformat()
    result = await db.projects.update_one(
        {"id": project_id},
        {"$set": {"name": data.name, "description": data.description, "updated_at": now}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    return project

@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str):
    # Get all sessions for cascading delete
    sessions = await db.sessions.find({"project_id": project_id}, {"id": 1, "_id": 0}).to_list(1000)
    session_ids = [s["id"] for s in sessions]
    await db.projects.delete_one({"id": project_id})
    if session_ids:
        await db.sessions.delete_many({"project_id": project_id})
        await db.messages.delete_many({"session_id": {"$in": session_ids}})
        await db.extracted_intelligence.delete_many({"session_id": {"$in": session_ids}})
    return {"status": "deleted"}

# --- Session Endpoints ---
@api_router.post("/sessions")
async def create_session(data: SessionCreate):
    if data.model not in MODEL_MAP:
        raise HTTPException(status_code=400, detail=f"Invalid model: {data.model}")
    # Verify project exists
    project = await db.projects.find_one({"id": data.project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    now = datetime.now(timezone.utc).isoformat()
    session = {
        "id": str(uuid.uuid4()),
        "project_id": data.project_id,
        "title": data.title,
        "model": data.model,
        "created_at": now,
        "updated_at": now,
        "message_count": 0,
        "context_injected": None,
    }
    await db.sessions.insert_one(session)
    session.pop("_id", None)
    return session

@api_router.get("/sessions")
async def list_sessions(project_id: Optional[str] = None):
    query = {}
    if project_id:
        query["project_id"] = project_id
    sessions = await db.sessions.find(query, {"_id": 0}).sort("updated_at", -1).to_list(200)
    return sessions

@api_router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    session = await db.sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session

@api_router.put("/sessions/{session_id}/title")
async def update_session_title(session_id: str, data: TitleUpdate):
    now = datetime.now(timezone.utc).isoformat()
    await db.sessions.update_one(
        {"id": session_id},
        {"$set": {"title": data.title, "updated_at": now}}
    )
    return {"status": "updated"}

@api_router.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    await db.sessions.delete_one({"id": session_id})
    await db.messages.delete_many({"session_id": session_id})
    await db.extracted_intelligence.delete_many({"session_id": session_id})
    return {"status": "deleted"}

# --- Messages ---
@api_router.get("/sessions/{session_id}/messages")
async def get_messages(session_id: str):
    messages = await db.messages.find(
        {"session_id": session_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(1000)
    return messages

# --- Chat (non-streaming fallback) ---
@api_router.post("/chat")
async def chat(data: ChatRequest, background_tasks: BackgroundTasks):
    session = await db.sessions.find_one({"id": data.session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    model_key = session["model"]
    if model_key not in MODEL_MAP:
        raise HTTPException(status_code=400, detail=f"Invalid model: {model_key}")

    provider, model_name = MODEL_MAP[model_key]
    api_key = os.environ.get("EMERGENT_LLM_KEY")

    # Save user message
    now = datetime.now(timezone.utc).isoformat()
    user_msg = {
        "id": str(uuid.uuid4()),
        "session_id": data.session_id,
        "project_id": session["project_id"],
        "role": "user",
        "content": data.content,
        "model": model_key,
        "created_at": now,
    }
    await db.messages.insert_one(user_msg)
    user_msg.pop("_id", None)

    system_msg, _ = await _build_chat_context(data.session_id, session)

    try:
        llm = LlmChat(
            api_key=api_key,
            session_id=str(uuid.uuid4()),
            system_message=system_msg,
        ).with_model(provider, model_name)

        response = await llm.send_message(UserMessage(text=data.content))

        assistant_msg = {
            "id": str(uuid.uuid4()),
            "session_id": data.session_id,
            "project_id": session["project_id"],
            "role": "assistant",
            "content": response,
            "model": model_key,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.messages.insert_one(assistant_msg)
        assistant_msg.pop("_id", None)

        count = await db.messages.count_documents({"session_id": data.session_id})
        await db.sessions.update_one(
            {"id": data.session_id},
            {"$set": {"message_count": count, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )

        if count >= 4 and count % 4 == 0:
            background_tasks.add_task(run_extraction, data.session_id)

        return {"message": assistant_msg}

    except Exception as e:
        logger.error(f"Chat error with {model_key}: {e}")
        raise HTTPException(status_code=500, detail=f"AI model error: {str(e)}")


async def _build_chat_context(session_id: str, session: dict):
    """Build system message with conversation history and injected context."""
    history = await db.messages.find(
        {"session_id": session_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(50)

    model_key = session["model"]
    system_msg = f"You are a helpful AI assistant ({model_key}). Provide clear, well-structured responses. Use markdown formatting when appropriate."
    if session.get("context_injected"):
        system_msg += f"\n\nContext from previous sessions:\n{session['context_injected']}"

    conv_parts = []
    for msg in history[:-1]:
        role = "User" if msg["role"] == "user" else "Assistant"
        conv_parts.append(f"{role}: {msg['content']}")

    if conv_parts:
        system_msg += "\n\nPrevious conversation:\n" + "\n\n".join(conv_parts)

    return system_msg, history


# --- Chat Streaming (SSE) ---
@api_router.post("/chat/stream")
async def chat_stream(data: ChatRequest):
    """SSE streaming chat endpoint. Streams AI response word-by-word."""
    session = await db.sessions.find_one({"id": data.session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    model_key = session["model"]
    if model_key not in MODEL_MAP:
        raise HTTPException(status_code=400, detail=f"Invalid model: {model_key}")

    provider, model_name = MODEL_MAP[model_key]
    api_key = os.environ.get("EMERGENT_LLM_KEY")

    # Save user message
    now = datetime.now(timezone.utc).isoformat()
    user_msg_id = str(uuid.uuid4())
    user_msg = {
        "id": user_msg_id,
        "session_id": data.session_id,
        "project_id": session["project_id"],
        "role": "user",
        "content": data.content,
        "model": model_key,
        "created_at": now,
    }
    await db.messages.insert_one(user_msg)

    system_msg, _ = await _build_chat_context(data.session_id, session)

    assistant_msg_id = str(uuid.uuid4())

    async def event_generator():
        try:
            # Send start event with message ID
            yield f"data: {json.dumps({'type': 'start', 'message_id': assistant_msg_id})}\n\n"

            # Call the AI model
            llm = LlmChat(
                api_key=api_key,
                session_id=str(uuid.uuid4()),
                system_message=system_msg,
            ).with_model(provider, model_name)

            response = await llm.send_message(UserMessage(text=data.content))

            # Stream response in chunks (word-by-word with grouping for speed)
            words = response.split(' ')
            chunk_size = 3  # Send 3 words at a time for smooth streaming
            for i in range(0, len(words), chunk_size):
                chunk = ' '.join(words[i:i + chunk_size])
                # Add space prefix except for first chunk
                if i > 0:
                    chunk = ' ' + chunk
                yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"
                await asyncio.sleep(0.02)  # 20ms between chunks for typewriter feel

            # Save complete assistant message to DB
            assistant_msg = {
                "id": assistant_msg_id,
                "session_id": data.session_id,
                "project_id": session["project_id"],
                "role": "assistant",
                "content": response,
                "model": model_key,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.messages.insert_one(assistant_msg)

            # Update session message count
            count = await db.messages.count_documents({"session_id": data.session_id})
            await db.sessions.update_one(
                {"id": data.session_id},
                {"$set": {"message_count": count, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )

            # Auto-extract every 4 messages
            should_extract = count >= 4 and count % 4 == 0

            # Send done event
            yield f"data: {json.dumps({'type': 'done', 'message_id': assistant_msg_id, 'should_extract': should_extract})}\n\n"

            # Run extraction if needed
            if should_extract:
                await run_extraction(data.session_id)

        except Exception as e:
            logger.error(f"Stream chat error with {model_key}: {e}")
            yield f"data: {json.dumps({'type': 'error', 'detail': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

# --- Intelligence Extraction ---
async def run_extraction(session_id: str):
    """Extract structured intelligence from a conversation session."""
    try:
        session = await db.sessions.find_one({"id": session_id}, {"_id": 0})
        if not session:
            return

        messages = await db.messages.find(
            {"session_id": session_id}, {"_id": 0}
        ).sort("created_at", 1).to_list(100)

        if len(messages) < 2:
            return

        conv_text = "\n\n".join(
            f"{'User' if m['role'] == 'user' else 'Assistant'}: {m['content']}"
            for m in messages
        )

        api_key = os.environ.get("EMERGENT_LLM_KEY")

        extraction_prompt = """Analyze this conversation and extract structured intelligence items.
Return a JSON array where each item has:
- "type": one of "decision", "code", "architecture", "todo", "question"
- "content": concise summary of the item (1-2 sentences max)

Types:
- decision: Any explicit decision or conclusion reached
- code: Code snippets, algorithms, or technical implementations discussed
- architecture: System design, architecture choices, or structural decisions
- todo: Action items, tasks to complete, or next steps mentioned
- question: Unanswered questions or open issues

Only include items clearly present. Return ONLY a valid JSON array, no markdown fences.

Conversation:
""" + conv_text

        llm = LlmChat(
            api_key=api_key,
            session_id=str(uuid.uuid4()),
            system_message="You are an intelligence extraction engine. Return only valid JSON arrays.",
        ).with_model("openai", "gpt-5.2")

        response = await llm.send_message(UserMessage(text=extraction_prompt))

        # Parse JSON
        json_str = response.strip()
        if json_str.startswith("```"):
            lines = json_str.split("\n")
            json_str = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
            if json_str.startswith("json"):
                json_str = json_str[4:].strip()

        items = json.loads(json_str)

        if not isinstance(items, list):
            logger.error(f"Extraction returned non-list: {type(items)}")
            return

        # Replace previous extractions for this session
        await db.extracted_intelligence.delete_many({"session_id": session_id})

        now = datetime.now(timezone.utc).isoformat()
        for item in items:
            if not isinstance(item, dict) or "type" not in item or "content" not in item:
                continue
            intel = {
                "id": str(uuid.uuid4()),
                "session_id": session_id,
                "project_id": session["project_id"],
                "type": item["type"],
                "content": item["content"],
                "session_title": session.get("title", "Untitled"),
                "model": session.get("model", "unknown"),
                "created_at": now,
            }
            await db.extracted_intelligence.insert_one(intel)

        logger.info(f"Extracted {len(items)} items from session {session_id}")
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error in extraction: {e}")
    except Exception as e:
        logger.error(f"Extraction error: {e}")

@api_router.post("/sessions/{session_id}/extract")
async def extract_intelligence(session_id: str):
    """Manual extraction trigger."""
    session = await db.sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    await run_extraction(session_id)

    items = await db.extracted_intelligence.find(
        {"session_id": session_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)

    return {"items": items}

# --- Intelligence ---
@api_router.get("/intelligence")
async def get_intelligence(project_id: Optional[str] = None, session_id: Optional[str] = None):
    query = {}
    if project_id:
        query["project_id"] = project_id
    if session_id:
        query["session_id"] = session_id
    items = await db.extracted_intelligence.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items

# --- Context Injection ---
@api_router.post("/sessions/{session_id}/inject-context")
async def inject_context(session_id: str, data: ContextInjectRequest):
    session = await db.sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    context_parts = []
    for sid in data.session_ids:
        src = await db.sessions.find_one({"id": sid}, {"_id": 0})
        if not src:
            continue
        items = await db.extracted_intelligence.find(
            {"session_id": sid}, {"_id": 0}
        ).to_list(100)
        if items:
            context_parts.append(f"--- {src.get('title', 'Untitled')} ({src.get('model', '')}) ---")
            for item in items:
                context_parts.append(f"[{item['type'].upper()}] {item['content']}")

    context_text = "\n".join(context_parts)
    await db.sessions.update_one(
        {"id": session_id},
        {"$set": {"context_injected": context_text, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"context": context_text}

@api_router.get("/sessions/{session_id}/available-context")
async def get_available_context(session_id: str):
    session = await db.sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    other_sessions = await db.sessions.find(
        {"project_id": session["project_id"], "id": {"$ne": session_id}},
        {"_id": 0}
    ).to_list(100)

    result = []
    for s in other_sessions:
        intel_count = await db.extracted_intelligence.count_documents({"session_id": s["id"]})
        s["intelligence_count"] = intel_count
        result.append(s)
    return result

# --- Models List ---
@api_router.get("/models")
async def list_models():
    return [
        {"key": "gpt-5.2", "name": "GPT 5.2", "provider": "OpenAI"},
        {"key": "gpt-4o", "name": "GPT-4o", "provider": "OpenAI"},
        {"key": "claude-sonnet-4.5", "name": "Claude Sonnet 4.5", "provider": "Anthropic"},
        {"key": "claude-opus-4.5", "name": "Claude Opus 4.5", "provider": "Anthropic"},
        {"key": "gemini-3-flash", "name": "Gemini 3 Flash", "provider": "Google"},
    ]

@api_router.get("/health")
async def health():
    return {"status": "ok"}

# Include router & middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
