import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

test("real local server validates API requests and never serves private/source files", async (t) => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const child = spawn(process.execPath, ["server/index.js", "--production"], {
    cwd: root,
    env: { ...process.env, PORT: "0", HOST: "127.0.0.1", OPENAI_API_KEY: "" },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  t.after(() => child.kill());
  const base = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Local test server did not start.")),
      8000,
    );
    let output = "";
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error("Local test server exited: " + code));
    });
    child.stdout.on("data", (data) => {
      output += data.toString();
      const match = output.match(/Local: (http:\/\/127\.0\.0\.1:\d+)/);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
  });
  async function expect(path, options, status) {
    const response = await fetch(base + path, options);
    assert.equal(response.status, status, path);
    return response;
  }
  const status = await (await expect("/api/status", undefined, 200)).json();
  assert.equal(status.aiAvailable, false);
  assert.ok(!Object.hasOwn(status, "apiKey"));
  const options = (prompt) => ({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, mode: "offline" }),
  });
  const army = await (
    await expect("/api/generate", options("1000 invincible stone titans"), 200)
  ).json();
  assert.equal(army.source, "offline");
  assert.equal(army.count, 3);
  assert.equal(army.cost, 900);
  await expect("/api/generate", options("hi"), 400);
  await expect("/api/generate", options("a".repeat(1601)), 400);
  await expect(
    "/api/generate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{bad",
    },
    400,
  );
  await expect(
    "/api/generate",
    { method: "POST", headers: { "Content-Type": "text/plain" }, body: "{}" },
    415,
  );
  const cross = options("One knight");
  cross.headers.Origin = "https://unrelated.example";
  await expect("/api/generate", cross, 403);
  await expect("/api/unknown", undefined, 404);
  await expect("/.env", undefined, 404);
  await expect("/.git/config", undefined, 404);
  await expect("/server/generation.js", undefined, 404);
});
