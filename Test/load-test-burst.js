/**
 * ChatJet Burst Test — All Users Text Simultaneously
 * ====================================================
 * A two-phase test designed to verify that ALL N users can send messages
 * at the exact same instant. Unlike the ramp-up test, this script:
 *
 *   Phase 1 — CONNECT:  All users connect and join the room (spread over RAMP_UP_MS).
 *                        The script waits until ALL of them are in before proceeding.
 *   Phase 2 — BURST:    At T=0 a countdown fires and EVERY connected user sends
 *                        MESSAGES_PER_USER messages simultaneously (no stagger).
 *                        This creates the highest possible simultaneous message spike.
 *
 * Usage:
 *   node load-test-burst.js
 *
 * Run it yourself — override any setting with env vars:
 *   $env:USERS=1000; node load-test-burst.js                       (full 1000-user burst)
 *   $env:USERS=500;  node load-test-burst.js                       (500 users)
 *   $env:USERS=100;  $env:MESSAGES_PER_USER=10; node load-test-burst.js
 *   $env:TARGET_URL="https://your-app.onrender.com"; node load-test-burst.js  (production)
 *
 * Options (env vars):
 *   TARGET_URL=http://localhost:2800   Server to test (default: localhost:2800)
 *   USERS=1000                         Number of users to connect before burst (default: 1000)
 *   MESSAGES_PER_USER=3                Messages each user fires in the burst (default: 3)
 *   RAMP_UP_MS=8000                    Time (ms) allowed for all users to join (default: 8000)
 *   CONNECT_TIMEOUT_MS=15000           Per-user connection timeout (default: 15000)
 *   BURST_WAIT_MS=3000                 Wait after burst before collecting results (default: 3000)
 *
 * See also: load-test.js — for staggered ramp-up throughput testing.
 */

'use strict';

const { io } = require('socket.io-client');

// ── Config ─────────────────────────────────────────────────────────────────
const TARGET_URL         = process.env.TARGET_URL          || 'http://localhost:2800';
const TOTAL_USERS        = parseInt(process.env.USERS              || '1000');
const MSGS_PER_USER      = parseInt(process.env.MESSAGES_PER_USER  || '3');
const RAMP_UP_MS         = parseInt(process.env.RAMP_UP_MS         || '8000');
const CONNECT_TIMEOUT_MS = parseInt(process.env.CONNECT_TIMEOUT_MS || '15000');
const BURST_WAIT_MS      = parseInt(process.env.BURST_WAIT_MS      || '3000');

// ── State ───────────────────────────────────────────────────────────────────
const stats = {
    connected:     0,
    joinedRoom:    0,
    failedJoin:    0,
    errors:        0,
    burstSent:     0,
    burstRecv:     0,
    connectTimes:  [],   // ms to connect + join
    burstLatency:  [],   // ms between burst fire and first recv echo
    startTime:     null,
};

// All ready sockets — these are the ones that will fire in the burst
const readySockets = [];

const ADJECTIVES = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Echo', 'Foxt', 'Golf', 'Hotel', 'India', 'Juliet'];
const NOUNS      = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Zero'];
const BURST_MSGS = [
    '💥 BURST MESSAGE — all at once!',
    '🔥 simultaneous fire from all users',
    '⚡ stress testing the server right now',
    'this message was sent at the exact same time as 999 others',
    '🤖 bot burst: can you handle it?',
    'server please dont die 🙏',
    '📡 signal check — all users online',
    'if you can read this the server survived',
];

function randomName(index) {
    const adj  = ADJECTIVES[index % ADJECTIVES.length];
    const noun = NOUNS[Math.floor(index / ADJECTIVES.length) % NOUNS.length];
    return `BurstUser_${adj}${noun}_${index}`;
}

function randomMsg() {
    return BURST_MSGS[Math.floor(Math.random() * BURST_MSGS.length)];
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function printPhase1() {
    const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1);
    process.stdout.write(
        `\r  [${elapsed}s]  ` +
        `🔌 Connected: ${stats.connected}/${TOTAL_USERS}  ` +
        `🏠 Joined: ${stats.joinedRoom}  ` +
        `❌ Failed: ${stats.failedJoin}  ` +
        `⚠️  Errors: ${stats.errors}   `
    );
}

function printPhase2() {
    const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1);
    process.stdout.write(
        `\r  [${elapsed}s]  ` +
        `💥 Sent: ${stats.burstSent}/${readySockets.length * MSGS_PER_USER}  ` +
        `📥 Recv: ${stats.burstRecv}   `
    );
}

