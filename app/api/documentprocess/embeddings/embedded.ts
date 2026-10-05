import { InferenceClient } from "@huggingface/inference";

export const DEFAULT_EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
export const EMBEDDING_DIMENSION = 384;

export interface EmbeddingOptions {
  chunks?: string[];
  token?: string;
  model?: string;
}

/**
 * Normalizes Hugging Face featureExtraction outputs into a 1D vector (number[]).
 * Supports both direct 1D vectors and mean-pooled 2D token arrays.
 */
function normalizeToVector(raw: unknown): number[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [];
  }

  // Case 1: Already a 1D vector [number, number, ...]
  if (typeof raw[0] === "number") {
    return raw as number[];
  }

  // Case 2: 2D token embeddings [tokens, dimensions] -> perform mean pooling
  if (Array.isArray(raw[0]) && typeof raw[0][0] === "number") {
    const tokenMatrix = raw as number[][];
    const numTokens = tokenMatrix.length;
    const dim = tokenMatrix[0].length;
    const pooled: number[] = new Array(dim).fill(0);

    for (let i = 0; i < numTokens; i++) {
      for (let d = 0; d < dim; d++) {
        pooled[d] += tokenMatrix[i][d];
      }
    }

    return pooled.map((val) => val / numTokens);
  }

  return [];
}

/**
 * Generates vector embeddings using Hugging Face's InferenceClient.
 *
 * Supports flexible calling patterns:
 * 1. embedding(chunks, { model, token })
 * 2. embedding({ chunks, model, token })
 *
 * @param chunksOrParams - Array of string chunks or configuration object
 * @param options - Optional override for token and model
 * @returns Array of embedding vectors (number[][])
 */
export async function embedding(
  chunksOrParams: string[] | EmbeddingOptions,
  options?: { token?: string; model?: string }
): Promise<number[][]> {
  try {
    let chunks: string[] = [];
    let token = options?.token;
    let model = options?.model;

    if (Array.isArray(chunksOrParams)) {
      chunks = chunksOrParams;
    } else if (chunksOrParams && typeof chunksOrParams === "object") {
      chunks = chunksOrParams.chunks || [];
      token = chunksOrParams.token || token;
      model = chunksOrParams.model || model;
    }

    if (!chunks || chunks.length === 0) {
      return [];
    }

    const apiKey =
      token ||
      process.env.HUGGINGFACE_API_KEY ||
      process.env.HF_TOKEN;

    const selectedModel =
      model ||
      process.env.HUGGINGFACE_EMBEDDING_MODEL ||
      DEFAULT_EMBEDDING_MODEL;

    // InferenceClient constructor expects (accessToken?: string)
    const hf = new InferenceClient(apiKey);

    // Sanitize chunks: replace empty or whitespace-only strings to prevent API errors
    const sanitizedChunks = chunks.map((chunk) => {
      const trimmed = chunk?.trim();
      return trimmed && trimmed.length > 0 ? trimmed : " ";
    });

    const BATCH_SIZE = 16;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < sanitizedChunks.length; i += BATCH_SIZE) {
      const batch = sanitizedChunks.slice(i, i + BATCH_SIZE);

      const response = await hf.featureExtraction(
        {
          model: selectedModel,
          inputs: batch,
        },
        {
          retry_on_error: true,
        }
      );

      if (Array.isArray(response)) {
        // If single chunk was sent and a 1D vector was returned directly
        if (batch.length === 1 && typeof response[0] === "number") {
          allEmbeddings.push(response as number[]);
        } else {
          for (const item of response) {
            allEmbeddings.push(normalizeToVector(item));
          }
        }
      } else {
        throw new Error("Unexpected response format from Hugging Face Inference API");
      }
    }

    return allEmbeddings;
  } catch (error: any) {
    console.error("Embedding generation error:", error?.message || error);
    throw new Error(
      `Failed to generate embeddings: ${error?.message || "Unknown error"}`
    );
  }
}