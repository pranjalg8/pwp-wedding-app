import { describe, expect, it } from 'vitest';
import { searchKb, sourcesIn, tokens } from '../kbSearch';

const pages = [
  {
    slug: 'budget',
    title: 'Budget',
    body: '# Rules\n- Royal Pepper is paid by both fathers.\n- Photography is split 50/50 with Paridhi.\n# Pending\n- 30 Nov: photographer advance Rs 50,000.',
  },
  { slug: 'stay', title: 'Stay and food', body: '# Shri Kanth\n- Rooms cost Rs 2,800 per night.\n- 18 rooms booked.' },
];

describe('kbSearch', () => {
  it('drops filler words', () => {
    expect(tokens('What is the photographer advance?')).toEqual(['photographer', 'advance']);
  });

  it('finds the line that answers the question, even with a different word form', () => {
    const hits = searchKb(pages, 'how much is the photographers advance');
    expect(hits[0].line).toContain('photographer advance Rs 50,000');
    expect(hits[0].title).toBe('Budget');
  });

  it('uses the heading as context', () => {
    const hits = searchKb(pages, 'Shri Kanth rooms');
    expect(hits.map((h) => h.line)).toContain('Rooms cost Rs 2,800 per night.');
  });

  it('returns nothing when a line only shares one common word', () => {
    expect(searchKb(pages, 'what is the honeymoon visa plan')).toEqual([]);
  });

  it('finds the pages an answer cites', () => {
    expect(sourcesIn(pages, 'Rooms cost Rs 2,800. [Stay and food]').map((s) => s.slug)).toEqual(['stay']);
    expect(sourcesIn(pages, 'Both. [Budget, Stay and food]').map((s) => s.slug)).toEqual(['budget', 'stay']);
    expect(sourcesIn(pages, 'No brackets here')).toEqual([]);
  });

  it('returns nothing for an empty question', () => {
    expect(searchKb(pages, '  ?? ')).toEqual([]);
  });
});
