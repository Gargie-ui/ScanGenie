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
export async function generateEmbedding(text: string): Promise<number[]> {
  const extract = await getExtractor();
  const output = await extract(text, { pooling: 'mean', normalize: true });
  
  // output is a Tensor, output.data is a Float32Array
  return Array.from(output.data);
}
