import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { summarize } from '../src/report.mjs'
import { renderTextChart } from '../src/text-chart.mjs'
import defaults from './fixtures/defaults.json' with { type: 'json' }
import railsGroups from './fixtures/rails-groups.json' with { type: 'json' }
import rails from './fixtures/rails.json' with { type: 'json' }
import textChart from './fixtures/text-chart.json' with { type: 'json' }

test('draws the image report layout as text', () => {
  const expected = readFileSync(new URL('./fixtures/text-chart.txt', import.meta.url), 'utf8').trimEnd()
  assert.equal(renderTextChart(summarize(rails.files, railsGroups), rails.sha), expected)
})

test('sizes columns to the largest counts', () => {
  const report = renderTextChart(summarize(textChart.largeFiles), rails.sha)
  const width = report.match(/^─+$/m)[0].length
  const rows = report.split('\n').filter((line) => /(\d|Changed)$/.test(line))
  assert.match(report, /^Source +1 +\+12,345 +−6,789 +19,134$/m)
  assert.deepEqual(new Set(rows.map((row) => row.length)), new Set([width]))
})

test('shortens long group names after their tree lines', () => {
  const report = renderTextChart(summarize(textChart.largeFiles, textChart.longNames), rails.sha)
  assert.match(report, /^Everything that hap… +2 /m)
  assert.match(report, /^└ Including the dee… +2 /m)
})

test('prints group names literally on one line', () => {
  const labels = renderTextChart(summarize(defaults.unmatched, defaults.labels), rails.sha)
  const multiline = renderTextChart(summarize(defaults.unmatched, textChart.multiline), rails.sha)
  assert.match(labels, /^A \| \[link\]\(https:\/\/… +1 /m)
  assert.match(multiline, /^Docs and guides +1 /m)
})

test('keeps files with zero changed lines without drawing a bar', () => {
  const report = renderTextChart(summarize(defaults.unmatched), rails.sha)
  assert.match(report, /^Other +1 +0 +0 +0\n\n─+$/m)
  assert.doesNotMatch(report, /NaN|Infinity/)
})

test('renders an empty text chart', () => {
  const report = renderTextChart(summarize([]), rails.sha)
  assert.match(report, /^No changed files\.$/m)
  assert.doesNotMatch(report, /Segment|NaN|Infinity/)
})
