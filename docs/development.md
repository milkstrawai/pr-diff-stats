# Development

Use Node 24. The action and tests have no npm dependencies.

```sh
mise ci
# Or, with Node 24 installed:
npm test
```

| Path                   | Purpose                                                          |
| :--------------------- | :--------------------------------------------------------------- |
| `action.yml`           | Composite action entry point using `actions/github-script`       |
| `src/action.mjs`       | Read GitHub data and update the bot comment                      |
| `src/report.mjs`       | Classify files and render Markdown                               |
| `src/text-chart.mjs`   | Render text charts with box-drawing characters                   |
| `src/image.mjs`        | Render illustrated SVG reports with bundled styles and font      |
| `src/image-report.mjs` | Upload attachments and build image comments                      |
| `src/defaults.json`    | Default file groups                                              |
| `test/`                | Node tests and fixtures, including migrated Rails grouping cases |

## Releases

1. Run `mise ci` and wait for GitHub CI to pass on `main`.
2. Create a version tag, such as `v1.0.1`, and a GitHub release with short notes.
3. Move the `v1` tag to the tested commit for compatible updates. Keep version tags unchanged.

Private usage requires Settings → Actions → General → Access → organization access. This action needs a public repository before it can be [listed in Marketplace](https://docs.github.com/en/actions/how-tos/create-and-publish-actions/publish-in-github-marketplace).
