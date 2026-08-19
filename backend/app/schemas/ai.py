"""
AI Knowledge Assistant Schemas.
"""
from pydantic import BaseModel, Field, model_validator
from typing import Optional, List, Dict, Any
from datetime import datetime


class ChatMessage(BaseModel):
    role: str = Field(default="user", description="user or assistant")
    content: str = Field(default="", description="Message text")


class ChatRequest(BaseModel):
    question: Optional[str] = Field(default=None, description="User query or prompt")
    query: Optional[str] = Field(default=None, description="Alternative alias for question")
    history: Optional[List[ChatMessage]] = Field(default=[], description="Previous conversation messages")
    conversation_id: Optional[str] = Field(default=None, description="Session or conversation ID")
    user_role: Optional[str] = Field(default="admin", description="Role of the user (customer/admin/manager)")

    @model_validator(mode="before")
    @classmethod
    def resolve_question(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if not data.get("question") and data.get("query"):
                data["question"] = data["query"]
            elif not data.get("query") and data.get("question"):
                data["query"] = data["question"]
            if not data.get("question"):
                data["question"] = "Hello"
        return data


class ChatResponse(BaseModel):
    answer: str
    context_used: Optional[List[str]] = Field(default=[])
    sources: Optional[List[Dict[str, Any]]] = Field(default=[])
    model_used: str = "gemini-3.6-flash"
    response_time_ms: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AILogResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    question: str
    answer: Optional[str] = None
    context_retrieved: Optional[Any] = None
    model_used: Optional[str] = None
    tokens_used: Optional[int] = None
    response_time_ms: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AILogListResponse(BaseModel):
    logs: List[AILogResponse]
    total: int
    page: int
    per_page: int
