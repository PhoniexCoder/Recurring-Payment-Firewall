// ==========================================
// LLM API Wrapper using AI SDK
// ==========================================

import { generateText, embed, embedMany } from "ai";

const DEFAULT_MODEL = "openai/gpt-4o-mini";
const EMBEDDING_MODEL = "openai/text-embedding-3-small";

/**
 * Call LLM with a prompt and return the response text
 */
export async function callLLM(prompt: string): Promise<string> {
  try {
    const { text } = await generateText({
      model: DEFAULT_MODEL,
      prompt,
      maxOutputTokens: 2000,
      temperature: 0.7,
    });

    return text;
  } catch (error) {
    console.error("LLM API error:", error);
    throw new Error("Failed to call LLM API");
  }
}

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const { embedding } = await embed({
      model: EMBEDDING_MODEL,
      value: text,
    });

    return embedding;
  } catch (error) {
    console.error("Embedding API error:", error);
    // Fallback to simple hash-based embedding for development
    return generateFallbackEmbedding(text);
  }
}

/**
 * Generate embeddings for multiple texts
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  try {
    const { embeddings } = await embedMany({
      model: EMBEDDING_MODEL,
      values: texts,
    });

    return embeddings;
  } catch (error) {
    console.error("Batch embedding API error:", error);
    // Fallback to simple hash-based embeddings for development
    return texts.map(generateFallbackEmbedding);
  }
}

/**
 * Fallback embedding generator for when API is unavailable
 * Uses a simple hash-based approach (not for production use)
 */
function generateFallbackEmbedding(text: string): number[] {
  const EMBEDDING_DIM = 1536; // OpenAI text-embedding-3-small dimension
  const embedding = new Array(EMBEDDING_DIM).fill(0);

  // Simple deterministic hash-based embedding
  const words = text.toLowerCase().split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    for (let j = 0; j < word.length; j++) {
      const idx = (word.charCodeAt(j) * (i + 1) * (j + 1)) % EMBEDDING_DIM;
      embedding[idx] += 1 / (i + 1);
    }
  }

  // Normalize
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= magnitude;
    }
  }

  return embedding;
}

/**
 * Build a prompt for explaining a merchant's risk assessment
 */
export function buildExplanationPrompt(
  merchantSummary: string,
  similarCases: string[]
): string {
  const casesText =
    similarCases.length > 0
      ? similarCases.map((c, i) => `Case ${i + 1}:\n${c}`).join("\n\n")
      : "No similar cases found in the knowledge base.";

  return `You are a fraud analyst assistant for a Recurring Payment Firewall system. Your task is to explain why a merchant was flagged for review and suggest concrete mitigation actions.

Given the following merchant's behavioral summary:

${merchantSummary}

And these similar past cases and documented patterns from our knowledge base:

${casesText}

Please provide:
1. A clear explanation (2-3 paragraphs) of why this merchant was classified with this risk level, referencing the specific metrics and patterns observed.
2. A list of 3-5 concrete, actionable recommendations for the analyst to take.

Format your response as follows:
EXPLANATION:
[Your explanation paragraphs here]

RECOMMENDED ACTIONS:
- [Action 1]
- [Action 2]
- [Action 3]
(etc.)`;
}

/**
 * Parse LLM response into explanation and actions
 */
export function parseExplanationResponse(response: string): {
  explanationText: string;
  recommendedActions: string[];
} {
  const explanationMatch = response.match(
    /EXPLANATION:\s*([\s\S]*?)(?=RECOMMENDED ACTIONS:|$)/i
  );
  const actionsMatch = response.match(/RECOMMENDED ACTIONS:\s*([\s\S]*?)$/i);

  const explanationText = explanationMatch
    ? explanationMatch[1].trim()
    : response.trim();

  let recommendedActions: string[] = [];
  if (actionsMatch) {
    recommendedActions = actionsMatch[1]
      .split(/\n/)
      .map((line) => line.replace(/^[-•*]\s*/, "").trim())
      .filter((line) => line.length > 0);
  }

  // If no actions were parsed, generate some generic ones
  if (recommendedActions.length === 0) {
    recommendedActions = [
      "Review merchant's recent transaction history",
      "Contact merchant for clarification on flagged patterns",
      "Monitor merchant activity closely for the next 30 days",
    ];
  }

  return { explanationText, recommendedActions };
}
