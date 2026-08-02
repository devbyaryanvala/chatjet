/**
 * ChatJet Load Test — Staggered Ramp-Up
 * =======================================
 * Simulates N users joining the Public room and sending messages with a
 * staggered ramp-up. Each user connects, joins, then sends messages at
 * timed intervals. Good for measuring sustained throughput under load.
 *
 * Usage:
 *   node load-test.js
 *
 * Run it yourself — override any setting with env vars:
 *   $env:USERS=500; $env:RAMP_UP_MS=10000; node load-test.js     (500 users, slow ramp)
 *   $env:USERS=100; $env:RAMP_UP_MS=2000;  node load-test.js     (100 users quick test)
 *   $env:USERS=1000; $env:RAMP_UP_MS=5000; node load-test.js     (full 1000-user test)
 *   $env:TARGET_URL="https://your-app.onrender.com"; node load-test.js  (test production)
 *
 * Options (env vars):
 *   TARGET_URL=http://localhost:2800   Server to test (default: localhost:2800)
 *   USERS=1000                         Number of concurrent users (default: 1000)
 *   MESSAGES_PER_USER=5                Messages each user sends (default: 5)
 *   RAMP_UP_MS=5000                    Time (ms) to ramp up all connections (default: 5000)
 *   MSG_INTERVAL_MS=500                Delay between each user's messages (default: 500ms)
 *
 * See also: load-test-burst.js — for simultaneous all-at-once burst testing.
 */

'use strict';

const { io } = require('socket.io-client');

// ── Config ─────────────────────────────────────────────────────────────────
const TARGET_URL      = process.env.TARGET_URL      || 'http://localhost:2800';
const TOTAL_USERS     = parseInt(process.env.USERS             || '1000');
const MSGS_PER_USER   = parseInt(process.env.MESSAGES_PER_USER || '5');
const RAMP_UP_MS      = parseInt(process.env.RAMP_UP_MS        || '5000');
const MSG_INTERVAL_MS = parseInt(process.env.MSG_INTERVAL_MS   || '500');

// ── State ───────────────────────────────────────────────────────────────────
const stats = {
    connected:      0,
    disconnected:   0,
    joinedRoom:     0,
    messagesSent:   0,
    messagesRecv:   0,
    errors:         0,
    latencies:      [],   // round-trip ms per message
    connectTimes:   [],   // ms to connect + join room
    failedConnect:  0,
    startTime:      null,
};

const ADJECTIVES = ['Quick', 'Bold', 'Calm', 'Dark', 'Epic', 'Fast', 'Glum', 'Hot', 'Iron', 'Just'];
const NOUNS      = ['Fox', 'Bear', 'Wolf', 'Bird', 'Hawk', 'Lion', 'Deer', 'Frog', 'Lynx', 'Mole'];
const MESSAGES   = [
    'hey everyone! 👋',
    'this load test is sending me into existential crisis',
    'is anyone else here or just me?',
    'Hello World from bot user',
    'ping! can anyone hear me?',
    '/roll 100',
    'chatjet is smooth 🔥',
    'testing 1 2 3...',
    'are we live? let\'s gooo',
    'greetings from the stress test 🤖',
    'the server is either fine or on fire — stay tuned',
    'i am a bot and i have feelings too',
    'sending message... beep boop',
    'load test in progress, please stand by',
];

function randomName(index) {
    const adj  = ADJECTIVES[index % ADJECTIVES.length];
    const noun = NOUNS[Math.floor(index / ADJECTIVES.length) % NOUNS.length];
    return `${adj}${noun}${index}`;
}

function randomMessage() {
    return MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Print live summary ──────────────────────────────────────────────────────
function printProgress() {
    const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1);
    process.stdout.write(
        `\r[${elapsed}s]  ` +
        `🔌 Connected: ${stats.connected}/${TOTAL_USERS}  ` +
        `🏠 Joined: ${stats.joinedRoom}  ` +
        `📤 Sent: ${stats.messagesSent}  ` +
        `📥 Recv: ${stats.messagesRecv}  ` +
        `❌ Errors: ${stats.errors}   `
    );
}

// ── Spawn one simulated user ─────────────────────────────────────────────────
function spawnUser(index) {
    return new Promise((resolve) => {
        const name = randomName(index);
        const connectStart = Date.now();
        let joinTime = null;
        let msgsSent  = 0;
        let resolved  = false;

        const socket = io(TARGET_URL, {
            transports: ['websocket'],
            reconnection: false,
            timeout: 10000,
        });

        const finish = () => {
            if (!resolved) {
                resolved = true;
                socket.disconnect();
                stats.disconnected++;
                resolve();
            }
        };

        // Connection timeout guard
        const timeoutId = setTimeout(() => {
            stats.failedConnect++;
            stats.errors++;
            finish();
        }, 12000);

        socket.on('connect', () => {
            stats.connected++;
            // Join the public room
            socket.emit('join public', { name });
        });

        socket.on('room joined', () => {
            joinTime = Date.now() - connectStart;
            stats.connectTimes.push(joinTime);
            stats.joinedRoom++;
            clearTimeout(timeoutId);

            // Start sending messages at staggered intervals
            const sendNext = async () => {
                for (let m = 0; m < MSGS_PER_USER; m++) {
                    if (resolved) break;
                    const sentAt = Date.now();
                    socket.emit('chat message', { text: randomMessage() });
                    stats.messagesSent++;
                    msgsSent++;

                    // Wait for interval then send next
                    await sleep(MSG_INTERVAL_MS + Math.random() * 200);
                }
                // Done — disconnect
                finish();
            };

            sendNext();
        });

        socket.on('chat message', () => {
            stats.messagesRecv++;
        });

        socket.on('error', (err) => {
            stats.errors++;
            // Don't disconnect immediately — error could be name collision, retry with suffix
            if (typeof err === 'string' && err.includes('already taken')) {
                // Re-join with a randomised suffix
                socket.emit('join public', { name: name + '_' + Math.floor(Math.random() * 9999) });
            }
        });

        socket.on('connect_error', () => {
            stats.failedConnect++;
            stats.errors++;
            clearTimeout(timeoutId);
            finish();
        });

        socket.on('disconnect', () => {
            clearTimeout(timeoutId);
            finish();
        });
    });
}

