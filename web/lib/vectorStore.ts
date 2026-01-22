// ==========================================
// Vector Store Abstraction for RAG
// ==========================================

import { upsertRagDocument, getAllRagDocuments } from "./db";
import { generateEmbedding } from "./llm";
import type { RagDocument } from "./types";

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude > 0 ? dotProduct / magnitude : 0;
}

/**
 * Insert or update a RAG document with embedding
 */
export async function upsertDocument(doc: {
  docId: string;
  merchantId?: string;
  title: string;
  body: string;
  tags: string[];
}): Promise<void> {
  // Generate embedding for title + body
  const textToEmbed = `${doc.title}\n\n${doc.body}`;
  const embedding = await generateEmbedding(textToEmbed);

  const ragDocument: RagDocument = {
    ...doc,
    embedding,
  };

  await upsertRagDocument(ragDocument);
}

/**
 * Find similar documents using cosine similarity
 * This is a simple in-memory implementation
 * For production, use MongoDB Atlas Vector Search
 */
export async function similarDocuments(
  queryText: string,
  k: number = 5
): Promise<RagDocument[]> {
  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(queryText);

  // Get all documents
  const allDocs = await getAllRagDocuments();

  if (allDocs.length === 0) {
    return [];
  }

  // Calculate similarity scores
  const scored = allDocs.map((doc) => ({
    doc,
    score: cosineSimilarity(queryEmbedding, doc.embedding),
  }));

  // Sort by similarity (descending) and take top k
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, k).map((s) => s.doc);
}

/**
 * Find similar documents by embedding vector directly
 */
export async function similarDocumentsByEmbedding(
  queryEmbedding: number[],
  k: number = 5
): Promise<RagDocument[]> {
  // Get all documents
  const allDocs = await getAllRagDocuments();

  if (allDocs.length === 0) {
    return [];
  }

  // Calculate similarity scores
  const scored = allDocs.map((doc) => ({
    doc,
    score: cosineSimilarity(queryEmbedding, doc.embedding),
  }));

  // Sort by similarity (descending) and take top k
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, k).map((s) => s.doc);
}

/**
 * Search documents by tags
 */
export async function searchByTags(tags: string[]): Promise<RagDocument[]> {
  const allDocs = await getAllRagDocuments();

  return allDocs.filter((doc) =>
    tags.some((tag) => doc.tags.includes(tag))
  );
}

/**
 * Hybrid search: combine vector similarity with tag matching
 */
export async function hybridSearch(
  queryText: string,
  tags: string[],
  k: number = 5
): Promise<RagDocument[]> {
  const queryEmbedding = await generateEmbedding(queryText);
  const allDocs = await getAllRagDocuments();

  if (allDocs.length === 0) {
    return [];
  }

  // Calculate combined scores
  const scored = allDocs.map((doc) => {
    const vectorScore = cosineSimilarity(queryEmbedding, doc.embedding);
    const tagScore = tags.filter((tag) => doc.tags.includes(tag)).length / Math.max(tags.length, 1);
    
    // Weight vector similarity higher than tag matching
    const combinedScore = vectorScore * 0.7 + tagScore * 0.3;

    return { doc, score: combinedScore };
  });

  // Sort by combined score (descending) and take top k
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, k).map((s) => s.doc);
}
