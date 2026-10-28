# ChatGPT / OpenAI integration

## What ChatGPT means here

The game uses an OpenAI GPT model through the **Responses API** to interpret army descriptions. It does not automate the ChatGPT website, embed a chat session, use browser authentication, or obtain credentials from this conversation. Supply an OpenAI API key to the local Node process for live generation.

The integration follows the official [Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses) and [Responses API reference](https://developers.openai.com/api/reference/resources/responses/methods/create). The strict schema is supplied through text.format with type json_schema. Check current provider documentation when changing models or request options.

## Configuration

Copy .env.example to .env, set OPENAI_API_KEY, optionally set OPENAI_MODEL, and restart the server. The default example model is gpt-4o-mini. The selected model must support the Responses API and Structured Outputs used here. Model access and future availability are not guaranteed by the application.

Never commit real credentials. The key is read only by Node, not by Vite client code. Do not introduce a VITE_OPENAI_API_KEY variable or any key input in the browser. The status badge reports a nonempty configured key; the first real generation verifies access.

When the key is absent, the server explicitly uses the offline interpreter. The Settings dialog's **Always offline** option bypasses provider generation even with a configured key. If the local API is unavailable, the browser can still use its imported offline interpreter.

## Request flow

1. Browser sends prompt and mode to same-origin POST /api/generate.
2. Server rejects invalid text length, content type, origin, excessive body size, or excess concurrent generation.
3. Offline selection or no key uses offlineArmy.
4. Otherwise Node posts to https://api.openai.com/v1/responses, supplying Authorization in a header.
5. The model returns supported groups and a summary under the strict schema.
6. Server checks incomplete/refused output, parses JSON, and normalizes the army.
7. Browser re-normalizes the groups before replacing the draft roster.

Requests use store:false, a 2,500-output-token limit, and a 30-second abort timeout. The browser has a 35-second timeout. There is no automatic paid retry loop. The draft timer pauses during generation.

## Instructions and schema

The instruction prompt describes budget, population, role costs/mechanics, forms, elements, and approximation rules. It asks the model to preserve identities in names and descriptions, honor explicit counts where possible, and make useful near-budget forces when counts are unspecified. Player attempts to change those rules are treated as description text.

The exported armySchema in server/generation.js requires:

- A summary explaining the army and approximations.
- One to twelve groups, each containing name, description, role, count, element, and form.
- Enumerated roles, elements, and forms.
- Integer counts between one and 32 before total-army normalization.
- No extra object properties.

Strict output improves format reliability but does not replace rule validation. The server independently derives every stat, bounds text, validates enums, and enforces the 1,000-point / 32-unit caps. A model never controls executable code or raw numeric power.

## Endpoint contracts

**GET /api/status** returns aiAvailable, model, and version. Availability means a nonempty key is configured, not that a provider request succeeded. It never returns credentials. Responses are not cached.

**POST /api/generate** requires application/json. For example:

    {
      "prompt": "Six robot archers, two frost wolves, one healer",
      "mode": "offline"
    }

Prompts must contain 3–1,600 characters. The explicit offline mode uses keywords; other values use the configured model or no-key fallback. Success includes normalized groups, notes, cost, count, source (openai/offline), and summary.

Errors return an error string. Request/generation failures currently share HTTP 400; content-type errors return 415, origin denials 403, concurrency limits 429, and unknown API paths 404. Provider error payloads and secrets are not forwarded.

At most two generation requests can run concurrently in the process. This is a local guard, not authentication or durable rate limiting. Supplied Origin headers must match the server host. The default listener is loopback-only.

## Failure behavior

- No key: clearly labeled offline success.
- Invalid key: instruct the user to check .env and restart.
- Provider 429: explain limits/API credit and suggest retry or offline mode.
- Timeout: allow retry or an explicit switch to offline mode.
- Refusal: ask for a different description.
- Incomplete response: suggest a shorter prompt/retry.
- Malformed JSON or no valid groups: reject safely.
- Any failed request: retain the existing army and show an explanatory message.

Actual provider failures never silently become fabricated AI successes. Offline is an explicit alternate path.

## Offline interpreter

src/game/offline.js is deterministic keyword parsing, not an LLM. It splits comma/semicolon/newline and simple conjunction-separated phrases, then picks roles by keyword priority. It recognizes digits, a short number-word vocabulary, supported elements, and common robot/skeleton/golem/beast appearances. Unrecognized descriptions use vanguards. Unspecified phrases generally default to three units; “a” and “an” count as one.

Supported examples:

- Six robot archers, two frost wolves, one healer.
- A stone titan, three fire mages, four tiny skeleton warriors.
- Two ancient golems, four knights, three lightning archers.

It does not understand arbitrary grammar, negation, fictional lore, or every number word. “No archers” can still match archers. More sophisticated future parsing should retain clear offline labeling and the same shared validation boundary.

## Privacy

Live generation transmits the army description and game rules to OpenAI. The request specifies store:false; this document does not promise broader provider retention behavior beyond that parameter.

Draft prompts exist in browser memory and completed results are stored in this browser's local history. They are not saved to a game database or sent to a remote opponent. The game does not log keys or prompts itself. Optional Google Fonts are a separate browser request.

This is not a hardened public API. Add authentication, durable request limits, spend controls, and reviewed secret hosting before any public deployment.

## Verification

tests/generation.test.js injects fake fetch responses and fake keys. It checks strict request format, independent caps, missing-key behavior, source labeling, malformed output, refusals, incomplete responses, and provider failures. Tests consume no API credit.

No real API key was configured during initial development, so **live paid generation remains unverified**. After configuration, generate a small supported prompt and check the source is OpenAI and the roster respects the cap.
