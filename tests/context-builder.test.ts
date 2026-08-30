import { buildContext } from '../src/rag/context-builder.js';

describe('buildContext', () => {
  it('builds context from retrieved chunks', () => {
    const context = buildContext(
      [
        {
          content: 'Shockwave therapy did not help.',
          injuryId: 1,
        },
        {
          content: 'Injection reduced pain temporarily.',
          injuryId: 1,
        },
      ],
      new Map([[1, 'Lower back pain']]),
    );

    expect(context).toContain('Shockwave therapy did not help.');

    expect(context).toContain('Injection reduced pain temporarily.');
  });

  it('returns empty string for no chunks', () => {
    expect(buildContext([], new Map())).toBe('');
  });

  it('labels each source with its injury name so the model does not conflate injuries', () => {
    const context = buildContext(
      [
        { content: 'Shockwave therapy did not help.', injuryId: 1 },
        { content: 'Foam rolling and rest helped.', injuryId: 4 },
      ],
      new Map([
        [1, 'Lower back pain'],
        [4, 'Right knee pain'],
      ]),
    );

    expect(context).toContain('Source 1 (Injury: Lower back pain (#1)):');
    expect(context).toContain('Source 2 (Injury: Right knee pain (#4)):');
  });

  it('falls back to a generic label when the injury name is unknown', () => {
    const context = buildContext(
      [{ content: 'Some note.', injuryId: 7 }],
      new Map(),
    );

    expect(context).toContain('Source 1 (Injury: Injury #7 (#7)):');
  });

  it('appends the injury id even when two injuries share the same name', () => {
    const context = buildContext(
      [
        { content: 'Cortisone shot helped.', injuryId: 2 },
        { content: 'Physical therapy helped more.', injuryId: 5 },
      ],
      new Map([
        [2, 'Knee pain'],
        [5, 'Knee pain'],
      ]),
    );

    expect(context).toContain('Source 1 (Injury: Knee pain (#2)):');
    expect(context).toContain('Source 2 (Injury: Knee pain (#5)):');
  });
});
