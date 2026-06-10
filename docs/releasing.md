# Releasing

OpenCook uses Release Please, but the workflow is intentionally manual. The
current release version starts in the root `package.json` and
`.release-please-manifest.json`. Release Please also updates the API and web
package versions, plus the API metadata version used by `/api/health`,
`/api/info`, and `/openapi.json`.

## Commit Format

Release Please reads Conventional Commits from `main`:

- `fix: ...` proposes a patch release.
- `feat: ...` proposes a minor release.
- `feat!: ...` or a `BREAKING CHANGE:` footer proposes a breaking release.

To force a specific release version, merge a commit with a `Release-As` footer:

```text
chore: release 0.2.0

Release-As: 0.2.0
```

## GitHub Workflow

1. Open GitHub Actions and run `Release Please` with `mode` set to `prepare`.
2. Review the generated `chore: release ...` pull request. Edit the changelog in
   that PR if needed.
3. Merge the release PR when ready.
4. Run `Release Please` again with `mode` set to `publish` to create the tag and
   GitHub Release.

The workflow uses `GITHUB_TOKEN` by default. If you want Release Please PRs to
trigger other workflows, add a `RELEASE_PLEASE_TOKEN` secret containing a
personal access token with repository write access.

## Local CLI

You can run the same two phases locally:

```sh
npx release-please@latest release-pr \
  --token="$GITHUB_TOKEN" \
  --repo-url="<owner>/<repo>" \
  --target-branch=main
```

After merging the release PR:

```sh
npx release-please@latest github-release \
  --token="$GITHUB_TOKEN" \
  --repo-url="<owner>/<repo>" \
  --target-branch=main
```
