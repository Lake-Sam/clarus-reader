# Privacy

Clarus Reader is designed without a developer-operated server.

## Stays on the device

- The original PDF file
- Extracted document text, except passages sent for an AI request
- Provider API keys, stored by Windows Credential Manager
- Settings and per-document conversation history
- Dictionary searches and WordNet data

## Sent to a model provider

When a user requests an explanation or sends a chat message, Clarus sends the question, relevant PDF passages, page numbers, and recent conversation turns directly to the configured OpenAI, Anthropic, compatible, or Ollama endpoint. When the capture tool is used, only the selected image region is sent with the explanation request. That provider's privacy policy and retention settings apply.

Clarus does not include analytics, advertising, crash reporting, or telemetry. Removing a provider key in Settings deletes the corresponding Windows credential. Clearing a conversation deletes that document's locally saved chat history.
