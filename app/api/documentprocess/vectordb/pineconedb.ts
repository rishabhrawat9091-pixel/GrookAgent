import { Pinecone } from "@pinecone-database/pinecone";

export type Embedding = {
    embedding?: number[] | number[][];
    embeddings?: number[][];
    chunks?: string[];
    metadata?: Record<string, any>;
    namespace?: string;
    docId?: string;
};

export type KnowledgeChunk = {
    id: string;
    text: string;
    score?: number;
};

/** Returns an initialised Pinecone index, or throws with a clear message. */
function getIndex() {
    const apiKey = process.env.PINECONE_API_KEY;
    const indexName = process.env.PINECONE_INDEX_NAME;

    if (!apiKey) throw new Error("PINECONE_API_KEY is not set in environment variables.");
    if (!indexName) throw new Error("PINECONE_INDEX_NAME is not set in environment variables.");

    const client = new Pinecone({ apiKey });
    return client.Index(indexName);
}

/**
 * Stores embedding vectors + text chunks into Pinecone.
 * Called from /api/documentprocess after HuggingFace embeddings are generated.
 */
export async function pinecone({
    embedding,
    embeddings,
    chunks = [],
    metadata = {},
    namespace,
    docId,
}: Embedding) {
    try {
        // Normalize to 2D array
        let vectorList: number[][] = [];
        if (embeddings && embeddings.length > 0) {
            vectorList = embeddings;
        } else if (embedding && Array.isArray(embedding) && embedding.length > 0) {
            if (typeof embedding[0] === "number") {
                vectorList = [embedding as number[]];
            } else if (Array.isArray(embedding[0])) {
                vectorList = embedding as number[][];
            }
        }

        if (vectorList.length === 0) {
            throw new Error("No valid embeddings provided for upload");
        }

        const index = getIndex();
        const timestamp = Date.now();
        const baseDocId = docId || `doc_${timestamp}`;

        // Build Pinecone vector records — text is stored in metadata.text for RAG retrieval
        const vectors = vectorList.map((vector, i) => {
            const recordId = `${baseDocId}_chunk_${i}_${Math.random().toString(36).substring(2, 7)}`;
            return {
                id: recordId,
                values: vector,
                metadata: {
                    ...metadata,
                    text: chunks[i] || "",
                    chunkIndex: i,
                    createdAt: new Date().toISOString(),
                },
            };
        });

        // Upsert in batches of 100 to stay within Pinecone payload limits
        // IMPORTANT: Pinecone v9 SDK upsert() validator expects { records: [...] }
        const BATCH_SIZE = 100;
        for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
            const batch = vectors.slice(i, i + BATCH_SIZE);
            await index.upsert({
                records: batch,  // v9 SDK: validator checks options.records
            });
        }

        return {
            message: "Knowledge uploaded to Pinecone successfully",
            success: true,
            count: vectors.length,
            ids: vectors.map((v) => v.id),
        };
    } catch (error: any) {
        const detail = error?.message || JSON.stringify(error) || "Unknown error";
        console.error("Pinecone upsert error:", detail);
        throw new Error(detail);
    }
}

/**
 * Queries Pinecone for the most similar chunks to a given embedding vector.
 * Used in the chat route to inject relevant document context into the agent prompt (RAG).
 *
 * @param vector   - Query embedding (384 dims for all-MiniLM-L6-v2)
 * @param topK     - Number of results to retrieve (default: 5)
 * @param namespace - Optional Pinecone namespace
 * @returns Array of { id, text, score } ordered by similarity
 */
export async function queryPinecone({
    vector,
    topK = 5,
    namespace,
    agentId,
}: {
    vector: number[];
    topK?: number;
    namespace?: string;
    agentId?: string;
}): Promise<KnowledgeChunk[]> {
    try {
        const index = getIndex();

        const queryParams: any = {
            vector,
            topK,
            includeMetadata: true,
        };
        if (namespace) queryParams.namespace = namespace;
        if (agentId) queryParams.filter = { agentId: { $eq: agentId } };

        let result = await index.query(queryParams);

        // Fallback: If agentId filter yielded 0 results, query globally without filter
        if ((!result.matches || result.matches.length === 0) && agentId) {
            delete queryParams.filter;
            result = await index.query(queryParams);
        }

        return (result.matches || []).map((match) => ({
            id: match.id,
            text: (match.metadata?.text as string) || "",
            score: match.score,
        }));
    } catch (error: any) {
        console.error("Pinecone query error:", error?.message || error);
        // Return empty — the agent can still answer without RAG context
        return [];
    }
}