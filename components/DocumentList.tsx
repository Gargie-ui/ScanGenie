'use client';

import React, { useState, useEffect } from 'react';
import { authFetch } from '@/lib/api';
import { FileText, Loader2, MoreVertical, Trash2 } from 'lucide-react';

export interface DocumentInfo {
  id: string;
  filename: string;
  fileUrl: string;
  fileType: string;
  wordCount: number;
  pageCount: number;
  uploadedAt: Date;
}

interface DocumentListProps {
  documents: DocumentInfo[];
  selectedDocId: string | null;
  onSelectDoc: (id: string | null) => void;
  onDeleteSuccess: () => void;
  isLoading: boolean;
  indexingFiles?: { filename: string; pageCount: number; uploadedAt: Date }[];
  failedFiles?: { filename: string; pageCount: number; reason: string }[];
  searchQuery: string;
}

export default function DocumentList({
  documents,
  selectedDocId,
  onSelectDoc,
  onDeleteSuccess,
  isLoading,
  indexingFiles = [],
  failedFiles = [],
  searchQuery,
}: DocumentListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Close active dropdown menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-menu-container]')) {
        setActiveMenuId(null);
      }
    };

    if (activeMenuId) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [activeMenuId]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this document? This will permanently delete the text embeddings.')) {
      return;
    }

    setDeletingId(id);
    try {
      const response = await authFetch(`/api/documents/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete document');
      }
      onDeleteSuccess();
    } catch (error) {
      console.error(error);
      alert('Failed to delete document.');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
    });
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') {
      return (
        <div className="w-8 h-8 rounded-lg bg-error/10 flex flex-col items-center justify-center shrink-0 border border-error/10">
          <FileText size={16} className="text-error" />
        </div>
      );
    } else if (ext === 'docx' || ext === 'doc') {
      return (
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex flex-col items-center justify-center shrink-0 border border-primary/10">
          <FileText size={16} className="text-primary" />
        </div>
      );
    } else {
      return (
        <div className="w-8 h-8 rounded-lg bg-tertiary/10 flex flex-col items-center justify-center shrink-0 border border-tertiary/10">
          <FileText size={16} className="text-tertiary" />
        </div>
      );
    }
  };

  // Filter documents by search query
  const filteredDocs = documents.filter(doc => 
    doc.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full space-y-1.5 pr-1">
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-6 text-on-surface-variant select-none">
          <Loader2 size={18} className="text-primary animate-spin" />
          <span className="text-[10px] mt-1 font-medium">Loading...</span>
        </div>
      ) : filteredDocs.length === 0 && indexingFiles.length === 0 && failedFiles.length === 0 ? (
        <div className="py-6 text-center text-on-surface-variant/40 text-[10px] select-none italic">
          No files uploaded.
        </div>
      ) : (
        <>
          {/* 1. Render indexing files */}
          {indexingFiles.map((file, idx) => (
            <div
              key={`indexing-${idx}`}
              className="flex items-center gap-2 p-2 rounded-xl border border-white/5 bg-[#1b1b1f]/20 opacity-75 shadow-sm select-none"
            >
              {getFileIcon(file.filename)}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold truncate text-on-surface leading-tight" title={file.filename}>
                  {file.filename}
                </p>
                <p className="text-[9px] text-amber-400 mt-0.5 animate-pulse font-medium">
                  Indexing...
                </p>
              </div>
            </div>
          ))}

          {/* 2. Render failed files */}
          {failedFiles.map((file, idx) => (
            <div
              key={`failed-${idx}`}
              className="flex items-center gap-2 p-2 rounded-xl border border-error/10 bg-error/5 opacity-80 shadow-sm select-none"
            >
              {getFileIcon(file.filename)}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold truncate text-on-surface leading-tight" title={file.filename}>
                  {file.filename}
                </p>
                <p className="text-[9px] text-error mt-0.5 font-medium">
                  Failed
                </p>
              </div>
            </div>
          ))}

          {/* 3. Render indexed documents */}
          {filteredDocs.map((doc) => {
            const isSelected = selectedDocId === doc.id;
            const isDeleting = deletingId === doc.id;
            const isMenuActive = activeMenuId === doc.id;

            return (
              <div
                key={doc.id}
                onClick={() => onSelectDoc(isSelected ? null : doc.id)}
                style={{ zIndex: isMenuActive ? 30 : 'auto' }}
                className={`group relative flex items-center gap-2 p-2 rounded-xl border transition-all cursor-pointer shadow-sm ${
                  isSelected
                    ? 'border-primary bg-primary/15 shadow-[0_0_10px_rgba(208,188,255,0.06)]'
                    : 'border-white/5 bg-[#1b1b1f]/35 hover:bg-[#25252b]/55 hover:border-white/10'
                } ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {getFileIcon(doc.filename)}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold truncate text-on-surface leading-tight" title={doc.filename}>
                    {doc.filename}
                  </p>
                  <p className="text-[9px] text-on-surface-variant/60 mt-0.5 leading-none">
                    {doc.pageCount} p • {formatDate(doc.uploadedAt)}
                  </p>
                </div>

                <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                  {/* Floating context menu button */}
                  <div className="relative" data-menu-container>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(activeMenuId === doc.id ? null : doc.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 hover:bg-surface-variant/60 p-1 rounded transition-all text-on-surface-variant hover:text-on-surface cursor-pointer flex"
                    >
                      <MoreVertical size={12} />
                    </button>

                    {/* Dropdown Menu for Deletion */}
                    {activeMenuId === doc.id && (
                      <div className="absolute right-0 top-5 bg-[#13121a] border border-white/10 rounded-xl shadow-2xl z-30 py-1 text-xs min-w-[110px] overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                        <button
                          onClick={(e) => {
                            handleDelete(doc.id, e);
                            setActiveMenuId(null);
                          }}
                          disabled={isDeleting}
                          className="w-full text-left px-3 py-1.5 hover:bg-rose-500/10 hover:text-rose-400 text-gray-300 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 size={12} className="shrink-0" />
                          <span className="font-semibold text-[10px]">Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
