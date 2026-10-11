# Development

Use Node 24. The action and tests have no npm dependencies.

```sh
mise ci
# Or, with Node 24 installed:
npm test
npm run format:check
```

`npm run format` fixes formatting. Both scripts run a pinned oxfmt through `npx`.

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

1. On an up-to-date `main`, run `mise ci` and wait for GitHub CI to pass.
2. Create an annotated version tag, such as `v1.2.1`, and a GitHub release with short notes:

   ```sh
   git tag -a v1.2.1 -m "Short summary"
   git push origin v1.2.1
   gh release create v1.2.1 --verify-tag --title "v1.2.1 — Short title" --notes-file /tmp/notes.md
   ```

3. Move the `v1` tag to the new version for compatible updates. Keep version tags unchanged; breaking changes get a new `v2`. Moving `v1` takes a force push, as in [GitHub's versioning guide](https://github.com/actions/toolkit/blob/main/docs/action-versioning.md).

   ```sh
   git tag -f -a v1 -m "PR diff stats v1.2.1" 'v1.2.1^{}'
   git push --force origin refs/tags/v1
   ```
