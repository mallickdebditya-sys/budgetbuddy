import { GoogleGenAI } from "@google/genai";
import { GeminiDecisionOutput, GeminiNegotiateOutput, GeminiDigestOutput } from "./types";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";

const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const MODEL_LADDER = [
  "gemini-3.6-flash",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
  "gemini-3.7-flash",
];

function isQuotaOrModelError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes("quota") ||
      msg.includes("rate limit") ||
      msg.includes("429") ||
      msg.includes("model not found") ||
      msg.includes("unavailable") ||
      msg.includes("resource exhausted") ||
      msg.includes("503") ||
      msg.includes("500") ||
      msg.includes("internal") ||
      msg.includes("deadline exceeded")
    );
  }
  return false;
}

function isParseError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes("json") || msg.includes("parse") || msg.includes("schema") || msg.includes("unexpected");
  }
  return false;
}

async function callGeminiWithFallback<T>(
  prompt: string,
  schema: any,
  maxRetries = 2
): Promise<T> {
  let lastError: unknown;

  for (const model of MODEL_LADDER) {
    try {
      const result = await genAI.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
        },
      });
      const text = result.text ?? "";
      if (!text) throw new Error("Empty response from model");
      const parsed = JSON.parse(text);
      return parsed as T;
    } catch (err) {
      lastError = err;
      if (isQuotaOrModelError(err)) {
        console.warn(`Model ${model} failed with quota/server error; trying next model.`);
        continue; // try next model
      }
      if (isParseError(err)) {
        // Retry same model a couple of times on parse issues
        if (maxRetries > 0) {
          return callGeminiWithFallback<T>(prompt, schema, maxRetries - 1);
        }
        throw new Error("Unexpected AI response. Please retry.");
      }
      throw err; // re-throw on non-retryable errors
    }
  }

  console.error("All Gemini models exhausted.", lastError);
  throw new Error("AI service temporarily unavailable. Please try again later.");
}

export async function askBudgetBuddy(args: {
  budget: number;
  savingsGoal: number;
  remainingBudget: number;
  totalSpent: number;
  itemName: string;
  price: number;
  description?: string;
}): Promise<GeminiDecisionOutput> {
  const { budget, savingsGoal, remainingBudget, totalSpent, itemName, price, description } = args;

  const prompt = `You are BudgetBuddy, a friendly but firm shopping agent.

USER CONTEXT (facts from database — do not change these numbers):
- Monthly budget: $${budget}
- Savings goal: $${savingsGoal}
- Remaining budget this month: $${remainingBudget}
- Already spent this month: $${totalSpent}

WISHLIST ITEM:
- Name: ${itemName}
- Price: $${price}
- Description: ${description || "None provided"}

INSTRUCTIONS:
Recommend exactly ONE of: "buy_now", "wait", "skip".
Provide 1-2 sentences of reasoning referencing the actual budget numbers.
If "wait", suggest a specific timeframe.

Return ONLY valid JSON in this exact shape:
{
  "recommendation": "buy_now|wait|skip",
  "reasoning": "..."
}`;

  const schema = {
    type: "object",
    properties: {
      recommendation: { type: "string", enum: ["buy_now", "wait", "skip"] },
      reasoning: { type: "string" },
    },
    required: ["recommendation", "reasoning"],
  };

  return callGeminiWithFallback<GeminiDecisionOutput>(prompt, schema);
}

export async function negotiateBudgetBuddy(args: {
  budget: number;
  savingsGoal: number;
  remainingBudget: number;
  itemName: string;
  price: number;
  previousRecommendation: string;
  previousReasoning: string;
  userPlea: string;
}): Promise<GeminiNegotiateOutput> {
  const { budget, savingsGoal, remainingBudget, itemName, price, previousRecommendation, previousReasoning, userPlea } = args;

  const prompt = `You are BudgetBuddy.

USER CONTEXT (facts — immutable):
- Monthly budget: $${budget}
- Savings goal: $${savingsGoal}
- Remaining budget: $${remainingBudget}

ITEM:
- Name: ${itemName}
- Price: $${price}

PREVIOUS RECOMMENDATION: "${previousRecommendation}"
PREVIOUS REASONING: "${previousReasoning}"

USER PLEA: "${userPlea}"

INSTRUCTIONS:
The user is pushing back. Propose a compromise: wait X days, suggest a cheaper alternative, or propose a temporary "sinking fund" plan (set aside $Y/week). Be firm but kind. Do NOT recommend buying if remaining budget is less than price and it would break the savings goal.

Return ONLY valid JSON:
{
  "recommendation": "buy_now|wait|skip",
  "reasoning": "...",
  "compromise": "..."
}`;

  const schema = {
    type: "object",
    properties: {
      recommendation: { type: "string", enum: ["buy_now", "wait", "skip"] },
      reasoning: { type: "string" },
      compromise: { type: "string" },
    },
    required: ["recommendation", "reasoning", "compromise"],
  };

  return callGeminiWithFallback<GeminiNegotiateOutput>(prompt, schema);
}

export async function generateWeeklyDigest(args: {
  budget: number;
  savingsGoal: number;
  totalSpent: number;
  totalSaved: number;
  itemsBought: number;
  itemsSkipped: number;
  itemsWaited: number;
  decisionsList: string;
}): Promise<GeminiDigestOutput> {
  const { budget, savingsGoal, totalSpent, totalSaved, itemsBought, itemsSkipped, itemsWaited, decisionsList } = args;

  const prompt = `You are BudgetBuddy writing a weekly spending summary for your user.

FACTS (do not invent numbers):
- Starting budget: $${budget}
- Savings goal: $${savingsGoal}
- Total spent this week: $${totalSpent}
- Total saved: $${totalSaved}
- Items bought: ${itemsBought}
- Items skipped: ${itemsSkipped}
- Items waited on: ${itemsWaited}

RECENT DECISIONS:
${decisionsList}

Write a short, encouraging 3-5 sentence summary. Highlight whether they met their savings goal. Do not use markdown headers. Use plain text.

Return ONLY valid JSON:
{
  "summaryText": "..."
}`;

  const schema = {
    type: "object",
    properties: {
      summaryText: { type: "string" },
    },
    required: ["summaryText"],
  };

  return callGeminiWithFallback<GeminiDigestOutput>(prompt, schema);
}
