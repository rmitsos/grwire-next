import { SOURCES } from "../config/sources.js";
import { scanMarket } from "../src/index.js";

try {
  const report = await scanMarket({ sources: SOURCES });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.sources.some((source) => source.ok)) process.exitCode = 2;
} catch (error) {
  process.stderr.write(`Market scan failed: ${error?.message || error}\n`);
  process.exitCode = 1;
}
