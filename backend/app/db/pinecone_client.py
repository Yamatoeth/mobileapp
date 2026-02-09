"""
Pinecone client for episodic memory (vector search)
"""
from typing import Optional
from pinecone import Pinecone

from app.core.config import get_settings

settings = get_settings()

# Index configuration
INDEX_NAME = "jarvis-memory"
EMBEDDING_DIMENSION = 1536  # OpenAI text-embedding-3-small


class PineconeClient:
    """Pinecone client for semantic memory search."""
    
    _instance: Optional["PineconeClient"] = None
    _client: Optional[Pinecone] = None
    _index = None
    
    def __new__(cls) -> "PineconeClient":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def connect(self) -> None:
        """Initialize Pinecone client."""
        if self._client is None and settings.pinecone_api_key:
            self._client = Pinecone(api_key=settings.pinecone_api_key)
            
            # Check if index exists
            existing_indexes = [idx.name for idx in self._client.list_indexes()]
            
            if INDEX_NAME not in existing_indexes:
                # Create index with serverless spec
                self._client.create_index(
                    name=INDEX_NAME,
                    dimension=EMBEDDING_DIMENSION,
                    metric="cosine",
                    spec={
                        "serverless": {
                            "cloud": "aws",
                            "region": "us-east-1"
                        }
                    }
                )
            
            self._index = self._client.Index(INDEX_NAME)
    
    @property
    def index(self):
        """Get Pinecone index."""
        if self._index is None:
            raise RuntimeError("Pinecone not connected. Call connect() first.")
        return self._index
    
    @property
    def is_configured(self) -> bool:
        """Check if Pinecone is configured."""
        return settings.pinecone_api_key is not None
    
    async def upsert_memory(
        self,
        memory_id: str,
        embedding: list[float],
        metadata: dict,
        namespace: str = "default"
    ) -> None:
        """Store a memory embedding."""
        if not self.is_configured:
            return
        
        self.index.upsert(
            vectors=[{
                "id": memory_id,
                "values": embedding,
                "metadata": metadata
            }],
            namespace=namespace
        )
    
    async def search_memories(
        self,
        query_embedding: list[float],
        top_k: int = 5,
        namespace: str = "default",
        filter_dict: Optional[dict] = None
    ) -> list[dict]:
        """Search for similar memories."""
        if not self.is_configured:
            return []
        
        results = self.index.query(
            vector=query_embedding,
            top_k=top_k,
            namespace=namespace,
            filter=filter_dict,
            include_metadata=True
        )
        
        return [
            {
                "id": match.id,
                "score": match.score,
                "metadata": match.metadata
            }
            for match in results.matches
        ]
    
    async def delete_memory(
        self,
        memory_id: str,
        namespace: str = "default"
    ) -> None:
        """Delete a memory by ID."""
        if not self.is_configured:
            return
        
        self.index.delete(ids=[memory_id], namespace=namespace)
    
    async def delete_user_memories(
        self,
        user_id: str,
        namespace: str = "default"
    ) -> None:
        """Delete all memories for a user."""
        if not self.is_configured:
            return
        
        self.index.delete(
            filter={"user_id": user_id},
            namespace=namespace
        )


# Singleton instance
pinecone_client = PineconeClient()


def get_pinecone() -> PineconeClient:
    """Dependency for getting Pinecone client."""
    if pinecone_client.is_configured:
        pinecone_client.connect()
    return pinecone_client
