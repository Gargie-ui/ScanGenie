const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    let value = parts.slice(1).join('=').trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
});

let supabaseUrl = env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;

if (supabaseUrl.endsWith('/rest/v1/')) {
  supabaseUrl = supabaseUrl.slice(0, -9);
} else if (supabaseUrl.endsWith('/rest/v1')) {
  supabaseUrl = supabaseUrl.slice(0, -8);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery() {
  const { pipeline } = await import('@xenova/transformers');
  
  console.log("Loading Xenova pipeline...");
  const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  
  const question = "name of all projects";
  console.log("Generating embedding locally for:", question);
  const output = await extractor(question, { pooling: 'mean', normalize: true });
  const queryEmbedding = Array.from(output.data);
  console.log("Generated vector dimension:", queryEmbedding.length);

  // Get document list
  const { data: docs } = await supabase.from('documents').select('*').eq('filename', 'PROJECTS.pdf');
  const docIds = docs.map(d => d.id);
  console.log("Document IDs for PROJECTS.pdf:", docIds);

  const { data, error } = await supabase.rpc('match_document_chunks', {
    query_embedding: queryEmbedding,
    query_text: question,
    match_threshold: 0.1,
    match_count: 5,
    filter_document_ids: docIds,
  });

  console.log("Error status:", error);
  console.log("Retrieved chunks count:", data ? data.length : 0);
  if (data) {
    data.forEach((chunk, index) => {
      console.log(`\n[Chunk ${index}] Similarity: ${chunk.similarity}`);
      console.log(chunk.content);
    });
  }
}

testQuery();
