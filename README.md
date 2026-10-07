# PR diff stats

One comment showing a pull request's changed files and lines, updated after each push. Markdown is the default; illustrated SVG reports are optional.

| Group     | Files |    Added | Deleted | Changed |
| :-------- | ----: | -------: | ------: | ------: |
| Source    |     3 |     +120 |     -30 |     150 |
| Tests     |     2 |      +60 |     -10 |      70 |
| **Total** | **5** | **+180** | **-40** | **220** |

## Use

Add `.github/workflows/pr-diff-stats.yml`:

```yaml
name: PR diff stats

on:
  pull_request_target:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write

concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number }}
  cancel-in-progress: true

jobs:
  report:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: milkstrawai/pr-diff-stats@v1
```

The default Markdown report uses the automatic `GITHUB_TOKEN` and needs no extra secrets. Neither format requires a checkout or dependency installation. To pin a release, use its full commit SHA instead of `v1`.

While this repository is private, it is available to private repositories in `milkstrawai` through [organization action sharing](https://docs.github.com/en/actions/how-tos/reuse-automations/share-with-your-organization). Public repositories can use it after this repository becomes public.

## Optional image reports

![Example image report: 5 files, 180 added lines, 40 deleted lines, and 220 changed lines.](docs/assets/example-report.svg)

```yaml
- uses: milkstrawai/pr-diff-stats@v1
  with:
    format: image
    image-token: ${{ secrets.PR_DIFF_IMAGE_TOKEN }}
```

Image reports use a PAT to upload the SVG as a GitHub attachment. See the short [PAT setup guide](docs/image-reports.md).

| Input         | Default    | Purpose                                          |
| :------------ | :--------- | :----------------------------------------------- |
| `format`      | `markdown` | Choose `markdown` or `image`                     |
| `image-token` | Empty      | PAT for image uploads; required only for `image` |
| `config`      | Empty      | Optional JSON group file in the PR base commit   |

## Default groups

Rules run in this order; the first match wins.

| Group          | Common matches                                          |
| :------------- | :------------------------------------------------------ |
| Docs           | Documentation folders, Markdown, licenses               |
| Tests          | Test folders, fixtures, test/spec filenames             |
| Dependencies   | Package manifests and lockfiles across common languages |
| CI             | GitHub Actions, GitLab CI, CircleCI, Jenkins            |
| Infrastructure | Terraform, Kubernetes, Helm, Docker                     |
| Config         | Configuration files and folders                         |
| Source         | Common source folders, code files, and public assets    |
| Other          | Everything else                                         |

See the [exact patterns](src/defaults.json).

## Custom groups

```yaml
- uses: milkstrawai/pr-diff-stats@v1
  with:
    config: .github/pr-diff-groups.json
```

The optional `config` input replaces the defaults with your JSON groups. Nested groups and exclusions are supported. See [configuration examples](docs/configuration.md).

## Behavior

- Changed lines = additions + deletions. Every file counts once in the total.
- Parent rows include their children. Empty groups are hidden; binary changes and pure renames still count as files.
- Unchanged reports and stale runs are skipped. PR descriptions are never edited.
- Only GitHub file metadata and JSON configuration from the PR base commit are read. PR code is never checked out or executed.
- GitHub returns at most [3,000 changed files](https://docs.github.com/en/rest/pulls/pulls#list-pull-requests-files). Larger or incomplete results fail without replacing the previous comment.

## Development

See [testing and releases](docs/development.md).

Licensed under [MIT](LICENSE).

The bundled Patrick Hand font uses the [SIL Open Font License](src/assets/OFL.txt).
