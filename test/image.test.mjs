import assert from 'node:assert/strict'
import { test } from 'node:test'

import { renderImage } from '../src/image.mjs'
import { summarize } from '../src/report.mjs'
import defaults from './fixtures/defaults.json' with { type: 'json' }
import image from './fixtures/image.json' with { type: 'json' }
import railsGroups from './fixtures/rails-groups.json' with { type: 'json' }
import rails from './fixtures/rails.json' with { type: 'json' }

test('renders an SVG using the same nested totals as Markdown', () => {
  const svg = renderImage(summarize(rails.files, railsGroups))
  assert.match(svg, /10 files, 517 added lines, 110 deleted lines/)
  assert.match(svg, /data-depth="2"/)
  assert.match(svg, />Generated<\/text>/)
})

test('bundles its font and styles without a Rails or browser dependency', () => {
  const svg = renderImage(summarize(rails.files))
  assert.match(svg, /data:font\/woff2;base64,[A-Za-z0-9+/=]+/)
  assert.doesNotMatch(svg, /FONT_DATA|@import|https:\/\/fonts/)
})

test('escapes group names in the SVG', () => {
  const svg = renderImage(summarize(image.file, image.labels))
  assert.match(svg, /Fixtures &amp; &lt;Support&gt;/)
  assert.doesNotMatch(svg, /<Support>/)
})

test('hides empty groups and retains files with zero changed lines', () => {
  const svg = renderImage(summarize(defaults.unmatched))
  assert.match(svg, /1 files, 0 added lines, 0 deleted lines/)
  assert.doesNotMatch(svg, />Source<|NaN|Infinity/)
})

test('renders an empty image report', () => {
  const svg = renderImage(summarize([]))
  assert.match(svg, /No changed files\./)
  assert.doesNotMatch(svg, /NaN|Infinity/)
})
