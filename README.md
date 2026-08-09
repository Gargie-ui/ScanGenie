# 🧞‍♂️ ScanGenie — AI Document Intelligence & RAG Platform

![Next.js](https://img.shields.io/badge/Next.js-16.2-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-pgvector-emerald?style=for-the-badge&logo=supabase)
![Google Gemini](https://img.shields.io/badge/Gemini-2.5_Flash-8E75FF?style=for-the-badge&logo=google)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38BDF8?style=for-the-badge&logo=tailwindcss)

**ScanGenie** is a full-stack Retrieval-Augmented Generation (RAG) platform that enables users to upload multi-format documents (PDF, DOCX, TXT), automatically vectorize their contents, and engage in accurate, multi-turn AI Q&A grounded strictly in their uploaded files.

Powered by **Next.js 16**, **Google Gemini 2.5 Flash**, **Supabase Vector Store (`pgvector`)**, and **Local ONNX Embeddings**, ScanGenie delivers instant, context-aware answers complete with page-level source citations.

---

## 🌟 Key Features

- 📄 **Multi-Format Document Ingestion**: Upload PDF, Word (`.docx`), and Plain Text (`.txt`) files up to 50MB with background text extraction and token chunking.
- 🧠 **Local Vector Embeddings**: Generates 384-dimensional dense embeddings in-browser/serverless using `@xenova/transformers` (`sentence-transformers/all-MiniLM-L6-v2`), eliminating third-party embedding costs.
- 🔍 **Hybrid Vector Search**: Utilizes Supabase `pgvector` and custom PostgreSQL RPC functions (`match_document_chunks`) for fast similarity retrieval.
- ⚡ **Real-Time Streaming Q&A**: Streamed responses powered by **Gemini 2.5 Flash** via Server-Sent Events (SSE) with conversational history memory.
- 📌 **Page-Level Source Citations**: Includes clickable inline page references (e.g., `PROJECTS.pdf, Page 1`) that display source context snippets in interactive popups.
- 🔒 **Auth & Guest Access**: Full user authentication via Supabase (Sign-In, Sign-Up, Password Reset / Forgot Password) plus a zero-friction **Guest Access Mode**.
- ✨ **Modern Glassmorphic UI**: Ultra-clean 2-column dark mode interface with responsive sidebar document search, slide-over upload modals, and quick query pills (*Summarize*, *Key Points*, *Compare*).

---

## 🛠️ Tech Stack

| Component | Technology |
| :--- | :--- |
| **Framework** | Next.js 16 (App Router, Turbopack), React 19, TypeScript |
| **Styling** | Tailwind CSS v4, Glassmorphism CSS, Google Material Symbols |
| **Database & Vector Store** | Supabase (PostgreSQL + `pgvector`), Custom RPC functions |
| **AI / LLM Engine** | Google Gemini 2.5 Flash (`@google/genai`) |
| **Embedding Pipeline** | `@xenova/transformers` (`sentence-transformers/all-MiniLM-L6-v2`) |
| **Document Parsers** | `pdf-parse`, `mammoth` |
| **Authentication** | Supabase Auth (Email/Password, Recovery, Session management) |
| **Deployment** | Vercel |

---

## 🏗️ System Architecture & Workflow

```
[ User Upload ] ──► [ Document Parser ] ──► [ Text Chunking ]
                                                   │
                                                   ▼
                                         [ Local ONNX Model ]
                                         (all-MiniLM-L6-v2)
                                                   │
                                                   ▼
[ User Question ] ──► [ Embedding ] ──► [ Supabase pgvector ]
                                                   │ (Vector Similarity Search)
                                                   ▼
[ SSE Stream Response ] ◄── [ Gemini 2.5 ] ◄── [ RAG Context + System Prompt ]
```

1. **Upload & Parse**: Documents are parsed (`pdf-parse` / `mammoth`) into text and split into overlapping chunks (500 words with 50-word overlap).
2. **Vectorization**: Chunks are embedded into 384-dimensional vectors via `@xenova/transformers` and stored in Supabase `document_chunks`.
3. **Similarity Search**: User questions are converted to embeddings and queried against Supabase using cosine distance via the `match_document_chunks` RPC function.
4. **Context Synthesis**: Retrieved chunks and conversational history are passed to Google Gemini 2.5 Flash to stream back verified answers with source citations.

---

## 🗄️ Database Setup (Supabase SQL)

Run the following script in your **Supabase SQL Editor** to create the required tables, vector extensions, and helper functions:

```sql
-- 1. Enable Vector Extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create Documents Table
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL,
    word_count INTEGER DEFAULT 0,
    page_count INTEGER DEFAULT 1,
    uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create Document Chunks Table with Vector Support
CREATE TABLE IF NOT EXISTS public.document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding vector(384),
    metadata JSONB
);

-- 4. Create Chats Table
CREATE TABLE IF NOT EXISTS public.chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Create Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    citations JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Disable Row Level Security (RLS) for serverless access
ALTER TABLE public.documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;

-- 7. Create Vector Search RPC Function
CREATE OR REPLACE FUNCTION public.match_document_chunks(
  query_embedding vector(384),
  query_text text,
  match_threshold double precision,
  match_count integer,
  filter_document_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  chunk_index integer,
  content text,
  metadata jsonb,
  similarity double precision
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.chunk_index,
    dc.content,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM public.document_chunks dc
  WHERE 
    (filter_document_ids IS NULL OR dc.document_id = ANY(filter_document_ids))
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

---

## ⚙️ Environment Variables Setup

Create a `.env` file in the root directory:

```env
SUPABASE_URL="https://your-supabase-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"
GEMINI_API_KEY="your-google-gemini-api-key"
```

---

## 🚀 Getting Started Locally

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/Gargie-ui/ScanGenie.git
   cd ScanGenie
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Run Development Server**:
   ```bash
   npm run dev
   ```

4. **Open Application**:
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📦 Deployment on Vercel

1. Push your code to GitHub.
2. Import the repository on [Vercel](https://vercel.com).
3. Add your `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `GEMINI_API_KEY` to Vercel **Environment Variables**.
4. Click **Deploy**.

---

## 📜 License

This project is licensed under the MIT License.
