# Custom groups

Create a JSON array, then pass its repository path as the `config` input:

```json
[
  {
    "name": "Application",
    "match": ["src/**"],
    "exclude": ["**/*.md"],
    "children": [
      { "name": "Components", "match": ["src/components/**"] },
      { "name": "Other application", "fallback": true }
    ]
  },
  { "name": "Tests", "match": ["tests/**", "**/*.test.*"] }
]
```

| Field      | Meaning                                            |
| :--------- | :------------------------------------------------- |
| `name`     | Required row label                                 |
| `match`    | File globs; any matching pattern selects the group |
| `exclude`  | File globs that prevent a match                    |
| `children` | Nested groups using the same fields                |
| `fallback` | Catch remaining files; place last among siblings   |

- The first matching sibling wins. Parent patterns restrict their children.
- A parent without `match` is selected when a child matches.
- A fallback has only `name` and `fallback: true`. A top-level `Other` fallback is added automatically if absent.
- Patterns use Node's [POSIX `path.matchesGlob`](https://nodejs.org/api/path.html#pathmatchesglobpath-pattern). Use `/` separators; name dot-directories explicitly, such as `.github/**`.
- The file is read from the PR's base commit. Merge a new configuration before enabling it; edits in a PR take effect after merging.

Custom groups replace all default groups. Files are never excluded from the grand total.
