# Chat providers

Each file here connects `/plugin/chat` to one LLM service. Pick one with `chat.provider` in `config.js`
(the file name without `.js`).

| Provider | Config |
|---|---|
| `mistral` | `apiKey`, `model` (e.g. `mistral-small-2603`), optional `temperature` (0.7), `requestsPerSecond` (1), `tokensPerMinute` (20000), `baseUrl`. Requests are queued to stay within the limits and 429/5xx are retried. Set env `CHAT_DEBUG=1` to log token usage per request. |

A provider exports `createProvider(chatConfig)` and returns an object with one method:

```js
module.exports = {
    createProvider(chatConfig) {        // the whole `chat` object from config.js (apiKey, model, ...)
        return {
            // Set to true once generate() handles `tools` (below). Without it Alice can't look up
            // channel history and only sees the last 30 minutes.
            supportsTools: false,

            // system:    the persona prompt (string)
            // messages:  conversation, oldest first (see message shapes below)
            // maxTokens: reply length cap
            // tools:     optional; [{name, description, parameters}] where parameters is a JSON Schema object
            async generate({system, messages, maxTokens, tools}) {
                // Return the reply text, or when the model wants tools:
                //   {text: 'optional text', toolCalls: [{id, name, input}]}
                // Throw on failure; Alice answers with a fallback line.
                return 'reply text';
            },
        };
    },
};
```

Message shapes in `messages` (translate them to the service's own format):

| Shape | Meaning |
|---|---|
| `{role: 'user', content}` | something said in the channel (already prefixed with time and name) |
| `{role: 'assistant', content}` | something Alice said |
| `{role: 'assistant', content, toolCalls: [{id, name, input}]}` | Alice asked for tools (echo of your earlier return value) |
| `{role: 'tool', toolCallId, name, content}` | the result of one tool call (plain text) |

Consecutive `user` messages can occur; merge them if the service requires alternating roles.
