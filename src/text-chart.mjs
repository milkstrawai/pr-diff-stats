import { marker } from './report.mjs'

const headings = ['Files', 'Added', 'Deleted', 'Changed']
const notes = ['Parents include the kids. Each file counted once.', 'Changed = added + deleted. Math: still serious.']

export function renderTextChart({ total, groups }, sha) {
  const rows = listRows(groups)
  const columns = headings.map(
    (heading, index) => Math.max(heading.length, ...rows.map((row) => row.values[index].length)) + 2,
  )
  const numberWidth = columns.reduce((sum, column) => sum + column, 0)
  const nameWidth = Math.min(20, Math.max('Segment'.length, ...rows.map((row) => row.label.length)))
  const width = Math.max(nameWidth + numberWidth, ...notes.map((note) => note.length))
  const line = (name, cells) =>
    name.padEnd(width - numberWidth) + cells.map((cell, index) => cell.padStart(columns[index])).join('')
  const deepest = Math.max(0, ...rows.map((row) => row.depth))
  const scale = (width - deepest * 2 - 1) / Math.max(1, ...rows.map((row) => row.additions + row.deletions))
  const changed = `${format(total.additions + total.deletions)} changed lines · ${format(total.files)} files`

  return [
    marker,
    '```text',
    `PR scribbles ${changed.padStart(width - 13)}`,
    `+${format(total.additions)} hired ━━   −${format(total.deletions)} retired ╍╍`.padStart(width),
    '─'.repeat(width),
    ...(rows.length
      ? [
          line('Segment', headings),
          ...rows.flatMap((row) => [
            line(shorten(row.label, width - numberWidth), row.values),
            (row.rail + bar(row, scale)).trimEnd(),
          ]),
        ]
      : ['No changed files.']),
    '─'.repeat(width),
    ...notes,
    '```',
    '',
    `Updated for \`${sha.slice(0, 7)}\`.`,
  ].join('\n')
}

function listRows(groups = [], depth = 0, rails = '') {
  const visible = groups.filter((group) => group.totals?.files > 0)
  return visible.flatMap((group, index) => {
    const last = index === visible.length - 1
    const rail = depth ? rails + (last ? '  ' : '│ ') : ''
    const { files, additions, deletions } = group.totals
    const values = [format(files), format(additions, '+'), format(deletions, '−'), format(additions + deletions)]
    const label = (depth ? rails + (last ? '└ ' : '├ ') : '') + group.name.replace(/\s+/g, ' ').trim()
    return [{ depth, rail, label, values, additions, deletions }, ...listRows(group.children, depth + 1, rail)]
  })
}

function bar({ depth, additions, deletions }, scale) {
  const [solid, dashed] = depth ? ['─', '╌'] : ['━', '╍']
  const added = additions && Math.max(1, Math.round(additions * scale))
  const removed = deletions && Math.max(1, Math.round(deletions * scale))
  return solid.repeat(added) + dashed.repeat(removed)
}

function shorten(name, width) {
  const characters = [...name]
  if (characters.length <= width) return name
  const kept = characters.slice(0, width - 1).join('')
  return `${kept.trimEnd()}…`
}

function format(number, sign = '') {
  return `${number ? sign : ''}${number.toLocaleString('en-US')}`
}
