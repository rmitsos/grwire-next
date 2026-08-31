import test from "node:test";
import assert from "node:assert/strict";
import { storyDateToIso } from "../src/story-date.js";

test("story dates handle Postgres Date objects and date strings", () => {
  assert.equal(storyDateToIso(new Date("2026-08-31T00:00:00.000Z")), "2026-08-31T00:00:00.000Z");
  assert.equal(storyDateToIso("2026-08-31"), "2026-08-31T00:00:00.000Z");
  assert.equal(storyDateToIso(null), null);
});
