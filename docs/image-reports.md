# Image reports

The action renders an illustrated SVG in Node, embeds its font, and uploads it as a GitHub.com attachment. Custom groups work with both report formats.

## PAT setup

1. Create a fine-grained personal access token from an account with write access to the repository running the action.
2. Limit it to that repository and grant **Contents: Read and write**.
3. Save it as the repository Actions secret `PR_DIFF_IMAGE_TOKEN`.
4. Add these inputs to the action step:

```yaml
- uses: milkstrawai/pr-diff-stats@v1
  with:
    format: image
    image-token: ${{ secrets.PR_DIFF_IMAGE_TOKEN }}
```

## Behavior

- The PAT uploads attachments only. The automatic `GITHUB_TOKEN` still creates or updates the bot comment.
- GitHub's attachment endpoint [accepts user tokens, not Actions installation tokens](https://github.com/cli/cli/blob/v2.101.0/internal/attachments/client.go).
- Unchanged images are not uploaded again. Upload failures leave the previous comment intact.
- To switch back, remove both image inputs. The same comment becomes a Markdown table.
- Supplying a token alone keeps Markdown; image mode requires `format: image`.
