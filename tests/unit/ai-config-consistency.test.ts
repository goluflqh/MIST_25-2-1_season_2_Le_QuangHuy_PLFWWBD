import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const expectedModel = "cx/gpt-5.6-luna";
const expectedReasoningEffort = "medium";

function readRepoFile(path: string) {
  return readFileSync(path, "utf8");
}

test("keeps the 9router model and reasoning defaults synchronized", () => {
  const route = readRepoFile("app/api/chat/route.ts");
  const envExample = readRepoFile(".env.example");
  const compose = readRepoFile("docker-compose.yml");
  const ci = readRepoFile(".github/workflows/ci.yml");
  const deploymentGuide = readRepoFile("docs/deploy-digitalocean-vps.md");

  assert.match(route, new RegExp(`DEFAULT_9ROUTER_MODEL = "${expectedModel}"`));
  assert.match(route, /DEFAULT_9ROUTER_REASONING_EFFORT: ReasoningEffort = "medium"/);
  assert.match(route, /reasoning_effort: reasoningEffort/);

  for (const content of [envExample, compose, ci, deploymentGuide]) {
    assert.match(content, new RegExp(expectedModel.replaceAll(".", "\\.")));
    assert.match(content, new RegExp(expectedReasoningEffort));
    assert.doesNotMatch(content, /NINE_ROUTER_MODEL[^\n]*cx\/gpt-5\.2/);
  }
});
