'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { authFetch } from '@/lib/api';
import { CloudUpload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface DocumentUploadProps {
  onUploadSuccess: (data: { documentId: string; filename: string }) => void;
  onUploadStart?: (filename: string) => void;
  onUploadError?: (filename: string, errorMsg: string) => void;
}

export default function DocumentUpload({ 
  onUploadSuccess,
  onUploadStart,
  onUploadError
}: DocumentUploadProps) {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [uploadingFilename, setUploadingFilename] = useState<string>('');

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    if (file.size > 50 * 1024 * 1024) {
      setStatus('error');
      setErrorMsg('File size exceeds the 50MB limit.');
      if (onUploadError) onUploadError(file.name, 'File size exceeds 50MB');
      return;
    }

    setUploadingFilename(file.name);
    setStatus('uploading');
    setProgress(10);
    setErrorMsg('');
    if (onUploadStart) onUploadStart(file.name);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('filename', file.name);

      setProgress(30);

      const response = await authFetch('/api/documents', {
        method: 'POST',
        body: formData,
      });

      setProgress(60);
      setStatus('processing');

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process document');
      }

      setProgress(100);
      setStatus('success');
      onUploadSuccess({ documentId: data.documentId, filename: data.filename });
      
      setTimeout(() => {
        setStatus('idle');
        setProgress(0);
        setUploadingFilename('');
      }, 3000);

    } catch (err: any) {
      console.error(err);
      setStatus('error');
      const msg = err.message || 'An error occurred during file ingestion.';
      setErrorMsg(msg);
      if (onUploadError) onUploadError(file.name, msg);
    }
  }, [onUploadSuccess, onUploadStart, onUploadError]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
    },
    maxFiles: 1,
    disabled: status === 'uploading' || status === 'processing',
  });

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`relative group cursor-pointer outline-none ${
          status === 'uploading' || status === 'processing' ? 'cursor-not-allowed pointer-events-none' : ''
        }`}
      >
        {/* Dashed border */}
        <div 
          className={`absolute inset-0 border-2 border-dashed rounded-2xl transition-colors ${
            isDragActive 
              ? 'border-primary bg-primary/5' 
              : 'border-primary/30 group-hover:border-primary/60'
          }`}
        />

        <input {...getInputProps()} />

        {status === 'idle' && (
          <div className="relative py-8 lg:py-12 flex flex-col items-center justify-center text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform shadow-inner">
              <CloudUpload size={36} />
            </div>
            <div>
              <p className="font-body-lg text-[18px] font-semibold text-on-surface">
                {isDragActive ? 'Drop the file here' : 'Drag & drop your document here'}
              </p>
              <p className="font-body-md text-on-surface-variant text-sm mt-1">
                Supports PDF, DOCX, or TXT (Max 50MB)
              </p>
            </div>
            <button
              type="button"
              className="mt-2 px-8 py-2.5 bg-primary text-on-primary font-bold rounded-full hover:shadow-xl shadow-primary/20 transition-all active:scale-95 cursor-pointer"
            >
              Browse Files
            </button>
          </div>
        )}

        {(status === 'uploading' || status === 'processing') && (
          <div className="relative py-8 lg:py-12 flex flex-col items-center justify-center text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center text-primary animate-pulse">
              <Loader2 size={36} className="animate-spin" style={{ animationDuration: '3s' }} />
            </div>
            <div>
              <p className="font-body-lg text-[18px] font-semibold text-primary">
                {status === 'uploading' ? 'Uploading file...' : 'Extracting & Ingesting...'}
              </p>
              <p className="text-xs text-on-surface-variant truncate max-w-[200px] mt-1 mx-auto px-4">
                {uploadingFilename}
              </p>
            </div>
            <div className="w-full bg-surface-container-highest rounded-full h-1.5 max-w-[200px] overflow-hidden">
              <div 
                className="bg-primary h-1.5 rounded-full transition-all duration-300 ease-out" 
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="relative py-8 lg:py-12 flex flex-col items-center justify-center text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-secondary-container/10 border border-secondary-container/20 text-secondary-container flex items-center justify-center shadow-md">
              <CheckCircle2 size={36} />
            </div>
            <div>
              <p className="font-body-lg text-[18px] font-semibold text-secondary-container">Document Ingested!</p>
              <p className="text-xs text-on-surface-variant truncate max-w-[200px] mt-1 mx-auto">
                {uploadingFilename} vectorized.
              </p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="relative py-8 lg:py-12 flex flex-col items-center justify-center text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-error-container/20 border border-error/20 text-error flex items-center justify-center shadow-md">
              <AlertCircle size={36} />
            </div>
            <div>
              <p className="font-body-lg text-[18px] font-semibold text-error">Ingestion Failed</p>
              <p className="text-xs text-error/85 mt-1 max-w-[220px] mx-auto leading-relaxed truncate">
                {errorMsg}
              </p>
            </div>
            <span className="text-xs text-primary hover:underline font-bold transition-all">
              Try again
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
