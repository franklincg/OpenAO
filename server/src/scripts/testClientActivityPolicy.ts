import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "src/server.ts"), "utf8");
const start = source.indexOf("function trackClientActivity");
const end = source.indexOf("\n}\n\n(async () => {", start);

assert.ok(start >= 0 && end > start, "trackClientActivity must remain present");

const fn = source.slice(start, end + 2);
const pingMatch = fn.match(/if \(isPingPacket\) \{([\s\S]*?)\n    \}/);
assert.ok(pingMatch, "ping branch must remain explicit");

const pingBranch = pingMatch[1];
assert.match(fn, /ws\.packetCount = Number\(ws\.packetCount \?\? 0\) \+ 1;/, "all packets increment packetCount");
assert.match(pingBranch, /ws\.lastActivityAt = now;/, "ping must refresh client liveness");
assert.match(pingBranch, /return;/, "ping must return before non-ping accounting");

for (const forbidden of [
    "lastPacketAt",
    "packetCountNonPing",
    "recentPacketTimestamps",
    "recentPacketIntervalsMs",
    "packetTypeCounts",
]) {
    assert.ok(!pingBranch.includes(forbidden), `ping must not mutate non-ping metric: ${forbidden}`);
}

const pingBlockEnd = fn.indexOf("}", fn.indexOf("if (isPingPacket)"));
const nonPingTail = fn.slice(pingBlockEnd + 1);
assert.match(nonPingTail, /ws\.lastPacketAt = now;/, "non-ping packets still refresh lastPacketAt");
assert.match(nonPingTail, /ws\.lastActivityAt = now;/, "non-ping packets still refresh activity");

const idleStart = source.indexOf("function processIdleCharactersTick");
const idleEnd = source.indexOf("\n}\n\nfunction getScoutIdleReferenceAt", idleStart);
assert.ok(idleStart >= 0 && idleEnd > idleStart, "idle sweep must remain present");
const idleFn = source.slice(idleStart, idleEnd + 2);
assert.match(idleFn, /client\.lastActivityAt/, "idle cleanup must continue to use lastActivityAt");

console.log("client activity policy tests passed");