// ── Main runner ──────────────────────────────────────────────────────────────
async function main() {
    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║         ChatJet Load Test — Starting             ║');
    console.log('╚══════════════════════════════════════════════════╝\n');
    console.log(`  🎯 Target       : ${TARGET_URL}`);
    console.log(`  👥 Users        : ${TOTAL_USERS}`);
    console.log(`  💬 Msgs/user    : ${MSGS_PER_USER}`);
    console.log(`  ⏱  Ramp-up      : ${RAMP_UP_MS}ms`);
    console.log(`  ⏳ Msg interval : ${MSG_INTERVAL_MS}ms`);
    console.log(`  📦 Total msgs   : ~${TOTAL_USERS * MSGS_PER_USER}`);
    console.log('\n─────────────────────────────────────────────────────\n');

    stats.startTime = Date.now();

    // Stagger user spawning across RAMP_UP_MS window
    const delayBetweenUsers = RAMP_UP_MS / TOTAL_USERS;

    const progressInterval = setInterval(printProgress, 250);

    const promises = [];
    for (let i = 0; i < TOTAL_USERS; i++) {
        promises.push(spawnUser(i));
        if (delayBetweenUsers > 0) {
            await sleep(delayBetweenUsers);
        }
    }

    // Wait for all users to finish
    await Promise.all(promises);
    clearInterval(progressInterval);
    printProgress();

    const totalTime = (Date.now() - stats.startTime) / 1000;

    // ── Compute stats ────────────────────────────────────────────────────────
    const avg = arr => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : 'N/A';
    const min = arr => arr.length ? Math.min(...arr) : 'N/A';
    const max = arr => arr.length ? Math.max(...arr) : 'N/A';
    const p95 = arr => {
        if (!arr.length) return 'N/A';
        const sorted = [...arr].sort((a, b) => a - b);
        return sorted[Math.floor(sorted.length * 0.95)];
    };

    const successRate = ((stats.joinedRoom / TOTAL_USERS) * 100).toFixed(1);
    const msgRate     = (stats.messagesSent / totalTime).toFixed(1);

    console.log('\n\n╔══════════════════════════════════════════════════╗');
    console.log('║              LOAD TEST RESULTS                   ║');
    console.log('╚══════════════════════════════════════════════════╝\n');

    console.log('  ── Connection ─────────────────────────────────────');
    console.log(`  Total users spawned  : ${TOTAL_USERS}`);
    console.log(`  Successfully joined  : ${stats.joinedRoom}  (${successRate}%)`);
    console.log(`  Failed to connect    : ${stats.failedConnect}`);
    console.log(`  Errors               : ${stats.errors}`);

    console.log('\n  ── Timing ──────────────────────────────────────────');
    console.log(`  Total test duration  : ${totalTime.toFixed(1)}s`);
    console.log(`  Connect+Join avg     : ${avg(stats.connectTimes)}ms`);
    console.log(`  Connect+Join min     : ${min(stats.connectTimes)}ms`);
    console.log(`  Connect+Join max     : ${max(stats.connectTimes)}ms`);
    console.log(`  Connect+Join p95     : ${p95(stats.connectTimes)}ms`);

    console.log('\n  ── Throughput ──────────────────────────────────────');
    console.log(`  Messages sent        : ${stats.messagesSent}`);
    console.log(`  Messages received    : ${stats.messagesRecv}`);
    console.log(`  Throughput           : ${msgRate} msgs/sec`);

    console.log('\n  ── Verdict ─────────────────────────────────────────');
    const verdict =
        parseFloat(successRate) >= 99 ? '✅ EXCELLENT — Server handled all users perfectly' :
        parseFloat(successRate) >= 90 ? '🟡 GOOD      — Minor connection failures under load' :
        parseFloat(successRate) >= 70 ? '🟠 DEGRADED  — Significant failures, consider scaling' :
                                        '🔴 CRITICAL  — Server struggling badly, action needed';
    console.log(`  ${verdict}`);
    console.log('\n─────────────────────────────────────────────────────\n');

    process.exit(0);
}

main().catch(err => {
    console.error('\nLoad test crashed:', err);
    process.exit(1);
});
