import {
  buildMeta,
  DEFAULT_LIMIT,
  searchFilter,
  toSkipTake,
} from './paginate.util';

describe('toSkipTake', () => {
  it('starts at the top of the table for page 1', () => {
    expect(toSkipTake(1, 25)).toEqual({ skip: 0, take: 25 });
  });

  it('offsets by whole pages', () => {
    expect(toSkipTake(3, 10)).toEqual({ skip: 20, take: 10 });
  });

  it('falls back to the defaults when the caller omits them', () => {
    expect(toSkipTake()).toEqual({ skip: 0, take: DEFAULT_LIMIT });
  });
});

describe('buildMeta', () => {
  it('rounds a partial last page up', () => {
    expect(buildMeta(7, 1, 2).pageCount).toBe(4);
  });

  it('reports one page when there is nothing to show', () => {
    expect(buildMeta(0, 1, 25)).toEqual({
      page: 1,
      limit: 25,
      total: 0,
      pageCount: 1,
    });
  });

  it('does not round an exact fit up', () => {
    expect(buildMeta(20, 1, 10).pageCount).toBe(2);
  });
});

describe('searchFilter', () => {
  it('matches nothing extra when the query is blank', () => {
    expect(searchFilter(undefined, ['name'])).toEqual({});
    expect(searchFilter('   ', ['name'])).toEqual({});
  });

  it('trims and spreads the query across every field', () => {
    expect(searchFilter('  acme ', ['name', 'email'])).toEqual({
      OR: [{ name: { contains: 'acme' } }, { email: { contains: 'acme' } }],
    });
  });
});
