import test from "node:test";
import assert from "node:assert/strict";
import { detectArticleOrganizations } from "../src/index.js";

test("articles connect to organisations through Greek and English aliases", () => {
  const matches = detectArticleOrganizations({
    title: "Ο ΟΤΕ επεκτείνει το δίκτυο FTTH",
    summary: "The project will compete with PPC FiberGrid.",
  });
  assert.equal(matches.some((match) => match.organizationId === "ote"), true);
  assert.equal(matches.some((match) => match.organizationId === "ppc-fiber"), true);
  assert.equal(matches.find((match) => match.organizationId === "ote").confidence, 1);
});

test("short aliases do not match inside unrelated words", () => {
  const matches = detectArticleOrganizations({
    title: "A note about European markets",
    summary: "",
  });
  assert.equal(matches.some((match) => match.organizationId === "ote"), false);
});
