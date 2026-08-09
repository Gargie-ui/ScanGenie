'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DocumentUpload from '@/components/DocumentUpload';
import DocumentList, { DocumentInfo } from '@/components/DocumentList';
import ChatInterface from '@/components/ChatInterface';
import SettingsPanel from '@/components/SettingsPanel';
import { useAuth } from '@/components/AuthProvider';
import { authFetch } from '@/lib/api';
import { Sparkles, Plus, Upload, Search, MessageCircle, X, ChevronDown, Settings, LogOut, LogIn } from 'lucide-react';

export default function Dashboard() {
  const { user, userName, isGuest, isLoading: authLoading, signOut } = useAuth();
  const router = useRouter();

  // Auth gate: redirect to /login if not authenticated and not a guest
  useEffect(() => {
    if (!authLoading && !user && !isGuest) {
      router.replace('/login');
    }
  }, [authLoading, user, isGuest, router]);

  // Derive display info
  const displayName = userName || (isGuest ? 'Guest' : 'User');
  const displayInitials = displayName.slice(0, 2).toUpperCase();
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Dynamic indexing and failed file states
  const [indexingFiles, setIndexingFiles] = useState<{ filename: string; pageCount: number; uploadedAt: Date }[]>([]);
  const [failedFiles, setFailedFiles] = useState<{ filename: string; pageCount: number; reason: string }[]>([]);
  
  const [activeTab, setActiveTab] = useState<'chat' | 'settings'>('chat');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Sidebar section collapse state
  const [chatsOpen, setChatsOpen] = useState<boolean>(true);
  const [docsOpen, setDocsOpen] = useState<boolean>(true);

  // Upload modal dialog visibility state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);

  // Chat sessions state
  const [chats, setChats] = useState<any[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  // Fetch all documents on component load
  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      const response = await authFetch('/api/documents');
      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }
      const data = await response.json();
      setDocuments(data);
    } catch (error) {
      console.error('Error fetching documents list:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch all chat conversations
  const fetchChats = async (selectLatest = false) => {
    try {
      const response = await authFetch('/api/chats');
      if (response.ok) {
        const data = await response.json();
        setChats(data);
        if (data.length > 0 && (selectLatest || !selectedChatId)) {
          setSelectedChatId(data[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching chat sessions:', err);
    }
  };

  useEffect(() => {
    fetchDocuments();
    fetchChats(true);
  }, []);

  const handleUploadStart = (filename: string) => {
    setIndexingFiles((prev) => [
      ...prev,
      { 
        filename, 
        pageCount: Math.floor(Math.random() * 25) + 5, 
        uploadedAt: new Date() 
      }
    ]);
  };

  const handleUploadSuccess = () => {
    fetchDocuments();
    setIndexingFiles([]);
  };

  const handleUploadError = (filename: string, errorMsg: string) => {
    setIndexingFiles([]);
    setFailedFiles((prev) => [
      ...prev,
      { filename, pageCount: 1, reason: errorMsg }
    ]);
    setTimeout(() => {
      setFailedFiles((prev) => prev.filter(f => f.filename !== filename));
    }, 6000);
  };

  const handleDeleteSuccess = () => {
    fetchDocuments();
    setSelectedDocId(null);
    setSelectedDocIds([]);
  };

  // Conversation session controllers
  const handleCreateChat = async () => {
    try {
      const response = await authFetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Naming...' }),
      });
      if (response.ok) {
        const newChat = await response.json();
        setChats((prev) => [newChat, ...prev]);
        setSelectedChatId(newChat.id);
        
        // Reset document selection for a clean new chat scope
        setSelectedDocId(null);
        setSelectedDocIds([]);
        setActiveTab('chat');
      }
    } catch (err) {
      console.error('Error creating chat session:', err);
    }
  };

  const handleChatCreated = (newChatId: string) => {
    fetchChats(false);
    setSelectedChatId(newChatId);
  };

  const selectTab = (tabName: 'chat' | 'settings') => {
    setActiveTab(tabName);
  };

  const handleSelectDoc = (id: string | null) => {
    setSelectedDocId(id);
    setSelectedDocIds(id ? [id] : []);
    setActiveTab('chat');
  };

  // Show loading while auth state resolves
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0d] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-xs text-on-surface-variant/50 font-medium">Loading ScanGenie...</p>
        </div>
      </div>
    );
  }

  // Don't render dashboard if not authenticated (redirect will happen)
  if (!user && !isGuest) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0d] text-on-surface flex font-sans overflow-x-hidden antialiased">
      
      {/* 1. Left Sidebar Navigation (Narrow 200px Width) */}
      <aside 
        style={{ width: '200px', boxShadow: 'inset -1px 0 0 0 rgba(255, 255, 255, 0.04)' }}
        className="fixed left-0 top-0 h-screen bg-[#0e0e12]/60 flex flex-col justify-between py-5 z-40 backdrop-blur-2xl border-r border-white/5 select-none"
      >
        <div className="flex flex-col h-[80%] overflow-hidden">
          
          {/* Logo & Product Name Only */}
          <div className="px-4 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center border border-white/5 shadow-md shrink-0">
                <Sparkles size={16} className="text-on-primary-container" />
              </div>
              <h1 className="text-sm font-bold text-on-surface tracking-tight truncate">ScanGenie</h1>
            </div>
          </div>

          {/* "+ New chat" & "Upload" buttons */}
          <div className="px-3 space-y-1.5 shrink-0">
            <button 
              onClick={handleCreateChat} 
              className="w-full py-2 px-3 bg-primary text-on-primary text-[11px] font-bold rounded-lg flex items-center justify-center gap-1.5 hover:opacity-90 active:scale-95 transition-all shadow-md shadow-primary/10 cursor-pointer border border-white/10"
            >
              <Plus size={14} strokeWidth={2.5} />
              <span>New Chat</span>
            </button>
            <button 
              onClick={() => setIsUploadModalOpen(true)} 
              className="w-full py-2 px-3 bg-surface-container-high hover:bg-surface-variant text-on-surface text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-white/5"
            >
              <Upload size={14} strokeWidth={2} />
              <span>Upload File</span>
            </button>
          </div>

          {/* Search bar for documents */}
          <div className="px-3 mt-4 shrink-0">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant/70 select-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search docs..."
                className="w-full pl-8 pr-2.5 py-1.5 bg-[#1b1b1f]/35 border border-white/5 focus:border-primary/45 rounded-lg outline-none text-[10px] text-on-surface placeholder-on-surface-variant/40 font-body-md"
              />
            </div>
          </div>

          {/* Scrollable sidebar content: Chats + Documents */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-2 mt-4 space-y-1">

            {/* Chat History Section */}
            <button
              onClick={() => setChatsOpen(!chatsOpen)}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-white/[0.03] transition-colors cursor-pointer select-none group/hdr"
            >
              <span className="text-[8px] uppercase tracking-widest text-on-surface-variant/40 font-bold group-hover/hdr:text-on-surface-variant/60 transition-colors">Chats</span>
              <ChevronDown size={12} className={`text-on-surface-variant/30 transition-transform duration-200 ${chatsOpen ? 'rotate-0' : '-rotate-90'}`} />
            </button>
            {chatsOpen && (
              chats.length === 0 ? (
                <div className="py-3 text-center text-on-surface-variant/40 text-[10px] select-none italic">
                  No conversations yet.
                </div>
              ) : (
                <div className="space-y-0.5 mb-3">
                  {chats.map((chat) => {
                    const isActive = selectedChatId === chat.id;
                    const chatDate = new Date(chat.created_at);
                    const dateLabel = chatDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
                    return (
                      <div
                        key={chat.id}
                        onClick={() => {
                          setSelectedChatId(chat.id);
                          setActiveTab('chat');
                        }}
                        className={`group relative flex items-center gap-2 p-2 rounded-xl border transition-all cursor-pointer ${
                          isActive
                            ? 'border-primary/30 bg-primary/10 shadow-[0_0_8px_rgba(208,188,255,0.05)]'
                            : 'border-transparent hover:bg-[#25252b]/55 hover:border-white/5'
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isActive ? 'bg-primary/20 text-primary' : 'bg-[#1b1b1f]/50 text-on-surface-variant/60'
                        }`}>
                          <MessageCircle size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[11px] font-semibold truncate leading-tight ${isActive ? 'text-primary' : 'text-on-surface'} ${chat.title === 'Naming...' ? 'italic animate-pulse opacity-60' : ''}`}>
                            {chat.title || 'Untitled'}
                          </p>
                          <p className="text-[9px] text-on-surface-variant/50 mt-0.5 leading-none">
                            {dateLabel}
                          </p>
                        </div>
                        {/* Delete chat button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Delete this chat and all its messages?')) {
                              authFetch(`/api/chats/${chat.id}`, { method: 'DELETE' })
                                .then((res) => {
                                  if (res.ok) {
                                    setChats((prev) => prev.filter((c) => c.id !== chat.id));
                                    if (selectedChatId === chat.id) {
                                      setSelectedChatId(null);
                                    }
                                  }
                                })
                                .catch(console.error);
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-error/10 hover:text-error text-on-surface-variant/50 rounded-lg transition-all cursor-pointer flex shrink-0"
                          title="Delete chat"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* Documents Section */}
            <button
              onClick={() => setDocsOpen(!docsOpen)}
              className="w-full flex items-center justify-between px-2 py-1.5 mt-1 rounded-lg hover:bg-white/[0.03] transition-colors cursor-pointer select-none group/hdr"
            >
              <span className="text-[8px] uppercase tracking-widest text-on-surface-variant/40 font-bold group-hover/hdr:text-on-surface-variant/60 transition-colors">Documents</span>
              <ChevronDown size={12} className={`text-on-surface-variant/30 transition-transform duration-200 ${docsOpen ? 'rotate-0' : '-rotate-90'}`} />
            </button>
            {docsOpen && (
              <DocumentList
                documents={documents}
                selectedDocId={selectedDocId}
                onSelectDoc={handleSelectDoc}
                onDeleteSuccess={handleDeleteSuccess}
                isLoading={isLoading}
                indexingFiles={indexingFiles}
                failedFiles={failedFiles}
                searchQuery={searchQuery}
              />
            )}
          </div>

        </div>

        {/* User Profile & Settings (Pinned Bottom) */}
        <div className="shrink-0 space-y-1">
          {/* User profile pinned bottom */}
          <div className="px-3 py-2 border-t border-white/5 bg-[#1b1b1f]/20 flex items-center justify-between select-none">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 border border-white/10 ${
                isGuest ? 'bg-surface-variant text-on-surface-variant' : 'bg-tertiary-container text-on-tertiary-container'
              }`}>
                {displayInitials}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-on-surface truncate">{displayName}</p>
                {isGuest && (
                  <p className="text-[8px] text-on-surface-variant/50 uppercase tracking-wider font-semibold leading-none">Guest Mode</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => selectTab(activeTab === 'settings' ? 'chat' : 'settings')}
                className={`p-1 rounded-lg transition-colors cursor-pointer flex ${
                  activeTab === 'settings' ? 'text-primary bg-primary-container/20' : 'text-on-surface-variant/70 hover:bg-surface-variant/50 hover:text-on-surface'
                }`}
                title="Settings"
              >
                <Settings size={16} />
              </button>
              {user ? (
                <button
                  onClick={async () => { await signOut(); router.replace('/login'); }}
                  className="p-1 hover:bg-error/10 text-on-surface-variant hover:text-error rounded-lg cursor-pointer flex"
                  title="Sign Out"
                >
                  <LogOut size={16} />
                </button>
              ) : (
                <button
                  onClick={() => router.push('/login')}
                  className="p-1 hover:bg-primary/10 text-on-surface-variant hover:text-primary rounded-lg cursor-pointer flex"
                  title="Sign In"
                >
                  <LogIn size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* 2. Main Workspace Panel (Full height layout) */}
      <main style={{ marginLeft: '200px' }} className="flex-1 p-3 h-screen flex flex-col justify-stretch overflow-hidden">
        {activeTab === 'chat' ? (
          <div className="w-full h-full flex-1 flex flex-col min-h-0">
            <ChatInterface
              selectedDocIds={selectedDocIds}
              documentsCount={documents.length}
              activeChatId={selectedChatId}
              onChatCreated={handleChatCreated}
              onChatsChanged={() => fetchChats()}
              onAttachFile={() => setIsUploadModalOpen(true)}
              documents={documents}
            />
          </div>
        ) : (
          /* Settings workspace panel */
          <div className="w-full h-full flex-1 flex flex-col min-h-0">
            <SettingsPanel 
              documents={documents} 
              onClose={() => selectTab('chat')} 
            />
          </div>
        )}
      </main>

      {/* 3. Ingestion Portal Modal Overlay */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#131317] border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 relative animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2 select-none">
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-base">cloud_upload</span>
                Upload New Document
              </h3>
              <button 
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50 rounded-lg cursor-pointer flex"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
            <div data-dropzone>
              <DocumentUpload 
                onUploadStart={(filename) => {
                  handleUploadStart(filename);
                  setIsUploadModalOpen(false); // Close modal when upload starts so they see indexing stats in the sidebar documents list!
                }}
                onUploadSuccess={handleUploadSuccess}
                onUploadError={handleUploadError}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
