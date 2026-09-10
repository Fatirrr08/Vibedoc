"use client";

import React, { useState } from "react";
import { PromptInput } from "@/components/PromptInput";
import { useVibeGenerator } from "@/hooks/useVibeGenerator";
import {
  FileCode2,
  Copy,
  Check,
  Trash2,
  AlertCircle,
  Cpu,
  Layers,
  Terminal,
} from "lucide-react";

export default function Home() {
  const { markdown, isStreaming, error, generateDoc, abortGeneration, clearOutput } =
    useVibeGenerator();

  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!markdown) return;
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#090d16] text-slate-100">
      {/* Header Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#090d16]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 shadow-md shadow-indigo-500/30">
              <FileCode2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-white sm:text-lg">
                  VibeDoc
                </span>
                <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-400">
                  MVP v0.1
                </span>
              </div>
              <p className="hidden text-[11px] text-slate-400 sm:block">
                AI Architecture & Spec Generator for Vibe Coding
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1 text-xs text-slate-400">
              <Cpu className="h-3.5 w-3.5 text-emerald-400" />
              <span className="font-mono text-[11px]">Gemini 2.5 Flash</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row">
        {/* Left Column: Input Form & Quick Guidelines */}
        <section className="flex w-full flex-col gap-4 lg:w-5/12">
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
              Ubah Ide Menjadi Dokumen Spesifikasi
            </h1>
            <p className="text-xs text-slate-400 sm:text-sm">
              Tuliskan ide kasar proyek Anda. VibeDoc akan men-generate dokumen 7 seksi yang padat konteks untuk AI IDE Anda.
            </p>
          </div>

          <PromptInput
            isStreaming={isStreaming}
            onGenerate={generateDoc}
            onAbort={abortGeneration}
          />

          {/* Quick Guide Card */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 text-xs text-slate-400 space-y-2.5">
            <div className="flex items-center gap-2 font-medium text-slate-300">
              <Layers className="h-4 w-4 text-indigo-400" />
              <span>7 Seksi Spesifikasi yang Dihasilkan</span>
            </div>
            <ul className="grid grid-cols-1 gap-1.5 pl-5 list-disc text-[11px] text-slate-400">
              <li>Project Overview & Objective</li>
              <li>Architecture & Tech Stack (dengan diagram Mermaid)</li>
              <li>Core Features & MVP Scope (checkbox)</li>
              <li>Database Schema / Data Structure</li>
              <li>API Spec / Key Workflows</li>
              <li>Step-by-Step Implementation Guide</li>
              <li>Conventions & Guidelines</li>
            </ul>
          </div>
        </section>

        {/* Right Column: Real-time Streaming Output Viewer */}
        <section className="flex w-full flex-1 flex-col rounded-2xl border border-slate-800 bg-slate-900/50 shadow-xl backdrop-blur-md overflow-hidden min-h-[500px]">
          {/* Output Panel Header */}
          <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-950/60 px-4 py-3">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-indigo-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Streaming Output (Markdown Spec)
              </span>
              {isStreaming && (
                <span className="flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-400 animate-pulse border border-indigo-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-ping" />
                  Streaming chunks...
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {markdown && (
                <>
                  <button
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
                    title="Salin Markdown"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Tersalin</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Salin</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={clearOutput}
                    disabled={isStreaming}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-400 hover:bg-rose-950/50 hover:text-rose-400 transition-colors disabled:opacity-50 cursor-pointer"
                    title="Hapus Tampilan"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Clear</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="m-4 flex items-start gap-3 rounded-xl border border-rose-800/50 bg-rose-950/30 p-3.5 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-rose-200">Gagal men-generate dokumen</p>
                <p className="text-rose-300/90 leading-relaxed">{error}</p>
                {error.includes("GEMINI_API_KEY") && (
                  <p className="text-[11px] text-rose-400 font-mono pt-1">
                    Petunjuk: Buat file .env.local dan isi: GEMINI_API_KEY=AIza...
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Output Content Display */}
          <div className="flex-1 p-4 overflow-y-auto font-mono text-xs text-slate-200 leading-relaxed selection:bg-indigo-500/30">
            {markdown ? (
              <pre className="whitespace-pre-wrap break-words font-mono text-xs text-slate-200">
                {markdown}
                {isStreaming && (
                  <span className="inline-block w-2 h-4 ml-1 bg-indigo-400 animate-pulse align-middle" />
                )}
              </pre>
            ) : (
              <div className="flex h-full min-h-[350px] flex-col items-center justify-center gap-3 text-center text-slate-500">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                  <FileCode2 className="h-8 w-8 text-slate-600" />
                </div>
                <div className="max-w-xs space-y-1">
                  <p className="font-medium text-slate-400 text-sm">Belum ada dokumen yang dibuat</p>
                  <p className="text-[11px] text-slate-500">
                    Masukkan ide proyek pada panel sebelah kiri lalu klik tombol Generate untuk memulai streaming spesifikasi teknis.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Output Footer Status */}
          {markdown && (
            <div className="flex items-center justify-between border-t border-slate-800/80 bg-slate-950/40 px-4 py-2 text-[11px] text-slate-500">
              <span>{markdown.length} karakter</span>
              <span>
                Estimasi token: ~{Math.ceil(markdown.length / 4)} token
              </span>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
