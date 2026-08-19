"""
AI Service — Full RAG pipeline integrating PostgreSQL live data, ChromaDB vector retrieval,
and Google Gemini Generative AI. Falls back to intelligent data-driven analysis when Gemini key
is not configured.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta, timezone
import time
import logging
import os

from app.core.config import settings
from app.core.vector_db import vector_db
from app.models.all_models import AILog, FoodWaste, Order, OrderItem, Menu, Review, Customer
from app.repositories.ai_repository import AIRepository
from app.schemas.ai import ChatRequest, ChatResponse, AILogResponse

logger = logging.getLogger(__name__)


class AIService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = AIRepository(db)

    # ─── Live PostgreSQL Data Fetchers ────────────────────────────────────────



    async def _get_waste_context(self) -> str:
        """Fetch recent food waste data from PostgreSQL."""
        try:
            now = datetime.now(timezone.utc)
            week_ago = now - timedelta(days=7)

            # Recent waste logs
            waste_q = select(FoodWaste).order_by(desc(FoodWaste.created_at)).limit(10)
            waste_res = await self.db.execute(waste_q)
            waste_items = waste_res.scalars().all()

            # Total waste cost this week
            cost_q = select(func.sum(FoodWaste.cost)).where(FoodWaste.created_at >= week_ago)
            cost_res = await self.db.execute(cost_q)
            total_cost = cost_res.scalar() or 0

            # Total waste quantity this week
            qty_q = select(func.sum(FoodWaste.quantity_wasted)).where(FoodWaste.created_at >= week_ago)
            qty_res = await self.db.execute(qty_q)
            total_qty = qty_res.scalar() or 0

            lines = [
                f"Food Waste Summary (last 7 days):",
                f"  Total quantity wasted: {total_qty:.1f} kg",
                f"  Total cost impact: ₹{total_cost:.2f}",
            ]

            if waste_items:
                lines.append("Recent waste logs (latest 10):")
                reason_counts: Dict[str, int] = {}
                for w in waste_items:
                    reason_counts[w.reason] = reason_counts.get(w.reason, 0) + 1
                    lines.append(
                        f"  • {w.ingredient_name}: {w.quantity_wasted:.1f} {w.unit} "
                        f"— Reason: {w.reason} — Cost: ₹{w.cost:.2f}"
                    )
                # Top waste reasons
                if reason_counts:
                    top_reason = max(reason_counts, key=reason_counts.get)
                    lines.append(f"Most common waste reason: '{top_reason}' ({reason_counts[top_reason]} occurrences)")

            return "\n".join(lines)
        except Exception as e:
            logger.error(f"Waste context error: {e}")
            return "Food waste data temporarily unavailable."

    async def _get_sales_context(self) -> str:
        """Fetch recent sales and order data from PostgreSQL."""
        try:
            now = datetime.now(timezone.utc)
            today = now.replace(hour=0, minute=0, second=0, microsecond=0)
            week_ago = now - timedelta(days=7)

            # Today's revenue
            rev_q = select(func.sum(Order.total_amount)).where(Order.created_at >= today)
            rev_res = await self.db.execute(rev_q)
            today_rev = rev_res.scalar() or 0

            # Today's orders
            ord_q = select(func.count(Order.id)).where(Order.created_at >= today)
            ord_res = await self.db.execute(ord_q)
            today_orders = ord_res.scalar() or 0

            # Week revenue
            week_rev_q = select(func.sum(Order.total_amount)).where(Order.created_at >= week_ago)
            week_rev_res = await self.db.execute(week_rev_q)
            week_rev = week_rev_res.scalar() or 0

            # Top selling menu items (by order item count)
            top_q = (
                select(Menu.name, func.count(OrderItem.id).label("order_count"))
                .join(OrderItem, OrderItem.menu_item_id == Menu.id)
                .group_by(Menu.name)
                .order_by(desc("order_count"))
                .limit(5)
            )
            top_res = await self.db.execute(top_q)
            top_items = top_res.all()

            lines = [
                "Sales & Revenue Summary:",
                f"  Today's Revenue: ₹{today_rev:,.2f} ({today_orders} orders)",
                f"  Last 7 Days Revenue: ₹{week_rev:,.2f}",
            ]

            if top_items:
                lines.append("Top 5 Best-Selling Menu Items (this week):")
                for i, (name, count) in enumerate(top_items, 1):
                    lines.append(f"  {i}. {name} — {count} orders")

            return "\n".join(lines)
        except Exception as e:
            logger.error(f"Sales context error: {e}")
            return "Sales data temporarily unavailable."

    async def _get_reviews_context(self) -> str:
        """Fetch recent customer review sentiment data from PostgreSQL."""
        try:
            # Sentiment counts
            pos_q = select(func.count(Review.id)).where(Review.sentiment == "positive")
            neg_q = select(func.count(Review.id)).where(Review.sentiment == "negative")
            neu_q = select(func.count(Review.id)).where(Review.sentiment == "neutral")

            pos = (await self.db.execute(pos_q)).scalar() or 0
            neg = (await self.db.execute(neg_q)).scalar() or 0
            neu = (await self.db.execute(neu_q)).scalar() or 0
            total = pos + neg + neu

            # Average rating
            avg_q = select(func.avg(Review.rating))
            avg_res = await self.db.execute(avg_q)
            avg_rating = avg_res.scalar() or 0

            # Latest reviews
            recent_q = select(Review).order_by(desc(Review.created_at)).limit(5)
            recent_res = await self.db.execute(recent_q)
            recent = recent_res.scalars().all()

            lines = [
                "Customer Review & Sentiment Analysis:",
                f"  Total reviews: {total}",
                f"  Average rating: {avg_rating:.1f}/5.0",
                f"  Positive: {pos} ({(pos/total*100) if total else 0:.1f}%)",
                f"  Neutral: {neu} ({(neu/total*100) if total else 0:.1f}%)",
                f"  Negative: {neg} ({(neg/total*100) if total else 0:.1f}%)",
            ]

            if recent:
                lines.append("Recent customer feedback:")
                for r in recent:
                    lines.append(
                        f"  • [{r.sentiment.upper()}] Rating {r.rating}/5 — \"{r.comment[:120]}...\""
                        if r.comment and len(r.comment) > 120
                        else f"  • [{r.sentiment.upper()}] Rating {r.rating}/5 — \"{r.comment}\""
                    )

            return "\n".join(lines)
        except Exception as e:
            logger.error(f"Reviews context error: {e}")
            return "Review data temporarily unavailable."

    # ─── Smart Fallback Response Generator ───────────────────────────────────
    def _generate_fallback_analysis(
        self, question: str, sales_ctx: str, waste_ctx: str, reviews_ctx: str
    ) -> str:
        q_lower = question.lower()
        
        # Categorize the question based on keywords
        is_waste = any(w in q_lower for w in ["waste", "spoil", "trash", "throw", "loss", "garbage", "reduce", "wasted"])
        is_sales = any(w in q_lower for w in ["sales", "revenue", "sell", "best", "popular", "dish", "menu", "order", "money", "income"])
        is_review = any(w in q_lower for w in ["review", "sentiment", "good", "bad", "like", "customer", "feedback", "rating", "satisfaction", "opinion"])

        if is_waste:
            insight = f"Analysis of food waste logs for query: '{question}'."
            reason = "Waste is driven primarily by ingredient shelf-life limitations, preparation oversights, or customer leftovers."
            evidence = waste_ctx
            recommendation = (
                "1. Implement tighter FIFO (First-In, First-Out) inventory management.\n"
                "2. Conduct portion size audits for high-waste dishes.\n"
                "3. Adjust raw ingredient purchase orders to match actual weekly menu demand."
            )
        elif is_sales:
            insight = f"Analysis of sales performance and popular menu items for query: '{question}'."
            reason = "Sales trends indicate peak order volumes for specific high-popularity menu offerings."
            evidence = sales_ctx
            recommendation = (
                "1. Optimize pricing structures for best-selling menu items.\n"
                "2. Ensure prime inventory availability for high-demand items during peak hours.\n"
                "3. Launch promotions or bundle offers featuring top-selling products to increase average order values."
            )
        elif is_review:
            insight = f"Analysis of customer sentiment and reviews for query: '{question}'."
            reason = "Customer satisfaction scores are driven by service speed, food preparation consistency, and dining experience quality."
            evidence = reviews_ctx
            recommendation = (
                "1. Address low-rating reviews promptly and implement customer recovery procedures.\n"
                "2. Share positive feedback with the kitchen and front-of-house staff to sustain high standards.\n"
                "3. Provide additional hospitality training focusing on highlighted pain points."
            )
        else:
            # General operational summary
            insight = f"General operational overview for query: '{question}'."
            reason = "A holistic assessment of restaurant performance across sales, waste, and review metrics."
            evidence = f"{sales_ctx}\n\n{waste_ctx}\n\n{reviews_ctx}"
            recommendation = (
                "1. Align kitchen preparation volumes with daily sales traffic forecasts.\n"
                "2. Monitor ingredient utilization rates to minimize kitchen waste.\n"
                "3. Review weekly customer feedback loops to maintain optimal dining satisfaction."
            )

        return (
            f"**Insight:**\n{insight}\n\n"
            f"**Reason:**\n{reason}\n\n"
            f"**Evidence:**\n{evidence}\n\n"
            f"**Recommendation:**\n{recommendation}\n\n"
            f"*Note: Operating in Offline Analytics mode. To enable dynamic generative AI answers, configure a valid `GOOGLE_API_KEY` in the backend `.env` file.*"
        )

    # ─── Main RAG Answer Method ───────────────────────────────────────────────

    async def answer_question(self, user_id: Optional[int], request: ChatRequest) -> ChatResponse:
        start_time = time.time()
        question = request.question

        # 1. ChromaDB vector retrieval
        context_texts = []
        retrieved_items = []
        chroma_context = ""
        try:
            retrieved_items = vector_db.query(question, n_results=3)
            context_texts = [item["text"] for item in retrieved_items]
            chroma_context = "\n".join([f"- {text}" for text in context_texts])
        except Exception as e:
            logger.error(f"ChromaDB retrieval failed: {e}")
            chroma_context = "ChromaDB vector retrieval is currently unavailable."

        # 2. Live PostgreSQL data retrieval (parallel context building)
        waste_ctx = await self._get_waste_context()
        sales_ctx = await self._get_sales_context()
        reviews_ctx = await self._get_reviews_context()

        answer = ""
        model_used = settings.GEMINI_MODEL

        # 3. Try Google Gemini if API key is configured
        api_key = settings.GOOGLE_API_KEY
        if not api_key or api_key == "your-google-gemini-api-key-here":
            logger.warning("Gemini API key is not configured. Falling back to data analytics engine.")
            model_used = "Data Analytics Engine (Offline Fallback)"
            answer = self._generate_fallback_analysis(question, sales_ctx, waste_ctx, reviews_ctx)
        else:
            try:
                from google import genai
                client = genai.Client(api_key=api_key)

                user_role = getattr(request, "user_role", "admin") or "admin"
                if user_role == "customer":
                    prompt = (
                        "You are the friendly, helpful Restaurant Concierge & Menu Assistant for RestaurantAI. "
                        "Answer the customer's question warmly, attractively, and accurately using the restaurant menu and context below. "
                        "Highlight delicious options, dietary preferences (vegetarian/non-vegetarian), and pairings where helpful.\n\n"
                        f"=== RESTAURANT KNOWLEDGE & MENU BASE ===\n{chroma_context}\n\n"
                        f"=== RESTAURANT DATA & SPECIALTIES ===\n"
                        f"{sales_ctx}\n\n"
                        f"{reviews_ctx}\n\n"
                        f"=== CUSTOMER QUESTION ===\n{question}"
                    )
                else:
                    prompt = (
                        "You are the Intelligent Restaurant Operations Assistant for RestaurantAI. "
                        "Answer the staff/manager question clearly and helpfully using the live data below. "
                        "You MUST format your response exactly using these four Markdown headers:\n"
                        "**Insight:** (Your main finding)\n"
                        "**Reason:** (Why this is happening)\n"
                        "**Evidence:** (Data points from the context. If data is missing or insufficient, state 'Insufficient evidence in the database.')\n"
                        "**Recommendation:** (Actionable advice)\n\n"
                        "CRITICAL: Do NOT invent or hallucinate statistics, numbers, or facts. Ground all findings in the provided context.\n\n"
                        f"=== CHROMADB KNOWLEDGE BASE ===\n{chroma_context}\n\n"
                        f"=== LIVE POSTGRESQL DATA ===\n"
                        f"{waste_ctx}\n\n"
                        f"{sales_ctx}\n\n"
                        f"{reviews_ctx}\n\n"
                        f"=== USER QUESTION ===\n{question}"
                    )

                # Try primary and fallback models
                candidate_models = []
                for m in [settings.GEMINI_MODEL, "gemini-3-flash-preview", "gemini-3.1-flash-lite"]:
                    if m and m not in candidate_models:
                        candidate_models.append(m)

                gemini_success = False
                last_gemini_error = None

                for model_candidate in candidate_models:
                    try:
                        response = client.models.generate_content(
                            model=model_candidate,
                            contents=prompt
                        )
                        if response and response.text:
                            answer = response.text
                            model_used = model_candidate
                            gemini_success = True
                            logger.info(f"Gemini response generated successfully using {model_candidate} for question: {question[:60]}")
                            break
                    except Exception as model_err:
                        last_gemini_error = model_err
                        logger.warning(f"Gemini model {model_candidate} call failed: {model_err}. Trying next fallback...")

                if not gemini_success:
                    logger.warning(f"All Gemini models unavailable: {last_gemini_error}. Generating data-grounded fallback analysis.")
                    model_used = "Data Analytics Engine (Offline Fallback)"
                    answer = self._generate_fallback_analysis(question, sales_ctx, waste_ctx, reviews_ctx)

            except Exception as e:
                logger.warning(f"Gemini API initialization error: {e}. Generating data-grounded fallback analysis.")
                model_used = "Data Analytics Engine (Offline Fallback)"
                answer = self._generate_fallback_analysis(question, sales_ctx, waste_ctx, reviews_ctx)

        elapsed_ms = int((time.time() - start_time) * 1000)

        # 5. Log interaction to database
        try:
            ai_log = AILog(
                user_id=user_id,
                question=question,
                answer=answer,
                context_retrieved=context_texts,
                model_used=model_used,
                tokens_used=len(question.split()) + len(answer.split()),
                response_time_ms=elapsed_ms
            )
            await self.repo.log_interaction(ai_log)
        except Exception as e:
            logger.error(f"Failed to log AI interaction: {e}")

        return ChatResponse(
            answer=answer,
            context_used=context_texts,
            sources=retrieved_items,
            model_used=model_used,
            response_time_ms=elapsed_ms,
            created_at=datetime.utcnow()
        )

    async def get_chat_history(self, user_id: Optional[int], page: int = 1, per_page: int = 20):
        logs, total = await self.repo.get_logs(page=page, per_page=per_page, user_id=user_id)
        return [AILogResponse.model_validate(log) for log in logs], total
