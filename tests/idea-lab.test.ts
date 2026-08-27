import { describe, expect, test } from 'vitest';
import { IdeaSchema, scoreIdea } from '@/lib/ideas';

/**
 * Idea Lab: a transparent, deterministic scoring rubric over operator-supplied
 * 1-5 inputs (never an invented "AI opinion" score). Weighted sum, documented
 * weights, same shape every time — an idea's score can always be explained by
 * pointing at its three inputs.
 */
describe('IdeaSchema', () => {
  const valid = {
    id: 'idea-1',
    title: 'Automated grade digest for parents',
    description: 'Weekly summary email of a student\'s skill progress.',
    marketSize: 4,
    effort: 2, // 1 = huge effort, 5 = trivial — higher is better (less effort)
    strategicFit: 5,
    status: 'new' as const,
    createdAt: '2026-08-27T00:00:00.000Z',
    updatedAt: '2026-08-27T00:00:00.000Z',
  };

  test('accepts a valid idea', () => {
    expect(IdeaSchema.parse(valid)).toEqual(valid);
  });

  test('rejects a marketSize outside 1..5', () => {
    expect(() => IdeaSchema.parse({ ...valid, marketSize: 0 })).toThrow();
    expect(() => IdeaSchema.parse({ ...valid, marketSize: 6 })).toThrow();
  });

  test('rejects an unknown status', () => {
    expect(() => IdeaSchema.parse({ ...valid, status: 'maybe' })).toThrow();
  });
});

describe('scoreIdea', () => {
  test('is a weighted sum: marketSize*0.4 + effort*0.3 + strategicFit*0.3, out of 5', () => {
    const score = scoreIdea({ marketSize: 4, effort: 2, strategicFit: 5 });
    expect(score).toBeCloseTo(4 * 0.4 + 2 * 0.3 + 5 * 0.3, 5);
  });

  test('a perfect idea scores 5', () => {
    expect(scoreIdea({ marketSize: 5, effort: 5, strategicFit: 5 })).toBe(5);
  });

  test('the worst idea scores 1', () => {
    expect(scoreIdea({ marketSize: 1, effort: 1, strategicFit: 1 })).toBe(1);
  });

  test('effort is already inverted in the input (5 = easy) — scoreIdea does not invert again', () => {
    // a high-effort (hard) idea is entered as effort=1, and should score low
    const hard = scoreIdea({ marketSize: 5, effort: 1, strategicFit: 5 });
    const easy = scoreIdea({ marketSize: 5, effort: 5, strategicFit: 5 });
    expect(easy).toBeGreaterThan(hard);
  });
});
