import { posix } from 'node:path'

import defaults from './defaults.json' with { type: 'json' }

export const marker = '<!-- pr-diff-stats -->'

export function summarize(files, definitions = defaults) {
  validateGroups(definitions)
  const groups = structuredClone(definitions)
  if (!groups.some((group) => group.fallback)) groups.push({ name: 'Other', fallback: true })
  const total = { files: 0, additions: 0, deletions: 0 }

  for (const file of files) {
    const path = findGroupPath(file.filename, groups)
    const totals = path.map((group) => (group.totals ??= { files: 0, additions: 0, deletions: 0 }))
    for (const counts of [total, ...totals]) {
      counts.files += 1
      counts.additions += file.additions
      counts.deletions += file.deletions
    }
  }

  return { total, groups }
}

function validateGroups(groups) {
  if (!Array.isArray(groups)) throw new Error('Group configuration must be a JSON array.')
  for (const [index, group] of groups.entries()) {
    if (!group || typeof group.name !== 'string' || !group.name.trim()) {
      throw new Error('Each group needs a nonempty name.')
    }
    for (const key of ['match', 'exclude']) {
      if (
        group[key] !== undefined &&
        (!Array.isArray(group[key]) || !group[key].every((pattern) => typeof pattern === 'string'))
      ) {
        throw new Error(`${group.name}: ${key} must be an array of glob strings.`)
      }
    }
    if (group.fallback && (index !== groups.length - 1 || group.match || group.exclude || group.children)) {
      throw new Error(`${group.name}: a fallback must be last and have no match, exclude, or children.`)
    }
    if (group.children !== undefined) validateGroups(group.children)
    if (!group.match && !group.children && !group.fallback) {
      throw new Error(`${group.name}: add match patterns, children, or fallback: true.`)
    }
  }
}

export function findGroupPath(filename, groups = defaults) {
  for (const group of groups) {
    if (group.exclude?.some((pattern) => posix.matchesGlob(filename, pattern))) continue
    if (group.match && !group.match.some((pattern) => posix.matchesGlob(filename, pattern))) continue

    if (group.children) {
      const children = findGroupPath(filename, group.children)
      if (children) return [group, ...children]
    } else if (group.match || group.fallback) {
      return [group]
    }
  }

  return null
}

export function renderReport({ total, groups }, sha) {
  return [
    marker,
    '### PR diff stats',
    '',
    ...(total.files
      ? [
          '| Group | Files | Added | Deleted | Changed |',
          '| :--- | ---: | ---: | ---: | ---: |',
          ...renderGroups(groups),
          renderRow('Total', total, true),
          '',
          'Changed = added + deleted. Parent totals include their children; the total counts each file once.',
        ]
      : ['No changed files.']),
    '',
    `Updated for \`${sha.slice(0, 7)}\`.`,
  ].join('\n')
}

function renderGroups(groups, depth = 0) {
  return groups
    .filter((group) => group.totals?.files > 0)
    .flatMap((group) => {
      const name = escapeLabel(group.name)
      const label = `${'&nbsp;&nbsp;'.repeat(depth)}${depth ? '↳ ' : ''}${group.children ? `**${name}**` : name}`
      return [renderRow(label, group.totals), ...renderGroups(group.children ?? [], depth + 1)]
    })
}

function escapeLabel(label) {
  return label
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('|', '&#124;')
    .replace(/([\\`*_[\]])/g, '\\$1')
    .replace(/[\r\n]+/g, ' ')
}

function renderRow(label, total, bold = false) {
  const values = [
    label,
    format(total.files),
    format(total.additions, '+'),
    format(total.deletions, '-'),
    format(total.additions + total.deletions),
  ]
  return `| ${values.map((value) => (bold ? `**${value}**` : value)).join(' | ')} |`
}

function format(number, sign = '') {
  return `${number ? sign : ''}${number.toLocaleString('en-US')}`
}
