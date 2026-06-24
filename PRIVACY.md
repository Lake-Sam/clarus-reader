# Privacy

Clarus Reader is designed without a developer-operated server.

## Stays on the device

- Managed copies of imported PDF files in Clarus's local application-data folder
- Extracted page text and local search indexes, except passages sent for an AI request
- Provider API keys, stored by Windows Credential Manager
- Settings and per-document or per-project conversation history
- Dictionary searches and WordNet data

## Sent to a model provider

When a user requests an explanation or sends a chat message, Clarus sends the question, relevant PDF passages, page numbers, and recent conversation turns directly to the configured OpenAI, Anthropic, compatible, or Ollama endpoint. When the capture tool is used, only the selected image region is sent with the explanation request. That provider's privacy policy and retention settings apply.

External-context chat sends no PDF passages and relies only on the selected model's built-in knowledge. Clarus does not include analytics, advertising, crash reporting, or telemetry. Removing a provider key in Settings deletes the corresponding Windows credential. Deleting a managed PDF removes Clarus's copy and its index but does not affect the original file that was imported.
