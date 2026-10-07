import defaults from './defaults.json' with { type: 'json' }
import { marker, renderReport, summarize } from './report.mjs'

export async function updateComment({ github, context, core, config = '' }) {
  const event = context.payload.pull_request
  if (!event) throw new Error('Run PR diff stats on a pull_request_target or pull_request event.')

  const pull = { ...context.repo, pull_number: context.issue.number }
  const issue = { ...context.repo, issue_number: context.issue.number }
  const [files, comments, { data: pr }] = await Promise.all([
    github.paginate(github.rest.pulls.listFiles, { ...pull, per_page: 100 }),
    github.paginate(github.rest.issues.listComments, { ...issue, per_page: 100 }),
    github.rest.pulls.get(pull),
  ])

  if (pr.state !== 'open' || pr.head.sha !== event.head.sha) {
    core.info('The PR is closed or a newer push will update the report.')
    return
  }
  if (files.length !== pr.changed_files) {
    throw new Error(
      `GitHub returned ${files.length} of ${pr.changed_files} changed files; refusing to publish incomplete counts. The API supports at most 3,000 files.`,
    )
  }

  const groups = await loadGroups({ github, repo: context.repo, ref: pr.base.sha, config })
  const body = renderReport(summarize(files, groups), pr.head.sha)
  const comment = comments.find((item) => item.user?.login === 'github-actions[bot]' && item.body?.startsWith(marker))
  if (comment?.body === body) return

  const { data: latest } = await github.rest.pulls.get(pull)
  if (latest.state !== 'open' || latest.head.sha !== pr.head.sha || latest.base.sha !== pr.base.sha) {
    core.info('The PR changed while preparing the report; skipping this run.')
    return
  }

  if (comment) {
    await github.rest.issues.updateComment({ ...context.repo, comment_id: comment.id, body })
  } else {
    await github.rest.issues.createComment({ ...issue, body })
  }
}

async function loadGroups({ github, repo, ref, config }) {
  if (!config) return defaults

  let data
  try {
    data = (await github.rest.repos.getContent({ ...repo, path: config, ref })).data
  } catch (error) {
    if (error.status !== 404) throw error
    throw new Error(`Cannot read ${config} at the PR base commit. Merge the configuration before enabling it.`, {
      cause: error,
    })
  }
  if (data.type !== 'file' || data.encoding !== 'base64') {
    throw new Error(`${config} must be a JSON file smaller than 1 MB.`)
  }
  try {
    return JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'))
  } catch (error) {
    throw new Error(`${config} contains invalid JSON.`, { cause: error })
  }
}
