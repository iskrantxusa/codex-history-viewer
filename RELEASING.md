# Releasing

Releases are created from version tags and publish the npm package, standalone
Linux binaries, `.deb` packages, and `.rpm` packages together.

## npm Trusted Publishing

`codex-history-viewer@0.1.0` has been published. Configure npm Trusted
Publishing for GitHub Actions workflow `.github/workflows/release.yml` and
remove the bootstrap `NPM_TOKEN` secret before publishing subsequent versions.

The Release workflow validates the version, builds and smoke-tests artifacts,
prepares a draft GitHub Release, publishes npm with provenance, and then
publishes the GitHub Release. Existing draft assets are updated on rerun.

## Versioned Releases

For each later release, update `package.json` and `package-lock.json` to the
new version, merge the tested changes to `main`, then push the matching
`vX.Y.Z` tag.

## Launchpad PPA

The `Publish PPA` workflow packages a published standalone release into
signed Debian source uploads for Ubuntu 24.04 (`noble`) and Ubuntu 26.04
(`resolute`).

Before the first PPA upload:

1. Create `ppa:iskrantxusa/codex-history-viewer` in Launchpad.
2. Create a dedicated OpenPGP release key and register its public key in the
   Launchpad account that owns the PPA.
3. Add the armored private key and passphrase as repository secrets:
   `PPA_GPG_PRIVATE_KEY` and `PPA_GPG_PASSPHRASE`.
4. Publish `v0.1.1`; its archives include the embedded Node.js runtime notices
   required by the PPA packages.

The PPA workflow runs after a GitHub Release is published and can also be
rerun manually for an existing release tag.
