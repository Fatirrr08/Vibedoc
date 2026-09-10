import { GoogleGenAI } from "@google/genai";

export const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

let cachedClient: GoogleGenAI | null = null;

/**
 * Mendapatkan client GoogleGenAI singleton.
 * Melempar error informatif jika GEMINI_API_KEY belum diset di environment.
 */
export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY belum dikonfigurasi. Silakan tambahkan GEMINI_API_KEY=<api_key_anda> pada file .env.local."
    );
  }

  if (!cachedClient) {
    cachedClient = new GoogleGenAI({ apiKey });
  }

  return cachedClient;
}
