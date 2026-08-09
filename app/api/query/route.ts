import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generateEmbedding } from '@/lib/embedding';
import { getUserIdFromRequest } from '@/lib/auth';
import { GoogleGenAI } from '@google/genai';

export const maxDuration = 60; // 1 minute max duration for RAG answers

/**
 * POST /api/query
 * Receives question, document filter, and chat_id. Reformulates question,
 * queries Supabase vector & keyword index, streams answer, and saves conversation to DB.
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    const body = await req.json();
    const { question, document_ids, chat_id } = body;

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid question parameter' }, { status: 400 });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY environment variable is missing on the server.' }, { status: 500 });
    }

    // 1. If chat session is active, load recent message history and save user's question
    let history: any[] = [];
    if (chat_id) {
      // Save user message to database
      const { error: userMsgErr } = await supabase.from('messages').insert({
        chat_id: chat_id,
        role: 'user',
        content: question,
      });

      if (userMsgErr) {
        console.error('Error saving user message:', userMsgErr);
      }

      // Fetch last 6 messages to build conversational context (excluding raw citations to save context window tokens)
      const { data: dbHistory } = await supabase
        .from('messages')
        .select('role, content')
        .eq('chat_id', chat_id)
        .order('created_at', { ascending: false })
        .limit(6);

      if (dbHistory) {
        // Reverse because they were selected descending
        history = [...dbHistory].reverse();

        // Auto-rename chat to the first question if this is the first message
        if (dbHistory.length === 1) {
          const chatTitle = question.slice(0, 60).trim() || 'Naming...';
          await supabase
            .from('chats')
            .update({ title: chatTitle })
            .eq('id', chat_id);
        }
      }
    }

    // 2. Reformulate query if there is history (multi-turn RAG memory support)
    let searchPhrase = question;
    if (chat_id && history.length > 1) {
      try {
        const historyString = history
          .map((m: any) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
          .join('\n');
        
        const reformulatePrompt = `Given the conversation history and the latest user question, rewrite the question to be a standalone, search-friendly query. 
This standalone query will be used to look up documents. It must resolve pronoun references (like "it", "they", "first one") to explicit terms mentioned in the history.
DO NOT answer the question. Only output the reformulated search query.

Conversation History:
${historyString}

Latest Question: ${question}

Standalone Search Query:`;

        const aiTemp = new GoogleGenAI({ apiKey: geminiKey });
        const response = await aiTemp.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{ role: 'user', parts: [{ text: reformulatePrompt }] }],
        });

        if (response.text?.trim()) {
          searchPhrase = response.text.trim();
          console.log(`Reformulated query: "${question}" -> "${searchPhrase}"`);
        }
      } catch (refErr) {
        console.error('Error reformulating search phrase:', refErr);
        // Fallback to original question on error
      }
    }

    // 3. Generate query embedding (384-dimensional vector)
    let queryEmbedding: number[];
    try {
      queryEmbedding = await generateEmbedding(searchPhrase);
    } catch (embErr: any) {
      console.error('Error generating query embedding:', embErr);
      return NextResponse.json({ error: `Failed to embed query: ${embErr.message}` }, { status: 500 });
    }

    // 4. Perform vector + keyword hybrid search in Supabase using RPC function
    //    Only search within documents belonging to the current user
    let effectiveDocIds = Array.isArray(document_ids) && document_ids.length > 0 ? document_ids : null;

    // If no specific docs selected, scope to the user's documents
    if (!effectiveDocIds && userId) {
      const { data: userDocs } = await supabase
        .from('documents')
        .select('id')
        .eq('user_id', userId);
      if (userDocs && userDocs.length > 0) {
        effectiveDocIds = userDocs.map((d: any) => d.id);
      }
    } else if (!effectiveDocIds && !userId) {
      // Guest: scope to documents without a user_id
      const { data: guestDocs } = await supabase
        .from('documents')
        .select('id')
        .is('user_id', null);
      if (guestDocs && guestDocs.length > 0) {
        effectiveDocIds = guestDocs.map((d: any) => d.id);
      }
    }

    let matchedChunks: any[] = [];
    try {
      const { data, error: dbError } = await supabase.rpc('match_document_chunks', {
        query_embedding: queryEmbedding,
        query_text: searchPhrase,
        match_threshold: 0.1,
        match_count: 5,
        filter_document_ids: effectiveDocIds,
      });

      if (dbError) {
        throw dbError;
      }
      matchedChunks = data || [];
    } catch (dbErr: any) {
      console.error('Vector search error:', dbErr);
      return NextResponse.json({ error: `Supabase vector query failed: ${dbErr.message}` }, { status: 500 });
    }

    // 5. Compile context documents and citation sources
    const contextTexts: string[] = [];
    const citations: Array<{
      id: string;
      documentId: string;
      filename: string;
      pageNumber: number;
      content: string;
    }> = [];

    matchedChunks.forEach((chunk: any, index: number) => {
      const filename = chunk.metadata?.filename || 'Unknown Document';
      const pageNumber = chunk.metadata?.pageNumber || 1;
      
      contextTexts.push(
        `[Document #${index + 1}] Filename: ${filename}, Page: ${pageNumber}\nContent: ${chunk.content}`
      );

      citations.push({
        id: chunk.id,
        documentId: chunk.document_id,
        filename: filename,
        pageNumber: pageNumber,
        content: chunk.content,
      });
    });

    const contextString = contextTexts.length > 0 
      ? contextTexts.join('\n\n---\n\n') 
      : 'No relevant document snippets found.';

    // 6. Construct System Prompt & User prompt for Gemini
    const systemPrompt = `You are a helpful assistant that answers questions based strictly on the provided documents.

IMPORTANT RULES:
1. ONLY answer based on the provided document context. Do not use outside knowledge.
2. If the answer is not in the documents, clearly state: "This information is not available in the provided documents."
3. Always cite your sources in the text using format: (Source: document_name.pdf, page X). Mention the sources directly corresponding to your points.
4. If multiple documents are relevant, cite them appropriately.
5. Keep your response concise but comprehensive.
6. Use rich Markdown formatting to make your response well-structured and easy to read:
   - Use **bold** for key terms and important concepts.
   - Use bullet points or numbered lists when presenting multiple items.
   - Use headings (## or ###) to organize longer responses into sections.
   - Use > blockquotes for direct quotes from documents.
   - Use horizontal rules (---) to separate major sections when appropriate.`;

    const userPrompt = `${systemPrompt}

Context:
${contextString}

Question:
${question}

Answer:`;

    // 7. Initialize Gemini client and response stream
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send citations immediately as the first chunk in SSE format
          const citationsChunk = `event: citations\ndata: ${JSON.stringify(citations)}\n\n`;
          controller.enqueue(encoder.encode(citationsChunk));

          const responseStream = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: [
              {
                role: 'user',
                parts: [{ text: userPrompt }],
              },
            ],
          });

          let receivedText = '';

          for await (const chunk of responseStream) {
            if (chunk.text) {
              receivedText += chunk.text;
              const textChunk = `event: text\ndata: ${JSON.stringify({ text: chunk.text })}\n\n`;
              controller.enqueue(encoder.encode(textChunk));
            }
          }

          // 8. Save assistant's answer and citations to the database
          if (chat_id && receivedText.trim()) {
            const { error: assistantMsgErr } = await supabase.from('messages').insert({
              chat_id: chat_id,
              role: 'model',
              content: receivedText,
              citations: citations,
            });

            if (assistantMsgErr) {
              console.error('Error saving assistant message:', assistantMsgErr);
            }
          }
          
          controller.close();
        } catch (err: any) {
          console.error('Error in response streaming:', err);
          const errorChunk = `event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`;
          controller.enqueue(encoder.encode(errorChunk));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('API query route general error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
