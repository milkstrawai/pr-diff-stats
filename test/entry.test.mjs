import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { afterEach, mock, test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { renderReport, summarize } from '../src/report.mjs'
import fixture from './fixtures/github.json' with { type: 'json' }
import rails from './fixtures/rails.json' with { type: 'json' }

const originalPath = process.env.PR_DIFF_ACTION_PATH
const originalConfig = process.env.PR_DIFF_CONFIG

afterEach(() => {
  if (originalPath === undefined) delete process.env.PR_DIFF_ACTION_PATH
  else process.env.PR_DIFF_ACTION_PATH = originalPath
  if (originalConfig === undefined) delete process.env.PR_DIFF_CONFIG
  else process.env.PR_DIFF_CONFIG = originalConfig
})

test('the composite entry loads its own code without a consumer checkout', async () => {
  process.env.PR_DIFF_ACTION_PATH = fileURLToPath(new URL('..', import.meta.url))
  process.env.PR_DIFF_CONFIG = ''
  const metadata = readFileSync(new URL('../action.yml', import.meta.url), 'utf8')
  const script = metadata
    .split('script: |\n')[1]
    .split('\n')
    .map((line) => line.trimStart())
    .join('\n')
  const pr = structuredClone(fixture.pullRequest)
  const context = { ...fixture.context, payload: { pull_request: pr } }
  const github = {
    rest: {
      pulls: { listFiles: mock.fn(), get: async () => ({ data: pr }) },
      issues: { listComments: mock.fn(), createComment: mock.fn() },
    },
    paginate: async (method) => (method === github.rest.pulls.listFiles ? rails.files : []),
  }
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor
  await new AsyncFunction('github', 'context', 'core', script)(github, context, { info: mock.fn() })

  assert.equal(
    github.rest.issues.createComment.mock.calls[0].arguments[0].body,
    renderReport(summarize(rails.files), pr.head.sha),
  )
})
