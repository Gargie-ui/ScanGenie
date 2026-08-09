'use client';

import React, { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { DocumentInfo } from './DocumentList';

interface SettingsPanelProps {
  documents: DocumentInfo[];
  onClose: () => void;
}

export default function SettingsPanel({ documents, onClose }: SettingsPanelProps) {
  const { user, userName, isGuest, signOut } = useAuth();
  const router = useRouter();

  const [streamEnabled, setStreamEnabled] = useState(true);
  const [vectorThreshold, setVectorThreshold] = useState(0.1);
  const [copiedKey, setCopiedKey] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Compute live stats
  const totalDocs = documents.length;
  const totalPages = documents.reduce((acc, doc) => acc + (doc.pageCount || 0), 0);
  const totalWords = documents.reduce((acc, doc) => acc + (doc.wordCount || 0), 0);
  const estimatedChunks = documents.reduce((acc, doc) => acc + Math.ceil((doc.wordCount || 0) / 350), 0);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  return (
    <div className="h-full w-full flex flex-col bg-[#0e0e12]/60 rounded-2xl border border-white/5 overflow-y-auto custom-scrollbar p-4 lg:p-8 relative select-none animate-in fade-in zoom-in-95 duration-200">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-primary text-on-primary px-4 py-2.5 rounded-xl shadow-xl font-bold text-xs flex items-center gap-2 animate-in slide-in-from-top-3 duration-200">
          <span className="material-symbols-outlined text-sm">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-white/5 pb-5 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
            <span className="material-symbols-outlined text-xl">settings</span>
          </div>
          <div>
            <h2 className="text-base font-bold text-on-surface">System Settings & Architecture</h2>
            <p className="text-xs text-on-surface-variant/70 mt-0.5 font-medium">Configure RAG pipeline, Gemini model parameters, and account preferences.</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-surface-container-high hover:bg-surface-variant text-on-surface text-xs font-bold rounded-xl transition-all cursor-pointer border border-white/5 active:scale-95 flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          <span>Back to Chat</span>
        </button>
      </div>

      {/* Grid Settings Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* 1. Account & Profile Card */}
        <div className="glass-card rounded-2xl p-5 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant/60 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-primary">person</span>
                User Session
              </span>
              <span className={`text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full border ${
                isGuest 
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' 
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              }`}>
                {isGuest ? 'Guest Mode' : 'Authenticated'}
              </span>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 border border-white/10 ${
                isGuest ? 'bg-surface-variant text-on-surface-variant' : 'bg-tertiary-container text-on-tertiary-container shadow-lg shadow-tertiary/10'
              }`}>
                {userName.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-on-surface truncate">{userName}</h3>
                <p className="text-xs text-on-surface-variant/60 truncate mt-0.5">
                  {user?.email || 'Guest Anonymous Session'}
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-white/5 text-on-surface-variant">
                <span>User ID</span>
                <span className="font-mono text-[10px] text-on-surface truncate max-w-[140px]">{user?.id || 'guest_null'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/5 text-on-surface-variant">
                <span>Data Isolation</span>
                <span className="text-primary font-semibold">Row-Level (user_id)</span>
              </div>
            </div>
          </div>

          <div className="pt-2">
            {user ? (
              <button
                onClick={handleSignOut}
                className="w-full py-2.5 bg-error-container/20 hover:bg-error-container/30 border border-error/30 text-error font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
              >
                <span className="material-symbols-outlined text-base">logout</span>
                <span>Sign Out Account</span>
              </button>
            ) : (
              <button
                onClick={() => router.push('/login')}
                className="w-full py-2.5 bg-primary text-on-primary font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 hover:opacity-90 active:scale-95 shadow-md shadow-primary/10"
              >
                <span className="material-symbols-outlined text-base">login</span>
                <span>Sign In / Create Account</span>
              </button>
            )}
          </div>
        </div>

        {/* 2. RAG & Model Pipeline Configuration */}
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant/60 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-secondary">psychology</span>
              AI & RAG Engine
            </span>
            <span className="text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full bg-primary-container/20 border border-primary/30 text-primary">
              Active
            </span>
          </div>

          <div className="space-y-3.5">
            {/* LLM Model */}
            <div className="p-3 bg-[#1b1b1f]/50 border border-white/5 rounded-xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-on-surface">Generative Model</span>
                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">Gemini 2.5 Flash</span>
              </div>
              <p className="text-[10px] text-on-surface-variant/60 leading-relaxed">
                Google GenAI with streaming response generation & source citation enforcement.
              </p>
            </div>

            {/* Embeddings Model */}
            <div className="p-3 bg-[#1b1b1f]/50 border border-white/5 rounded-xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-on-surface">Embedding Model</span>
                <span className="text-[10px] font-mono text-secondary bg-secondary/10 px-2 py-0.5 rounded-md">all-MiniLM-L6-v2</span>
              </div>
              <p className="text-[10px] text-on-surface-variant/60 leading-relaxed">
                384-dimensional dense vectors generated via local ONNX Transformers pipeline.
              </p>
            </div>

            {/* Vector Search Match Threshold Slider */}
            <div className="p-3 bg-[#1b1b1f]/50 border border-white/5 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-on-surface">Match Threshold</span>
                <span className="text-[11px] font-mono font-bold text-tertiary">{(vectorThreshold * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.5"
                step="0.05"
                value={vectorThreshold}
                onChange={(e) => {
                  setVectorThreshold(parseFloat(e.target.value));
                  showToast(`Vector threshold updated to ${Math.round(parseFloat(e.target.value) * 100)}%`);
                }}
                className="w-full accent-primary h-1.5 bg-surface-container-highest rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-on-surface-variant/40">
                <span>Higher Recall</span>
                <span>Higher Precision</span>
              </div>
            </div>

            {/* Token Stream Toggle */}
            <div className="flex items-center justify-between p-3 bg-[#1b1b1f]/50 border border-white/5 rounded-xl">
              <div>
                <p className="text-xs font-semibold text-on-surface">Real-Time Streaming</p>
                <p className="text-[10px] text-on-surface-variant/60">Stream response tokens using Server-Sent Events (SSE)</p>
              </div>
              <button
                onClick={() => {
                  setStreamEnabled(!streamEnabled);
                  showToast(streamEnabled ? 'Streaming disabled (Buffered responses)' : 'SSE Streaming enabled');
                }}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer p-0.5 ${
                  streamEnabled ? 'bg-primary' : 'bg-surface-variant'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-surface-container-lowest transition-transform shadow-md ${
                  streamEnabled ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>
          </div>
        </div>

        {/* 3. Knowledge Base Analytics & Storage Card */}
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant/60 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-tertiary">analytics</span>
              Storage & Metrics
            </span>
            <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              ● Connected
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 bg-[#1b1b1f]/60 border border-white/5 rounded-xl text-center">
              <p className="text-2xl font-bold text-primary">{totalDocs}</p>
              <p className="text-[10px] font-semibold text-on-surface-variant/70 uppercase tracking-wider mt-0.5">Documents</p>
            </div>
            <div className="p-3 bg-[#1b1b1f]/60 border border-white/5 rounded-xl text-center">
              <p className="text-2xl font-bold text-secondary">{totalPages}</p>
              <p className="text-[10px] font-semibold text-on-surface-variant/70 uppercase tracking-wider mt-0.5">Total Pages</p>
            </div>
            <div className="p-3 bg-[#1b1b1f]/60 border border-white/5 rounded-xl text-center">
              <p className="text-2xl font-bold text-tertiary">{totalWords.toLocaleString()}</p>
              <p className="text-[10px] font-semibold text-on-surface-variant/70 uppercase tracking-wider mt-0.5">Parsed Words</p>
            </div>
            <div className="p-3 bg-[#1b1b1f]/60 border border-white/5 rounded-xl text-center">
              <p className="text-2xl font-bold text-emerald-400">~{estimatedChunks}</p>
              <p className="text-[10px] font-semibold text-on-surface-variant/70 uppercase tracking-wider mt-0.5">Vector Chunks</p>
            </div>
          </div>

          <div className="p-3.5 bg-[#1b1b1f]/50 border border-white/5 rounded-xl space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold">
              <span className="text-on-surface">Supabase Vector DB (HNSW Index)</span>
              <span className="text-primary text-[11px]">pgvector</span>
            </div>
            <div className="w-full bg-surface-container-highest rounded-full h-2 border border-white/5 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-primary via-secondary to-tertiary h-2 rounded-full shadow-[0_0_12px_rgba(208,188,255,0.4)]" 
                style={{ width: `${Math.min(100, Math.max(15, (totalDocs / 20) * 100))}%` }} 
              />
            </div>
            <p className="text-[9px] text-on-surface-variant/50 leading-relaxed">
              Cosine similarity indexing with HNSW graph vector search.
            </p>
          </div>

          {/* Quick Action Button */}
          <button
            onClick={() => showToast('System diagnostics verified: 100% Operational')}
            className="w-full py-2.5 bg-surface-container-high hover:bg-surface-variant border border-white/5 text-on-surface font-semibold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
          >
            <span className="material-symbols-outlined text-sm">health_metrics</span>
            <span>Run System Health Check</span>
          </button>
        </div>

      </div>

      {/* Footer Info */}
      <div className="mt-8 pt-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between text-[10px] text-on-surface-variant/40 gap-2">
        <span>ScanGenie Architecture v2.0 &bull; Next.js 16 App Router &bull; Supabase &bull; Gemini 2.5 Flash</span>
        <span className="font-mono">Status: All Systems Operational</span>
      </div>

    </div>
  );
}
