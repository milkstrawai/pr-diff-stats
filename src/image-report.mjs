import { createHash } from 'node:crypto'

import { renderImage } from './image.mjs'
import { marker } from './report.mjs'

export async function prepareImageReport({ summary, sha, context, comment, token }) {
  const svg = renderImage(summary)
  const digest = createHash('sha256').update(svg).digest('hex')
  const version = `<!-- pr-diff-image:attachment:${sha}:${digest} -->`
  if (comment?.body?.includes(version)) return comment.body

  const url = await publishImage({ context, svg, token })
  const { files, additions, deletions } = summary.total
  const alt = [
    `${format(files)} files`,
    `${format(additions)} added`,
    `${format(deletions)} deleted`,
    `${format(additions + deletions)} changed lines`,
  ].join(', ')
  return [marker, version, '', `![PR diff stats: ${alt}.](${url})`, '', `Updated for \`${sha.slice(0, 7)}\`.`].join(
    '\n',
  )
}

async function publishImage({ context, svg, token }) {
  const url = new URL('https://uploads.github.com/user-attachments/assets')
  url.search = new URLSearchParams({
    repository_id: String(context.payload.repository.id),
    name: `pr-${context.issue.number}.svg`,
    content_type: 'image/svg+xml',
  }).toString()

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/octet-stream',
    },
    body: svg,
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`GitHub image upload failed (${response.status}). Check image-token access.`)

  const attachment = await response.json()
  if (!attachment.url) throw new Error('GitHub returned no image attachment URL.')
  return attachment.url
}

function format(number) {
  return number.toLocaleString('en-US')
}
