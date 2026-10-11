import { pipeline, env } from '@xenova/transformers';

// Disable local models search which causes problems with Webpack bundlers in Next.js
env.allowLocalModels = false;

// Configure caching location inside the workspace if possible, or use defaults
// By default it will use standard cache directory (.cache)
env.cacheDir = './.onnx_cache';

let extractor: any = null;

async function getExtractor() {
  if (!extractor) {
    try {
      extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    } catch (error) {
      console.error('Failed to initialize Xenova pipeline:', error);
      throw error;
    }
  }
  return extractor;
}

/**
 * Generates a 384-dimensional embedding for the input text using sentence-transformers/all-MiniLM-L6-v2.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const extract = await getExtractor();
  const output = await extract(texts, { pooling: 'mean', normalize: true });
  const [batchSize, embeddingDimensions] = output.dims;

  if (batchSize !== texts.length || output.data.length !== batchSize * embeddingDimensions) {
    throw new Error('Embedding model returned an unexpected batch shape');
  }

  return texts.map((_, index) => {
    const start = index * embeddingDimensions;
    return Array.from(output.data.slice(start, start + embeddingDimensions));
  });
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const [embedding] = await generateEmbeddings([text]);
  return embedding;
}
