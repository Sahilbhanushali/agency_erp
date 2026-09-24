import { resolveRecipients } from './notifications.service';

describe('resolveRecipients', () => {
  it('never notifies the person who caused the event', () => {
    expect(resolveRecipients(['alice', 'bob'], 'alice')).toEqual(['bob']);
  });

  it('notifies someone listed twice only once', () => {
    // A task whose assignee is also its creator should yield a single row.
    expect(resolveRecipients(['bob', 'bob'], 'alice')).toEqual(['bob']);
  });

  it('drops unassigned slots rather than writing orphan rows', () => {
    expect(resolveRecipients([null, undefined, '', 'bob'], 'alice')).toEqual([
      'bob',
    ]);
  });

  it('returns nothing when the actor is the only candidate', () => {
    expect(resolveRecipients(['alice', null], 'alice')).toEqual([]);
  });

  it('keeps everyone when there is no actor to exclude', () => {
    expect(resolveRecipients(['alice', 'bob'])).toEqual(['alice', 'bob']);
  });
});
