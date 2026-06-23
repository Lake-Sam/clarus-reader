# Contributing

Issues and pull requests are welcome. Keep changes focused, accessible, and local-first.

1. Fork the repository and create a feature branch.
2. Run `npm install`, `npm test`, and `npm run build`.
3. For Rust or packaging changes, also run `npm run tauri build` on Windows.
4. Explain user impact, privacy implications, and verification in the pull request.

Do not add telemetry, proxy user documents through a hosted service, or persist API keys outside the operating-system credential store. New dependencies should have a clear usability or maintenance benefit.
