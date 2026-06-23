# Releasing Clarus Reader

GitHub Actions builds Windows installers whenever a version tag is pushed.

1. Update the version in `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`.
2. Run tests and a local Tauri build.
3. Commit the version change and tag it, for example `git tag v0.1.0`.
4. Push the commit and tag. The release workflow creates a draft GitHub Release with `.exe` and `.msi` installers.
5. Test the installer, edit the release notes, and publish the draft.

Unsigned builds trigger Windows SmartScreen warnings. For a public launch, obtain an Authenticode certificate and configure Tauri signing secrets before publishing. GitHub Releases remains the download host either way.
