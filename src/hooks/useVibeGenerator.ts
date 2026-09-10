"use client";

import { useState, useRef, useCallback } from "react";
import type { GenerateDocInput } from "@/types/document";

interface UseVibeGeneratorReturn {
  markdown: string;
  isStreaming: boolean;
  error: string | null;
  generateDoc: (input: GenerateDocInput) => Promise<void>;
  abortGeneration: () => void;
  clearOutput: () => void;
}

export function useVibeGenerator(): UseVibeGeneratorReturn {
  const [markdown, setMarkdown] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const abortGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  }, []);

  const clearOutput = useCallback(() => {
    abortGeneration();
    setMarkdown("");
    setError(null);
  }, [abortGeneration]);

  const generateDoc = useCallback(
    async (input: GenerateDocInput) => {
      // Batalkan request yang sedang aktif jika ada
      abortGeneration();

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsStreaming(true);
      setError(null);
      setMarkdown("");

      try {
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          const message =
            errorData?.message ||
            `Server merespon dengan status ${response.status} (${response.statusText})`;
          throw new Error(message);
        }

        if (!response.body) {
          throw new Error("Response body tidak tersedia untuk streaming.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          accumulatedText += chunk;
          setMarkdown(accumulatedText);
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // Request dibatalkan secara sengaja oleh pengguna
          return;
        }

        const errorMessage =
          err instanceof Error
            ? err.message
            : "Terjadi kesalahan saat men-generate spesifikasi.";
        setError(errorMessage);
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [abortGeneration]
  );

  return {
    markdown,
    isStreaming,
    error,
    generateDoc,
    abortGeneration,
    clearOutput,
  };
}