// ── Phase 1: Connect one user and wait for room join ────────────────────────
function connectUser(index) {
    return new Promise((resolve) => {
        const name = randomName(index);
        const connectStart = Date.now();
        let resolved = false;

        const socket = io(TARGET_URL, {
            transports: ['websocket'],
            reconnection: false,
            timeout: CONNECT_TIMEOUT_MS,
        });

        const fail = (reason) => {
            if (!resolved) {
                resolved = true;
                stats.failedJoin++;
                socket.disconnect();
                resolve(null);
            }
        };

        const timeoutId = setTimeout(() => fail('timeout'), CONNECT_TIMEOUT_MS + 2000);

        socket.on('connect', () => {
            stats.connected++;
            socket.emit('join public', { name });
        });

        socket.on('room joined', () => {
            const joinTime = Date.now() - connectStart;
            stats.connectTimes.push(joinTime);
            stats.joinedRoom++;
            clearTimeout(timeoutId);

            // Set up message counter for burst phase
            socket._burstRecv = 0;
            socket._burstEchoTime = null;

            socket.on('chat message', () => {
                stats.burstRecv++;
            });

            socket.on('error', () => {
                stats.errors++;
            });

            if (!resolved) {
                resolved = true;
                resolve(socket);
            }
        });

        socket.on('error', (err) => {
            stats.errors++;
            if (typeof err === 'string' && err.includes('already taken')) {
                // Retry with different suffix
                socket.emit('join public', { name: name + '_r' + Math.floor(Math.random() * 999) });
            } else {
                fail('error');
            }
        });

        socket.on('connect_error', () => {
            clearTimeout(timeoutId);
            fail('connect_error');
        });
    });
}

