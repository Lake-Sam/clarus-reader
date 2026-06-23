# Clarus Reader

Clarus Reader is a private, open-source PDF reader for Windows. It pairs a focused reading surface with offline definitions, plain-language explanations, and AI chat grounded in the document.

![Clarus Reader mark](src/assets/logo.svg)

## What it does

- Defines words locally using Princeton WordNet—no AI or network request.
- Explains selected passages at three levels: very simple, simple, and detailed.
- Chats with a PDF using local relevance search and page citations.
- Supports OpenAI, Anthropic, OpenAI-compatible endpoints, and Ollama.
- Stores provider keys in Windows Credential Manager.
- Keeps settings, highlights-in-progress, and conversations on the device.
- Includes light and dark themes, search, page navigation, and zoom.

Clarus has no account, telemetry, hosted backend, or bundled AI subscription. Users bring their own provider key or use Ollama locally.

## Install

Download the latest `.exe` installer from [GitHub Releases](https://github.com/Lake-Sam/clarus-reader/releases). Windows may warn about early unsigned releases; code signing is documented in [the release guide](docs/RELEASING.md).

## Development

Prerequisites: Node.js 20+, Rust stable, Microsoft C++ Build Tools, and WebView2.

```powershell
npm install
npm run tauri dev
```

`npm install` copies the WordNet database into the local build tree. Those generated dictionary files are intentionally excluded from Git.

Useful checks:

```powershell
npm test
npm run build
npm run tauri build
```

## Privacy model

PDF files are parsed locally. For explanations and chat, Clarus sends the selected or locally retrieved passages directly to the configured provider. API keys remain in Windows Credential Manager and are never exposed to the web interface. Read [PRIVACY.md](PRIVACY.md) for details.

## Project status

Version `0.1.0` is an MVP for text-based PDFs. Scanned-document OCR, writing annotations back into PDF files, streaming responses, and macOS/Linux packages are intentionally deferred.

## License

Clarus Reader is licensed under Apache-2.0. WordNet is redistributed under the Princeton WordNet License; its license is included with release builds.
