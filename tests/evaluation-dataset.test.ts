import dataset from '../evaluation/ai-system/dataset.json';

describe('evaluation dataset', () => {
  it('contains valid evaluation cases', () => {
    expect(dataset.length).toBeGreaterThan(0);

    for (const item of dataset) {
      expect(item.id).toEqual(expect.stringMatching(/\S+/));
      expect(item.question).toEqual(expect.stringMatching(/\S+/));
      expect(item.expectedIntent).toEqual(expect.stringMatching(/\S+/));
      expect(item.expectedBehavior).toEqual(expect.stringMatching(/\S+/));
      const sources = item.expectedSources;
      expect(Array.isArray(sources)).toBe(true);
      if (Array.isArray(sources)) {
        for (const source of sources) {
          expect(source.sourceType).toEqual(expect.stringMatching(/\S+/));
          expect(source.sourceId).toEqual(expect.anything());
        }
      }
    }
  });
});
