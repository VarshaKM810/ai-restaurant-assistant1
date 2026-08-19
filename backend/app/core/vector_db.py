"""
ChromaDB Vector Database manager with graceful fallback.
Stores embeddings for menu items, restaurant policies, and domain knowledge.
"""
import logging
from typing import List, Dict, Any, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

# Sample knowledge base for fallback/seeding
KNOWLEDGE_BASE_DOCS = [
    {
        "id": "menu_pasta",
        "text": "Truffle Mushroom Pasta: Creamy fettuccine served with wild forest mushrooms, truffle oil, and shaved parmesan cheese. Price: ₹450. Category: Main Course.",
        "metadata": {"category": "main_course", "item": "Truffle Mushroom Pasta"}
    },
    {
        "id": "menu_pizza",
        "text": "Margherita Supreme Pizza: Fresh mozzarella, Roma tomatoes, basil leaves, and extra virgin olive oil on a wood-fired sourdough crust. Price: ₹380. Category: Main Course.",
        "metadata": {"category": "main_course", "item": "Margherita Supreme Pizza"}
    },
    {
        "id": "menu_tacos",
        "text": "Crispy Avocado Tacos: Soft corn tortillas filled with panko-crusted avocado, chipotle crema, red cabbage slaw, and lime. Price: ₹290. Category: Appetizer.",
        "metadata": {"category": "appetizer", "item": "Crispy Avocado Tacos"}
    },
    {
        "id": "menu_cheesecake",
        "text": "New York Baked Cheesecake: Dense, velvety cream cheese filling with a graham cracker crust and fresh berry compote. Price: ₹240. Category: Dessert.",
        "metadata": {"category": "dessert", "item": "New York Baked Cheesecake"}
    },
    {
        "id": "menu_mojito",
        "text": "Fresh Mint Virgin Mojito: Crushed mint leaves, fresh lime juice, cane sugar, and sparkling soda over crushed ice. Price: ₹180. Category: Beverage.",
        "metadata": {"category": "beverage", "item": "Fresh Mint Virgin Mojito"}
    },
    {
        "id": "policy_hours",
        "text": "Operating Hours: Open Tuesday through Sunday from 11:00 AM to 11:00 PM. Closed on Mondays for deep cleaning.",
        "metadata": {"category": "policy", "topic": "hours"}
    },
    {
        "id": "policy_reservations",
        "text": "Reservation Policy: Table bookings are available via phone or online up to 7 days in advance. Holds are maintained for 15 minutes after reserved time.",
        "metadata": {"category": "policy", "topic": "reservations"}
    },
    {
        "id": "policy_waste",
        "text": "Food Waste Guidelines: All prep waste must be logged in the Food Waste module daily before closing shift. Ingredients near expiration should be marked for daily specials.",
        "metadata": {"category": "policy", "topic": "food_waste"}
    }
]


class VectorDBManager:
    def __init__(self):
        self.collection = None
        self._client = None
        self._initialized = False

    def initialize(self):
        if self._initialized:
            return
        try:
            import chromadb
            import socket
            use_http = False
            if settings.CHROMA_HOST and settings.CHROMA_PORT:
                try:
                    sock = socket.create_connection((settings.CHROMA_HOST, settings.CHROMA_PORT), timeout=0.5)
                    sock.close()
                    use_http = True
                except Exception:
                    use_http = False

            if use_http:
                try:
                    self._client = chromadb.HttpClient(host=settings.CHROMA_HOST, port=settings.CHROMA_PORT)
                    self.collection = self._client.get_or_create_collection(name="restaurant_knowledge")
                    logger.info(f"Connected to ChromaDB HTTP Server at {settings.CHROMA_HOST}:{settings.CHROMA_PORT}")
                except Exception:
                    use_http = False

            if not use_http:
                self._client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)
                self.collection = self._client.get_or_create_collection(name="restaurant_knowledge")
                logger.info(f"Using local ChromaDB PersistentClient at {settings.CHROMA_PERSIST_DIR}")

            # Auto-seed if collection is empty
            if self.collection.count() == 0:
                self._seed_collection()

            self._initialized = True
        except ImportError as e:
            logger.error(f"ChromaDB package is missing: {e}. Please run 'pip install chromadb'.")
            raise e
        except Exception as e:
            logger.error(f"ChromaDB initialization failed: {e}")
            raise e

    def _seed_collection(self):
        try:
            ids = [doc["id"] for doc in KNOWLEDGE_BASE_DOCS]
            documents = [doc["text"] for doc in KNOWLEDGE_BASE_DOCS]
            metadatas = [doc["metadata"] for doc in KNOWLEDGE_BASE_DOCS]
            self.collection.add(ids=ids, documents=documents, metadatas=metadatas)
            logger.info(f"Seeded ChromaDB with {len(documents)} initial knowledge documents")
        except Exception as e:
            logger.error(f"Failed to seed ChromaDB: {e}")

    def query(self, query_text: str, n_results: int = 3) -> List[Dict[str, Any]]:
        try:
            self.initialize()
        except Exception as e:
            logger.error(f"ChromaDB initialization failed in query: {e}")

        if self.collection:
            try:
                results = self.collection.query(query_texts=[query_text], n_results=n_results)
                docs = results.get("documents", [[]])[0]
                metas = results.get("metadatas", [[]])[0]
                
                output = []
                for doc, meta in zip(docs, metas):
                    output.append({"text": doc, "metadata": meta})
                return output
            except Exception as e:
                logger.error(f"ChromaDB query error: {e}")

        # Fallback: simple keyword matching across KNOWLEDGE_BASE_DOCS
        query_words = set(query_text.lower().split())
        scored_docs = []
        for doc in KNOWLEDGE_BASE_DOCS:
            text = doc["text"].lower()
            score = sum(1 for word in query_words if word in text)
            if score > 0:
                scored_docs.append((score, doc))
        
        scored_docs.sort(key=lambda x: x[0], reverse=True)
        results = [doc for _, doc in scored_docs[:n_results]]
        if not results:
            results = KNOWLEDGE_BASE_DOCS[:n_results]
        return results


vector_db = VectorDBManager()