// ── Phase 2: Fire ALL messages simultaneously ────────────────────────────────
async function fireBurst() {
    console.log(`\n\n  🚀 FIRING BURST — ${readySockets.length} users × ${MSGS_PER_USER} msgs = ${readySockets.length * MSGS_PER_USER} messages simultaneously...\n`);

    const burstStart = Date.now();

    // Every socket fires all its messages in a tight loop — no await, no sleep
    for (const socket of readySockets) {
        for (let m = 0; m < MSGS_PER_USER; m++) {
            socket.emit('chat message', { text: randomMsg() });
            stats.burstSent++;
        }
    }

    const burstFireTime = Date.now() - burstStart;
    console.log(`  ✅ All ${stats.burstSent} messages emitted in ${burstFireTime}ms`);
    console.log(`  ⏳ Waiting ${BURST_WAIT_MS / 1000}s to collect server echoes...\n`);

    const progressInterval = setInterval(printPhase2, 200);
    await sleep(BURST_WAIT_MS);
    clearInterval(progressInterval);
    printPhase2();

    return burstFireTime;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║     ChatJet Burst Test — All Users At Once       ║');
    console.log('╚══════════════════════════════════════════════════╝\n');
    console.log(`  🎯 Target         : ${TARGET_URL}`);
    console.log(`  👥 Users          : ${TOTAL_USERS}`);
    console.log(`  💥 Msgs per burst : ${MSGS_PER_USER} per user`);
    console.log(`  📦 Total burst    : ${TOTAL_USERS * MSGS_PER_USER} msgs (all at once)`);
    console.log(`  ⏱  Connect window : ${RAMP_UP_MS}ms`);
    console.log('\n─────────────────────────────────────────────────────');
    console.log('  PHASE 1: Connecting all users...\n');

    stats.startTime = Date.now();

    // Ramp up connections (staggered to avoid socket queue overflow)
    const delayBetweenUsers = RAMP_UP_MS / TOTAL_USERS;
    const progressInterval = setInterval(printPhase1, 250);

    const connectPromises = [];
    for (let i = 0; i < TOTAL_USERS; i++) {
        connectPromises.push(connectUser(i));
        if (delayBetweenUsers > 0) {
            await sleep(delayBetweenUsers);
        }
    }

    const results = await Promise.all(connectPromises);
    clearInterval(progressInterval);
    printPhase1();

    // Filter out failed connections
    for (const s of results) {
        if (s) readySockets.push(s);
    }

    const phase1Time = ((Date.now() - stats.startTime) / 1000).toFixed(1);
    const joinRate = ((stats.joinedRoom / TOTAL_USERS) * 100).toFixed(1);

    console.log(`\n\n─────────────────────────────────────────────────────`);
    console.log(`  PHASE 1 COMPLETE in ${phase1Time}s`);
    console.log(`  ✅ Ready sockets : ${readySockets.length} / ${TOTAL_USERS}  (${joinRate}% success)`);
    console.log(`  ❌ Failed        : ${stats.failedJoin}`);

    if (readySockets.length === 0) {
        console.log('\n  🔴 No users connected — aborting burst.');
        process.exit(1);
    }

    console.log('\n─────────────────────────────────────────────────────');
    console.log('  PHASE 2: Simultaneous burst...');

    // Small pause so all sockets settle
    await sleep(500);

    const burstFireMs = await fireBurst();
    const totalTime = ((Date.now() - stats.startTime) / 1000).toFixed(1);

    // ── Stats ──────────────────────────────────────────────────────────────
    const avg = arr => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : 'N/A';
    const min = arr => arr.length ? Math.min(...arr) : 'N/A';
    const max = arr => arr.length ? Math.max(...arr) : 'N/A';
    const p95 = arr => {
        if (!arr.length) return 'N/A';
        const sorted = [...arr].sort((a, b) => a - b);
        return sorted[Math.floor(sorted.length * 0.95)];
    };

    const deliveryRate = stats.burstSent > 0
        ? ((stats.burstRecv / (readySockets.length * stats.burstSent / readySockets.length)) * 100).toFixed(1)
        : '0';

    const expectedRecv = readySockets.length * MSGS_PER_USER * readySockets.length;
    const actualDeliveryPct = expectedRecv > 0
        ? ((stats.burstRecv / expectedRecv) * 100).toFixed(1)
        : '0';

    const burstRate = burstFireMs > 0
        ? (stats.burstSent / (burstFireMs / 1000)).toFixed(0)
        : stats.burstSent;

    console.log('\n\n╔══════════════════════════════════════════════════╗');
    console.log('║            BURST TEST RESULTS                    ║');
    console.log('╚══════════════════════════════════════════════════╝\n');

    console.log('  ── Phase 1: Connection ─────────────────────────────');
    console.log(`  Users targeted       : ${TOTAL_USERS}`);
    console.log(`  Successfully joined  : ${readySockets.length}  (${joinRate}%)`);
    console.log(`  Failed to connect    : ${stats.failedJoin}`);
    console.log(`  Connect+Join avg     : ${avg(stats.connectTimes)}ms`);
    console.log(`  Connect+Join p95     : ${p95(stats.connectTimes)}ms`);
    console.log(`  Connect+Join max     : ${max(stats.connectTimes)}ms`);

    console.log('\n  ── Phase 2: Burst ──────────────────────────────────');
    console.log(`  Users that fired     : ${readySockets.length}`);
    console.log(`  Messages fired       : ${stats.burstSent}`);
    console.log(`  Emit time            : ${burstFireMs}ms  (${burstRate} msgs/sec peak)`);
    console.log(`  Messages received    : ${stats.burstRecv}`);
    console.log(`  Expected receives    : ~${expectedRecv}  (each msg echoes to all ${readySockets.length} users)`);
    console.log(`  Delivery %           : ${actualDeliveryPct}%  of expected echoes`);
    console.log(`  Total test time      : ${totalTime}s`);
    console.log(`  Errors during burst  : ${stats.errors}`);

    console.log('\n  ── Verdict ─────────────────────────────────────────');
    const pct = parseFloat(joinRate);
    const verdict =
        pct >= 99 ? '✅ EXCELLENT — All users connected and burst successful' :
        pct >= 85 ? '🟡 GOOD      — Most users reached the burst, minor drops' :
        pct >= 65 ? '🟠 DEGRADED  — Significant connection failures pre-burst' :
                    '🔴 CRITICAL  — Server struggled to accept connections';
    console.log(`  ${verdict}`);

    if (burstFireMs < 50) {
        console.log('  ⚡ Burst fired extremely fast — true simultaneous spike achieved');
    }
    if (stats.errors === 0) {
        console.log('  🎯 Zero errors during burst — server handled it cleanly');
    }

    console.log('\n─────────────────────────────────────────────────────\n');

    // Disconnect all
    for (const s of readySockets) {
        try { s.disconnect(); } catch (_) {}
    }

    process.exit(0);
}

main().catch(err => {
    console.error('\nBurst test crashed:', err);
    process.exit(1);
});
