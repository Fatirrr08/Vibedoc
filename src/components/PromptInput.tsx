"use client";

import React, { useState } from "react";
import { Sparkles, StopCircle, SlidersHorizontal, ArrowRight } from "lucide-react";
import type { GenerateDocInput } from "@/types/document";

interface PromptInputProps {
  isStreaming: boolean;
  onGenerate: (input: GenerateDocInput) => void;
  onAbort: () => void;
}

export function PromptInput({ isStreaming, onGenerate, onAbort }: PromptInputProps) {
  const [idea, setIdea] = useState("");
  const [techPreferences, setTechPreferences] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (isStreaming) {
      onAbort();
      return;
    }

    const trimmedIdea = idea.trim();
    if (trimmedIdea.length < 5) {
      setValidationError("Tuliskan deskripsi ide proyek minimal 5 karakter.");
      return;
    }

    setValidationError(null);
    onGenerate({
      idea: trimmedIdea,
      techPreferences: techPreferences.trim(),
      targetAudience: targetAudience.trim(),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="w-full rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl backdrop-blur-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label
              htmlFor="project-idea"
              className="text-sm font-medium text-slate-200 flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4 text-indigo-400" />
              Ide Proyek atau Konsep Kasar
            </label>
            <span className="text-xs text-slate-400">
              {idea.length} / 3000 karakter
            </span>
          </div>

          <textarea
            id="project-idea"
            value={idea}
            onChange={(e) => {
              setIdea(e.target.value);
              if (validationError) setValidationError(null);
            }}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            rows={5}
            placeholder="Misal: Web app yang membantu developer vibe coding menghasilkan dokumen arsitektur dan spesifikasi teknis markdown siap pakai untuk context window AI IDE..."
            className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60 resize-y transition-all"
          />

          {validationError && (
            <p className="mt-1.5 text-xs text-rose-400 font-medium">
              {validationError}
            </p>
          )}
        </div>

        {/* Tombol toggle opsi lanjutan */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced((prev) => !prev)}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors py-1 cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {showAdvanced ? "Sembunyikan preferensi teknis" : "Tambah preferensi tech stack & audience (opsional)"}
          </button>
        </div>

        {/* Input Opsi Lanjutan */}
        {showAdvanced && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-800/60">
            <div>
              <label
                htmlFor="tech-preferences"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                Tech Stack Pilihan
              </label>
              <input
                id="tech-preferences"
                type="text"
                value={techPreferences}
                onChange={(e) => setTechPreferences(e.target.value)}
                disabled={isStreaming}
                placeholder="Next.js 15, Tailwind, Supabase, Gemini"
                className="w-full rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label
                htmlFor="target-audience"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                Target Audience / Pengguna
              </label>
              <input
                id="target-audience"
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                disabled={isStreaming}
                placeholder="Developer solo, freelance, small team"
                className="w-full rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <div className="hidden sm:block text-xs text-slate-500">
            Tekan <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">Cmd + Enter</kbd> untuk generate
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {isStreaming ? (
              <button
                type="button"
                onClick={onAbort}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600/90 hover:bg-rose-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-rose-900/30 transition-all cursor-pointer"
              >
                <StopCircle className="w-4 h-4 animate-pulse" />
                Hentikan Stream
              </button>
            ) : (
              <button
                type="submit"
                disabled={idea.trim().length < 5}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <span>Generate Spec & Architecture</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
