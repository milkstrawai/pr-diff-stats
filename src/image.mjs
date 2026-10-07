import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const font = readFileSync(join(import.meta.dirname, 'assets/PatrickHand.woff2'))
const styles = ['image-theme.css', 'image.css']
  .map((file) => readFileSync(join(import.meta.dirname, file), 'utf8'))
  .join('\n')
  .replace('FONT_DATA', font.toString('base64'))

export function renderImage({ total, groups }) {
  const roots = groups.filter((group) => group.totals?.files > 0)
  const maximum = Math.max(1, ...roots.map((group) => group.totals.additions + group.totals.deletions))
  const extra = Math.max(0, format(maximum).length - 5) * 9
  const columnWidth = 400 + extra * 3
  const columns = splitColumns(roots)
  const width = 12 + columns.length * (columnWidth + 14)
  const narrow = columns.length === 1
  const top = narrow ? 136 : 112
  const drawings = []
  let bottom = roots.length ? top : top + 30

  for (const [index, column] of columns.entries()) {
    const x = 20 + index * (columnWidth + 14)
    let y = top
    drawings.push(renderValues(['Segment', 'Files', 'Added', 'Deleted', 'Changed'], x, y - 25, extra, 'muted'))
    for (const root of column) {
      const group = renderGroup(root, x, y, maximum, extra)
      drawings.push(group.svg)
      y = group.bottom
    }
    bottom = Math.max(bottom, y)
  }

  const height = bottom + 52
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description">
    <title id="title">PR diff stats</title>
    <desc id="description">${format(total.files)} files, ${format(total.additions)} added lines, ${format(total.deletions)} deleted lines. Parent totals include their children.</desc>
    <style>${styles}</style>
    <rect width="100%" height="100%" class="paper"/>
    ${text(20, 29, 'PR scribbles', 'title')}
    ${text(narrow ? 20 : width - 20, narrow ? 52 : 28, `${format(total.additions + total.deletions)} changed lines · ${format(total.files)} files`, 'label', narrow ? 'start' : 'end')}
    ${narrow ? '' : text(20, 52, 'Full breakdown · every little plot twist.', 'muted')}
    ${text(width - 170, narrow ? 76 : 52, `+${format(total.additions)} hired`, 'added', 'end')}
    ${text(width - 20, narrow ? 76 : 52, `−${format(total.deletions)} retired`, 'deleted', 'end')}
    ${line(20, top - 47, width - 20, top - 47)}
    ${roots.length ? drawings.join('') : text(20, top, 'No changed files.', 'muted')}
    ${line(20, bottom - 1, width - 20, bottom - 1)}
    ${text(20, bottom + 21, 'Parents include the kids. Each file counted once.', 'muted')}
    ${text(20, bottom + 41, 'Changed = added + deleted. Math: still serious.', 'muted')}
  </svg>`
}

function splitColumns(groups) {
  if (groups.length < 2) return [groups]
  const heights = groups.map(groupHeight)
  const total = heights.reduce((sum, height) => sum + height, 0)
  let split = 1
  let left = 0
  let best = Infinity
  for (let index = 1; index < groups.length; index++) {
    left += heights[index - 1]
    const difference = Math.abs(total - left * 2)
    if (difference < best) {
      split = index
      best = difference
    }
  }
  return [groups.slice(0, split), groups.slice(split)]
}

function groupHeight(group, depth = 0) {
  return (depth === 0 ? 40 : 22) + children(group).reduce((height, child) => height + groupHeight(child, depth + 1), 0)
}

function children(group) {
  return (group.children ?? []).filter((child) => child.totals?.files > 0)
}

function renderGroup(root, x, y, maximum, extra) {
  const rows = [renderRow(root, 0, x, y, maximum, extra)]
  const branches = []
  let cursor = y + 36

  function visit(parent, depth, parentY) {
    const nodes = children(parent)
    const rail = x + (depth - 1) * 18 + 5
    let lastY = parentY
    for (const node of nodes) {
      lastY = cursor
      rows.push(renderRow(node, depth, x, cursor, maximum, extra))
      branches.push(line(rail, cursor - 4, rail + 9, cursor - 4))
      cursor += 22
      visit(node, depth + 1, lastY)
    }
    if (nodes.length) branches.push(line(rail, parentY + (depth === 1 ? 20 : 9), rail, lastY - 4))
  }

  visit(root, 1, y)
  return { svg: branches.join('') + rows.join(''), bottom: cursor + 4 }
}

function renderRow(node, depth, x, y, maximum, extra) {
  const type = depth === 0 ? 'group' : node.children ? 'label' : ''
  const values = [
    node.name,
    format(node.totals.files),
    node.totals.additions ? `+${format(node.totals.additions)}` : '0',
    node.totals.deletions ? `−${format(node.totals.deletions)}` : '0',
    format(node.totals.additions + node.totals.deletions),
  ]
  const barY = y + (depth === 0 ? 11 : 7)
  const barX = x + depth * 18
  const scale = (342 + extra * 3) / maximum
  const added = node.totals.additions * scale
  const deleted = node.totals.deletions * scale
  const height = depth === 0 ? 5 : 2

  return `<g data-depth="${depth}">
    ${depth === 0 ? `<path d="M${x - 3} ${y - 10} Q${x + 55} ${y - 14} ${x + 113} ${y - 10} L${x + 112} ${y + 2} Q${x + 55} ${y + 5} ${x - 2} ${y + 3} Z" class="marker"/>` : ''}
    ${renderValues(values, x, y, extra, type, depth)}
    ${bar(barX, barY, added, height, 'add-bar')}
    ${bar(barX + added, barY, deleted, height, 'delete-bar')}
  </g>`
}

function bar(x, y, width, height, type) {
  if (!width) return ''
  return `<path d="M${x} ${y} Q${x + width * 0.35} ${y - 0.7} ${x + width} ${y + 0.3} L${x + width} ${y + height} Q${x + width * 0.6} ${y + height + 0.6} ${x} ${y + height - 0.2} Z" class="${type}"/>`
}

function renderValues(values, x, y, extra, type, depth = 0) {
  const positions = [depth * 18, 180, 244 + extra, 300 + extra * 2, 386 + extra * 3]
  const classes = type === 'muted' ? values.map(() => type) : [type, 'muted', 'added', 'deleted', type || 'label']
  return values
    .map((value, index) => text(x + positions[index], y, value, classes[index], index ? 'end' : 'start'))
    .join('')
}

function text(x, y, value, type, anchor = 'start') {
  const escaped = String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  return `<text x="${x}" y="${y}" class="${type}" text-anchor="${anchor}">${escaped}</text>`
}

function line(x1, y1, x2, y2) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="line"/>`
}

function format(number) {
  return number.toLocaleString('en-US')
}
