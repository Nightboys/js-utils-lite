import assert from 'node:assert/strict';
import test from 'node:test';
import {
  camelCase,
  capitalize,
  chunk,
  clamp,
  deepClone,
  escapeHtml,
  formatDate,
  getValue,
  groupBy,
  isEmpty,
  isPlainObject,
  kebabCase,
  merge,
  omit,
  parseQuery,
  pick,
  range,
  safeJsonParse,
  setValue,
  sortBy,
  stringifyQuery,
  sumBy,
  unescapeHtml,
  uniqueBy,
} from '../src/index.js';

test('isPlainObject and isEmpty cover common values', () => {
  assert.equal(isPlainObject({}), true);
  assert.equal(isPlainObject([]), false);
  assert.equal(isEmpty({}), true);
  assert.equal(isEmpty([1]), false);
});

test('deepClone creates independent nested data and keeps circular references', () => {
  const source = { user: { name: 'codex' } };
  source.self = source;
  const cloned = deepClone(source);

  assert.notEqual(cloned, source);
  assert.notEqual(cloned.user, source.user);
  assert.equal(cloned.self, cloned);
});

test('array helpers transform list data', () => {
  assert.deepEqual(chunk([1, 2, 3], 2), [[1, 2], [3]]);
  assert.deepEqual(uniqueBy([{ id: 1 }, { id: 1 }, { id: 2 }], 'id'), [{ id: 1 }, { id: 2 }]);
  assert.deepEqual(groupBy([{ type: 'a' }, { type: 'a' }, { type: 'b' }], 'type'), {
    a: [{ type: 'a' }, { type: 'a' }],
    b: [{ type: 'b' }],
  });
  assert.deepEqual(range(1, 5), [1, 2, 3, 4]);
  assert.equal(sumBy([{ price: 10 }, { price: '5' }, { price: 'bad' }], 'price'), 15);
  assert.deepEqual(sortBy([{ age: 3 }, { age: 1 }, { age: 2 }], 'age'), [{ age: 1 }, { age: 2 }, { age: 3 }]);
});

test('object helpers read and filter object data safely', () => {
  const source = { id: 1, name: 'npm', meta: { count: 2 } };
  const target = {};

  assert.equal(getValue(source, 'meta.count'), 2);
  assert.equal(getValue(source, 'meta.missing', 0), 0);
  assert.deepEqual(setValue(target, 'user.profile.name', 'codex'), { user: { profile: { name: 'codex' } } });
  assert.deepEqual(pick(source, ['id', 'name']), { id: 1, name: 'npm' });
  assert.deepEqual(omit(source, ['meta']), { id: 1, name: 'npm' });
  assert.deepEqual(merge({ user: { name: 'a', age: 1 } }, { user: { age: 2 } }), { user: { name: 'a', age: 2 } });
});

test('format and parse helpers handle common strings', () => {
  assert.equal(clamp(12, 0, 10), 10);
  assert.equal(formatDate(new Date('2026-06-10T08:09:10'), 'YYYY/MM/DD'), '2026/06/10');
  assert.deepEqual(safeJsonParse('{"ok":true}'), { ok: true });
  assert.equal(safeJsonParse('{bad}', 'fallback'), 'fallback');
  assert.equal(stringifyQuery({ keyword: 'js utils', page: 1, empty: null }), 'keyword=js%20utils&page=1');
  assert.deepEqual(parseQuery('https://example.com?a=1&b=hello%20js#top'), { a: '1', b: 'hello js' });
});

test('string helpers normalize names and html safely', () => {
  assert.equal(capitalize('hELLO'), 'Hello');
  assert.equal(camelCase('hello-world name'), 'helloWorldName');
  assert.equal(kebabCase('helloWorld name'), 'hello-world-name');
  assert.equal(escapeHtml('<span class="name">Tom & Jerry</span>'), '&lt;span class=&quot;name&quot;&gt;Tom &amp; Jerry&lt;/span&gt;');
  assert.equal(unescapeHtml('&lt;strong&gt;Hi&lt;/strong&gt;'), '<strong>Hi</strong>');
});
