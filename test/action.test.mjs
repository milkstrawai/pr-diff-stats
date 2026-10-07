import assert from 'node:assert/strict'
import { beforeEach, mock, test } from 'node:test'

import { updateComment } from '../src/action.mjs'
import { renderReport, summarize } from '../src/report.mjs'
import fixture from './fixtures/github.json' with { type: 'json' }
import railsGroups from './fixtures/rails-groups.json' with { type: 'json' }
import rails from './fixtures/rails.json' with { type: 'json' }

let github
let context
let core
let pr
let comments

beforeEach(() => {
  pr = structuredClone(fixture.pullRequest)
  context = { ...structuredClone(fixture.context), payload: { pull_request: structuredClone(pr) } }
  comments = structuredClone(rails.comments)
  core = { info: mock.fn() }
  github = {
    rest: {
      pulls: { listFiles: mock.fn(), get: mock.fn(async () => ({ data: structuredClone(pr) })) },
      issues: { listComments: mock.fn(), createComment: mock.fn(), updateComment: mock.fn() },
      repos: {
        getContent: mock.fn(async () => ({
          data: {
            type: 'file',
            encoding: 'base64',
            content: Buffer.from(JSON.stringify(railsGroups)).toString('base64'),
          },
        })),
      },
    },
    paginate: mock.fn(async (method) => (method === github.rest.pulls.listFiles ? rails.files : comments)),
  }
})

test('updates the existing bot report, including old image reports', async () => {
  await updateComment({ github, context, core })
  assert.deepEqual(github.rest.issues.updateComment.mock.calls[0].arguments, [
    {
      ...context.repo,
      comment_id: 3,
      body: renderReport(summarize(rails.files), pr.head.sha),
    },
  ])
  assert.equal(github.rest.issues.createComment.mock.callCount(), 0)
})

test('creates a report when only human or unrelated bot comments exist', async () => {
  comments = comments.slice(0, 2)
  await updateComment({ github, context, core })
  assert.deepEqual(github.rest.issues.createComment.mock.calls[0].arguments, [
    {
      ...context.repo,
      issue_number: context.issue.number,
      body: renderReport(summarize(rails.files), pr.head.sha),
    },
  ])
})

test('skips an unchanged report', async () => {
  comments[2].body = renderReport(summarize(rails.files), pr.head.sha)
  await updateComment({ github, context, core })
  assert.equal(github.rest.issues.updateComment.mock.callCount(), 0)
})

test('loads JSON configuration from the live PR base commit', async () => {
  await updateComment({ github, context, core, config: fixture.configPath })
  assert.deepEqual(github.rest.repos.getContent.mock.calls[0].arguments, [
    {
      ...context.repo,
      path: fixture.configPath,
      ref: pr.base.sha,
    },
  ])
  assert.equal(
    github.rest.issues.updateComment.mock.calls[0].arguments[0].body,
    renderReport(summarize(rails.files, railsGroups), pr.head.sha),
  )
})

test('does not fetch configuration when using the defaults', async () => {
  await updateComment({ github, context, core })
  assert.equal(github.rest.repos.getContent.mock.callCount(), 0)
})

test('fails clearly if the configuration is absent from the base commit', async () => {
  github.rest.repos.getContent = mock.fn(async () => {
    throw Object.assign(new Error('Not Found'), { status: 404 })
  })
  await assert.rejects(updateComment({ github, context, core, config: fixture.configPath }), /base commit/)
  assert.equal(github.rest.issues.updateComment.mock.callCount(), 0)
})

test('skips a stale workflow run', async () => {
  pr.head.sha = 'newer-head'
  await updateComment({ github, context, core })
  assert.equal(github.rest.issues.updateComment.mock.callCount(), 0)
})

test('skips a PR that has closed', async () => {
  pr.state = 'closed'
  await updateComment({ github, context, core })
  assert.equal(github.rest.issues.updateComment.mock.callCount(), 0)
})

test('refuses incomplete file lists', async () => {
  pr.changed_files += 1
  await assert.rejects(updateComment({ github, context, core }), /10 of 11 changed files/)
  assert.equal(github.rest.issues.updateComment.mock.callCount(), 0)
})

test('does not publish if a newer push arrives while preparing the report', async () => {
  github.rest.pulls.get = mock.fn(async () => {
    const data = structuredClone(pr)
    pr.head.sha = 'newer-head'
    return { data }
  })
  await updateComment({ github, context, core })
  assert.equal(github.rest.issues.updateComment.mock.callCount(), 0)
})

test('does not publish if the base changes while preparing the report', async () => {
  github.rest.pulls.get = mock.fn(async () => {
    const data = structuredClone(pr)
    pr.base.sha = 'newer-base'
    return { data }
  })
  await updateComment({ github, context, core })
  assert.equal(github.rest.issues.updateComment.mock.callCount(), 0)
})

test('passes pagination parameters for files and comments', async () => {
  await updateComment({ github, context, core })
  assert.deepEqual(
    github.paginate.mock.calls.map((call) => call.arguments[1]),
    [
      { ...context.repo, pull_number: context.issue.number, per_page: 100 },
      { ...context.repo, issue_number: context.issue.number, per_page: 100 },
    ],
  )
})

test('rejects events without a pull request', async () => {
  context.payload = {}
  await assert.rejects(updateComment({ github, context, core }), /pull_request/)
})

test('surfaces publishing failures', async () => {
  github.rest.issues.updateComment = mock.fn(async () => {
    throw new Error('GitHub unavailable')
  })
  await assert.rejects(updateComment({ github, context, core }), /GitHub unavailable/)
})
