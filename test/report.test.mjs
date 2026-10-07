import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { findGroupPath, renderReport, summarize } from '../src/report.mjs'
import defaults from './fixtures/defaults.json' with { type: 'json' }
import railsGroups from './fixtures/rails-groups.json' with { type: 'json' }
import rails from './fixtures/rails.json' with { type: 'json' }

for (const { name, groups, error } of defaults.invalidGroups) {
  test(`rejects configuration with ${name}`, () => {
    assert.throws(() => summarize(defaults.unmatched, groups), new RegExp(error))
  })
}

for (const [filename, name] of defaults.classification) {
  test(`default group for ${filename}`, () => {
    assert.equal(findGroupPath(filename).at(-1).name, name)
  })
}

for (const [filename, names] of rails.classification) {
  test(`custom group for ${filename}`, () => {
    assert.deepEqual(
      findGroupPath(filename, railsGroups).map((group) => group.name),
      names,
    )
  })
}

test('counts each file once in the grand total', () => {
  assert.deepEqual(summarize(rails.files, railsGroups).total, { files: 10, additions: 517, deletions: 110 })
})

test('includes descendants in parent totals', () => {
  const { groups } = summarize(defaults.nestedFiles, defaults.nested)
  assert.deepEqual(groups[0].totals, { files: 2, additions: 16, deletions: 4 })
})

test('adds an Other fallback for unmatched custom paths', () => {
  const { groups } = summarize(defaults.nestedFiles, defaults.nested)
  assert.deepEqual(groups.at(-1).totals, { files: 1, additions: 5, deletions: 0 })
})

test('does not retain totals between reports', () => {
  summarize(rails.files, railsGroups)
  assert.deepEqual(summarize([], railsGroups).total, { files: 0, additions: 0, deletions: 0 })
})

test('renders a readable Markdown hierarchy', () => {
  const expected = readFileSync(new URL('./fixtures/report.md', import.meta.url), 'utf8').trimEnd()
  assert.equal(renderReport(summarize(defaults.nestedFiles, defaults.nested), rails.sha), expected)
})

test('hides groups without files', () => {
  assert.doesNotMatch(renderReport(summarize(defaults.unmatched), rails.sha), /\| Source \|/)
})

test('includes binary changes and pure renames with no changed lines', () => {
  assert.match(renderReport(summarize(defaults.unmatched), rails.sha), /\| Other \| 1 \| 0 \| 0 \| 0 \|/)
})

test('renders an empty diff', () => {
  assert.match(renderReport(summarize([]), rails.sha), /No changed files\./)
})

test('escapes group names for Markdown tables', () => {
  const report = renderReport(summarize(defaults.unmatched, defaults.labels), rails.sha)
  assert.match(report, /A &#124; \\\[link\\\]/)
  assert.match(report, /&lt;script&gt; &amp;/)
  assert.doesNotMatch(report, /\*\*bold\*\*|\nnext/)
})
