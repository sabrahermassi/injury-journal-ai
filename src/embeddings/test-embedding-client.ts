import { embedText } from './embedding-client.js';

const result = await embedText(
  'The patient received physiotherapy with no improvement.',
);

console.log('Dimension:', result.dimension);
console.log('Model:', result.model);
console.log('Embedding length:', result.embedding.length);
