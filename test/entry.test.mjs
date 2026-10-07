import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { afterEach, mock, test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { renderReport, summarize } from '../src/report.mjs'
import fixture from './fixtures/github.json' with { type: 'json' }
import image from './fixtures/image.json' with { type: 'json' }
import rails from './fixtures/rails.json' with { type: 'json' }

const keys = ['PR_DIFF_ACTION_PATH', 'PR_DIFF_CONFIG', 'PR_DIFF_FORMAT', 'PR_DIFF_IMAGE_TOKEN']
const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]))

afterEach(() => {
  for (const key of keys) {
    if (original[key] === undefined) delete process.env[key]
    else process.env[key] = original[key]
  }
  mock.restoreAll()
})

for (const format of ['markdown', 'image']) {
  test(`the composite entry loads ${format} mode without a consumer checkout`, async () => {
    process.env.PR_DIFF_ACTION_PATH = fileURLToPath(new URL('..', import.meta.url))
    process.env.PR_DIFF_CONFIG = ''
    process.env.PR_DIFF_FORMAT = format
    process.env.PR_DIFF_IMAGE_TOKEN = format === 'image' ? image.token : ''
    mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ url: image.url }) }))
    const metadata = readFileSync(new URL('../action.yml', import.meta.url), 'utf8')
    const script = metadata
      .split('script: |\n')[1]
      .split('\n')
      .map((line) => line.trimStart())
      .join('\n')
    const pr = structuredClone(fixture.pullRequest)
    const context = { ...fixture.context, payload: { pull_request: pr, repository: image.repository } }
    const github = {
      rest: {
        pulls: { listFiles: mock.fn(), get: async () => ({ data: pr }) },
        issues: { listComments: mock.fn(), createComment: mock.fn() },
      },
      paginate: async (method) => (method === github.rest.pulls.listFiles ? rails.files : []),
    }
    const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor
    await new AsyncFunction('github', 'context', 'core', script)(github, context, {
      info: mock.fn(),
      setSecret: mock.fn(),
    })

    const body = github.rest.issues.createComment.mock.calls[0].arguments[0].body
    if (format === 'markdown') assert.equal(body, renderReport(summarize(rails.files), pr.head.sha))
    else assert.ok(body.includes(image.url))
  })
}
