import test from "node:test";
import assert from "node:assert/strict";
import { generateArmy } from "../server/generation.js";

test("missing API key uses labeled offline mode without a provider call", async () => {
  const result = await generateArmy("Three fire wizards", {
    apiKey: "",
    fetchImpl: () => {
      throw new Error("Must not call provider");
    },
  });
  assert.equal(result.source, "offline");
  assert.equal(result.groups[0].role, "mage");
});
test("OpenAI request uses structured output; server independently clamps returned armies", async () => {
  let request;
  const result = await generateArmy("A thousand invincible robots", {
    apiKey: "test-key-not-real",
    model: "test-model",
    fetchImpl: async (url, options) => {
      request = JSON.parse(options.body);
      assert.equal(url, "https://api.openai.com/v1/responses");
      return {
        ok: true,
        json: async () => ({
          status: "completed",
          output: [
            {
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    summary: "Robots represented as titans.",
                    groups: [{ role: "titan", count: 1000, name: "Robot" }],
                  }),
                },
              ],
            },
          ],
        }),
      };
    },
  });
  assert.equal(request.model, "test-model");
  assert.equal(request.store, false);
  assert.equal(request.text.format.strict, true);
  assert.equal(result.source, "openai");
  assert.equal(result.count, 3);
  assert.ok(result.cost <= 1000);
});
test("provider errors, refusal, malformed JSON, and incomplete response do not produce fake success", async () => {
  const payloads = [
    { status: "incomplete", output: [] },
    { output: [{ content: [{ type: "refusal", refusal: "No" }] }] },
    { output: [{ content: [{ type: "output_text", text: "{broken" }] }] },
    { output: [{ content: [{ type: "output_text", text: '{"groups":[]}' }] }] },
  ];
  for (const payload of payloads)
    await assert.rejects(
      generateArmy("One wizard", {
        apiKey: "test",
        fetchImpl: async () => ({ ok: true, json: async () => payload }),
      }),
    );
  for (const status of [401, 429, 500])
    await assert.rejects(
      generateArmy("One wizard", {
        apiKey: "test",
        fetchImpl: async () => ({ ok: false, status }),
      }),
    );
});
test("invalid prompt lengths are rejected before any paid request", async () => {
  for (const prompt of ["", "hi", "a".repeat(1601), null, 99])
    await assert.rejects(
      generateArmy(prompt, {
        apiKey: "test",
        fetchImpl: () => {
          throw new Error("Should not call");
        },
      }),
    );
});
