import dataset from '../evaluation/ai-system/dataset.json';

describe('evaluation dataset', () => {
  it('contains valid evaluation cases', () => {
    expect(dataset.length).toBeGreaterThan(0);

    for (const item of dataset) {
      expect(item.question).toBeDefined();
      expect(item.expectedIntent).toBeDefined();
    }
  });
});
