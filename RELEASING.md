# Releasing

Releases are created from version tags and publish the npm package, standalone
Linux binaries, `.deb` packages, and `.rpm` packages together.

## First Release

`codex-history-viewer` must exist in the npm registry before npm Trusted
Publishing can be configured.

1. Create a granular npm access token that can publish
   `codex-history-viewer`.
2. Add it to this GitHub repository as an Actions secret named `NPM_TOKEN`.
3. Do not push the first release tag until the secret has been added.
4. Confirm `package.json` has the intended version and push the corresponding
   tag, for example:

   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

The Release workflow validates the version, builds and smoke-tests the
artifacts, prepares a draft GitHub Release, publishes npm with provenance, and
then publishes the GitHub Release. If npm publication fails, configure the
missing credential and rerun the failed workflow; existing draft assets are
updated in place.

## After The First Release

1. Configure npm Trusted Publishing for the GitHub Actions workflow
   `.github/workflows/release.yml` in repository
   `iskrantxusa/codex-history-viewer`.
2. Delete the `NPM_TOKEN` repository secret.
3. Revoke the temporary npm access token.

Subsequent tagged releases publish through GitHub Actions OIDC without a
long-lived npm token.

## Versioned Releases

For each later release, update `package.json` and `package-lock.json` to the
new version, merge the tested changes to `main`, then push the matching
`vX.Y.Z` tag.
