import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal
from app.services.ai_service import AIService
from app.schemas.ai import ChatRequest

async def run_test():
    async with AsyncSessionLocal() as db:
        service = AIService(db)
        request = ChatRequest(question="Hello, introduce yourself as an AI restaurant assistant.")
        try:
            response = await service.answer_question(user_id=1, request=request)
            print("Response length:", len(response.answer))
            print("Model used:", response.model_used)
            print("Sample response (first 200 chars):")
            print(response.answer[:200].encode('utf-8', errors='replace').decode('utf-8'))
        except Exception as e:
            print("Test failed:", str(e))

if __name__ == "__main__":
    asyncio.run(run_test())
