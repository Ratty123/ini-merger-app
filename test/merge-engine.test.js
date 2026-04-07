const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseIni,
  createMergeModel,
  renderMergedContent,
  selectConflictOption,
  setDuplicatePreference
} = require('../src/core/merge-engine');

test('parseIni preserves preamble, comments before settings, and trailing section lines', () => {
  const document = parseIni(
    '; header comment\n\n[Core]\n; comment for key\nKey=1\n; section tail\n',
    { id: 'file-1', name: 'a.ini', path: 'C:\\a.ini' }
  );

  assert.deepEqual(document.preamble, ['; header comment', '']);
  assert.equal(document.sections.length, 1);
  assert.deepEqual(document.sections[0].entries[0].leadingLines, ['; comment for key']);
  assert.deepEqual(document.sections[0].trailingLines, ['; section tail', '']);
});

test('createMergeModel groups all scalar candidates into a single conflict and defaults to the highest priority file', () => {
  const model = createMergeModel([
    {
      id: 'a',
      name: 'base.ini',
      path: 'C:\\base.ini',
      content: '[Core]\nValue=1\n'
    },
    {
      id: 'b',
      name: 'mod.ini',
      path: 'C:\\mod.ini',
      content: '[Core]\nValue=2\n'
    },
    {
      id: 'c',
      name: 'override.ini',
      path: 'C:\\override.ini',
      content: '[Core]\nValue=3\n'
    }
  ]);

  assert.equal(model.conflicts.length, 1);
  assert.equal(model.conflicts[0].options.length, 3);
  assert.match(renderMergedContent(model), /Value=3/);
});

test('selectConflictOption updates the rendered output', () => {
  const model = createMergeModel([
    {
      id: 'a',
      name: 'base.ini',
      path: 'C:\\base.ini',
      content: '[Core]\nValue=1\n'
    },
    {
      id: 'b',
      name: 'override.ini',
      path: 'C:\\override.ini',
      content: '[Core]\nValue=2\n'
    }
  ]);

  const conflict = model.conflicts[0];
  const baseOption = conflict.options.find((option) => option.raw === 'Value=1');
  selectConflictOption(model, conflict.id, baseOption.id);

  assert.match(renderMergedContent(model), /Value=1/);
});

test('repeatable commands dedupe + entries and preserve duplicate dot entries', () => {
  const model = createMergeModel([
    {
      id: 'a',
      name: 'base.ini',
      path: 'C:\\base.ini',
      content: '[Core]\nPaths=Foo\n+Suppress=Bar\n.Binding=Baz\n.Binding=Baz\n'
    },
    {
      id: 'b',
      name: 'override.ini',
      path: 'C:\\override.ini',
      content: '[Core]\nPaths=Foo\n+Suppress=Bar\n.Binding=Baz\n'
    }
  ]);

  const rendered = renderMergedContent(model);
  assert.equal((rendered.match(/Paths=Foo/g) || []).length, 1);
  assert.equal((rendered.match(/\+Suppress=Bar/g) || []).length, 1);
  assert.equal((rendered.match(/\.Binding=Baz/g) || []).length, 3);
});

test('duplicate groups can be reviewed and kept in the rendered output', () => {
  const model = createMergeModel([
    {
      id: 'a',
      name: 'base.ini',
      path: 'C:\\base.ini',
      content: '[Core]\nValue=1\nPaths=Foo\n'
    },
    {
      id: 'b',
      name: 'override.ini',
      path: 'C:\\override.ini',
      content: '[Core]\nValue=1\nPaths=Foo\n'
    }
  ]);

  assert.equal(model.summary.duplicateCount, 2);

  let rendered = renderMergedContent(model);
  assert.equal((rendered.match(/Value=1/g) || []).length, 1);
  assert.equal((rendered.match(/Paths=Foo/g) || []).length, 1);

  const scalarDuplicate = model.duplicates.find((duplicate) => duplicate.type === 'scalar');
  const repeatableDuplicate = model.duplicates.find((duplicate) => duplicate.type === 'repeatable');

  setDuplicatePreference(model, scalarDuplicate.id, true);
  setDuplicatePreference(model, repeatableDuplicate.id, true);

  rendered = renderMergedContent(model);
  assert.equal((rendered.match(/Value=1/g) || []).length, 2);
  assert.equal((rendered.match(/Paths=Foo/g) || []).length, 2);
});
