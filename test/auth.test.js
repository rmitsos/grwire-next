import test from "node:test";
import assert from "node:assert/strict";
import {
  createSessionToken,
  passwordMatches,
  verifySessionToken,
} from "../src/auth-core.js";

test("private sessions are signed and reject altered tokens", () => {
  const token = createSessionToken("test-secret");
  assert.equal(verifySessionToken(token, "test-secret"), true);
  assert.equal(verifySessionToken(`${token}x`, "test-secret"), false);
  assert.equal(verifySessionToken(token, "wrong-secret"), false);
});

test("password comparison fails closed when configuration is absent", () => {
  const previous = process.env.DASHBOARD_PASSWORD;
  delete process.env.DASHBOARD_PASSWORD;
  assert.equal(passwordMatches("anything"), false);
  process.env.DASHBOARD_PASSWORD = "correct horse";
  assert.equal(passwordMatches("correct horse"), true);
  assert.equal(passwordMatches("wrong"), false);
  if (previous === undefined) delete process.env.DASHBOARD_PASSWORD;
  else process.env.DASHBOARD_PASSWORD = previous;
});
