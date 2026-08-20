import { citationTool } from '../src/ai-agent/tools/citation-tool.js';

describe('citation tool', () => {
  it('creates citations from chunks', () => {
    const chunks = [
      {
        sourceType: 'treatment',
        sourceId: 42,
      },
    ];

    const result = citationTool(chunks);

    expect(result).toEqual([
      {
        sourceType: 'treatment',
        sourceId: 42,
        label: 'Treatment #42',
      },
    ]);
  });
});
