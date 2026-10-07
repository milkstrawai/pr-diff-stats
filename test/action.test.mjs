import assert from 'node:assert/strict'
import { afterEach, beforeEach, mock, test } from 'node:test'

import { updateComment } from '../src/action.mjs'
import { renderReport, summarize } from '../src/report.mjs'
import fixture from './fixtures/github.json' with { type: 'json' }
import image from './fixtures/image.json' with { type: 'json' }
import railsGroups from './fixtures/rails-groups.json' with { type: 'json' }
import rails from './fixtures/rails.json' with { type: 'json' }

let github
let context
let core
let pr
let comments
let upload

beforeEach(() => {
  pr = structuredClone(fixture.pullRequest)
  context = {
    ...structuredClone(fixture.context),
    payload: { pull_request: structuredClone(pr), repository: image.repository },
  }
  comments = structuredClone(rails.comments)
  core = { info: mock.fn(), setSecret: mock.fn() }
  upload = mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ url: image.url }) }))
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

afterEach(() => mock.restoreAll())

test('defaults to Markdown even when an image token is supplied', async () => {
  await updateComment({ github, context, core, imageToken: image.token })
  assert.equal(
    github.rest.issues.updateComment.mock.calls[0].arguments[0].body,
    renderReport(summarize(rails.files), pr.head.sha),
  )
  assert.equal(upload.mock.callCount(), 0)
})

test('publishes an SVG attachment when image mode is selected', async () => {
  await updateComment({ github, context, core, format: 'image', imageToken: image.token })
  const [url, request] = upload.mock.calls[0].arguments
  assert.equal(url.origin + url.pathname, 'https://uploads.github.com/user-attachments/assets')
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    repository_id: String(image.repository.id),
    name: 'pr-42.svg',
    content_type: 'image/svg+xml',
  })
  assert.equal(request.headers.Authorization, `Bearer ${image.token}`)
  assert.match(request.body, /<svg[^>]+xmlns=/)
  assert.match(github.rest.issues.updateComment.mock.calls[0].arguments[0].body, /!\[PR diff stats:/)
})

test('masks the image token and never includes it in the comment', async () => {
  await updateComment({ github, context, core, format: 'image', imageToken: image.token })
  assert.deepEqual(core.setSecret.mock.calls[0].arguments, [image.token])
  assert.ok(!github.rest.issues.updateComment.mock.calls[0].arguments[0].body.includes(image.token))
})

test('requires an image token only for image mode', async () => {
  await assert.rejects(updateComment({ github, context, core, format: 'image' }), /image-token/)
  assert.equal(upload.mock.callCount(), 0)
  assert.equal(github.paginate.mock.callCount(), 0)
})

test('rejects an unsupported report format', async () => {
  await assert.rejects(updateComment({ github, context, core, format: 'pdf' }), /markdown or image/)
})

test('does not upload an unchanged image again', async () => {
  await updateComment({ github, context, core, format: 'image', imageToken: image.token })
  comments[2].body = github.rest.issues.updateComment.mock.calls[0].arguments[0].body
  await updateComment({ github, context, core, format: 'image', imageToken: image.token })
  assert.equal(upload.mock.callCount(), 1)
  assert.equal(github.rest.issues.updateComment.mock.callCount(), 1)
})

test('can switch the same image comment back to Markdown', async () => {
  await updateComment({ github, context, core, format: 'image', imageToken: image.token })
  comments[2].body = github.rest.issues.updateComment.mock.calls[0].arguments[0].body
  await updateComment({ github, context, core })
  assert.equal(
    github.rest.issues.updateComment.mock.calls[1].arguments[0].body,
    renderReport(summarize(rails.files), pr.head.sha),
  )
  assert.equal(github.rest.issues.createComment.mock.callCount(), 0)
})

test('keeps the previous comment when image upload fails', async () => {
  upload.mock.mockImplementation(async () => ({ ok: false, status: 403 }))
  await assert.rejects(updateComment({ github, context, core, format: 'image', imageToken: image.token }), /403/)
  assert.equal(github.rest.issues.updateComment.mock.callCount(), 0)
})

test('does not publish an image if a newer push arrives during upload', async () => {
  upload.mock.mockImplementation(async () => {
    pr.head.sha = 'newer-head'
    return { ok: true, json: async () => ({ url: image.url }) }
  })
  await updateComment({ github, context, core, format: 'image', imageToken: image.token })
  assert.equal(github.rest.issues.updateComment.mock.callCount(), 0)
})

test('refuses image responses without an attachment URL', async () => {
  upload.mock.mockImplementation(async () => ({ ok: true, json: async () => ({}) }))
  await assert.rejects(
    updateComment({ github, context, core, format: 'image', imageToken: image.token }),
    /attachment URL/,
  )
  assert.equal(github.rest.issues.updateComment.mock.callCount(), 0)
})

test('publishes concurrent PR images without shared storage', async () => {
  await Promise.all(
    image.parallelPrNumbers.map((number) =>
      updateComment({
        github,
        context: { ...context, issue: { number } },
        core,
        format: 'image',
        imageToken: image.token,
      }),
    ),
  )
  assert.deepEqual(
    upload.mock.calls.map(({ arguments: [url] }) => url.searchParams.get('name')),
    image.parallelPrNumbers.map((number) => `pr-${number}.svg`),
  )
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
