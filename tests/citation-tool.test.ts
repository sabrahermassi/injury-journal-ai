import { citationTool } from '../src/ai-agent/tools/citation-tool.js';

describe('citation tool', () => {
  it('creates citations from chunks', () => {
    const chunks = [
      {
        sourceType: 'treatment',
        sourceId: 42,
        injuryId: 1,
      },
    ];

    const result = citationTool(chunks, new Map([[1, 'Lower back pain']]));

    expect(result).toEqual([
      {
        sourceType: 'treatment',
        sourceId: 42,
        label: 'Treatment #42',
        injuryId: 1,
        injuryName: 'Lower back pain',
      },
    ]);
  });
});
