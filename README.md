# ChatJet

A real-time, enterprise-grade team chat application built with React, Node.js, and Socket.IO. ChatJet supports public workspaces, private password-protected rooms, direct messaging, file sharing, code snippets, polls, and ephemeral messages.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Available Commands](#available-commands)
- [Slash Commands](#slash-commands)
- [Load Testing](#load-testing)
- [Deployment](#deployment)
- [Known Limitations](#known-limitations)
- [Credits](#credits)

---

## Features

### Messaging
- Real-time messaging across all connected users in a room
- Markdown rendering with full syntax support
- Code snippet mode with automatic language detection (18 languages supported)
- Syntax-highlighted code blocks using PrismJS
- File and media attachments (images, audio, video, documents) up to 10 MB
- Native audio and video playback inline in the chat
- Ephemeral (self-destructing) messages via the `/burn` command
- Message deletion for your own messages
- Typing indicators

### Rooms and Access Control
- Public workspace open to all users
- Private rooms protected by a Room ID and passcode
- Unique display name enforcement per room — no two users can share the same name
- Session persistence via localStorage with a 2-minute inactivity timeout
- Auto-rejoin on reconnect for public rooms

### Direct Messaging
- Send a direct message request to any user in the sidebar
- The recipient can accept or decline the request
- Accepted DMs open a private two-person room

### Polls
- Create live polls with any number of options using the `/poll` command
- All room members can vote in real time
- Switching votes is supported; one vote per user is enforced

### User Experience
- Auto-generated profile picture for every user based on their display name (DiceBear Thumbs avatars)
- Retractable members sidebar with a mobile-friendly backdrop overlay
- Responsive layout with mobile support
- Session countdown timer visible in the chat header
- Empty state branding with the ChatJet logo

---

## Tech Stack

### Backend
| Package | Version | Purpose |
|---|---|---|
| Node.js | >= 18 | Runtime |
| Express | ^4.19.2 | HTTP server and static file serving |
| Socket.IO | ^4.7.5 | Real-time WebSocket communication |

### Frontend
| Package | Version | Purpose |
|---|---|---|
| React | ^19.2.0 | UI framework |
| Vite | ^7.2.4 | Build tool and dev server |
| socket.io-client | ^4.8.3 | WebSocket client |
| marked | ^17.0.1 | Markdown parsing |
| DOMPurify | ^3.3.1 | XSS sanitization |
| PrismJS | ^1.30.0 | Code syntax highlighting |
| highlight.js | ^11.11.1 | Automatic language detection |
| lucide-react | ^0.563.0 | Icon library |

---

## Project Structure

```
chatjet/
├── server.js                 # Express + Socket.IO server
├── package.json              # Server dependencies
├── client/                   # React frontend (Vite)
│   ├── index.html            # HTML entry point (favicon, fonts)
│   ├── public/               # Static assets served at root
│   │   └── Logo_favicon.png  # Browser tab favicon
│   └── src/
│       ├── main.jsx          # React entry point
│       ├── App.jsx           # Root component, socket init, session logic
│       ├── index.css         # Global design system and component styles
│       ├── assets/           # Bundled assets (logo, icons)
│       └── components/
│           ├── Onboarding.jsx    # Join screen (public/private room selection)
│           ├── ChatScreen.jsx    # Main chat layout, slash command handler
│           ├── MessageList.jsx   # Message feed and empty state
│           ├── MessageItem.jsx   # Individual message with attachments
│           ├── MessageInput.jsx  # Text input, file picker, code mode
│           ├── Sidebar.jsx       # Online members panel (retractable)
│           ├── Poll.jsx          # Live poll card and voting UI
│           └── Aurora.jsx        # Background animation component
└── Test/
    ├── load-test.js          # Staggered ramp-up load test (1000 users)
    └── load-test-burst.js    # Simultaneous burst load test (all users at once)
```

---

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm 9 or later

### 1. Clone the repository

```bash
git clone <repository-url>
cd chatjet
```

### 2. Install server dependencies

```bash
npm install
```

### 3. Install and build the client

```bash
npm run build
```

This installs client dependencies and produces a production build in `client/dist/`.

### 4. Start the server

```bash
npm start
```

The server starts on port `2800` by default and serves the React frontend at `http://localhost:2800`.

### Development mode (client with hot reload)

In one terminal, start the backend:

```bash
npm start
```

In a second terminal, start the Vite dev server:

```bash
cd client
npm run dev
```

The frontend dev server runs on port `5173` and proxies Socket.IO connections to the backend.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `2800` | Port the server listens on |

---

## Available Commands

### Server scripts

| Command | Description |
|---|---|
| `npm start` | Start the production server |
| `npm run build` | Build the React client |

### Client scripts (run from `client/`)

| Command | Description |
|---|---|
| `npm run dev` | Start Vite development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build locally |

---

## Slash Commands

Type any of these directly in the message input:

| Command | Description |
|---|---|
| `/help` | Show the list of available commands |
| `/clear` | Clear your local chat history |
| `/roll [max]` | Roll a random number between 1 and max (default 100) |
| `/shrug` | Send the classic shrug face |
| `/burn <message>` | Send a self-destructing message that disappears after 10 seconds |
| `/poll Question\|Option A\|Option B` | Create a live vote poll for the room |

---

## Load Testing

Two load testing scripts are included in the `Test/` directory. Both require `socket.io-client` to be installed at the project root.

```bash
npm install   # installs socket.io-client as a dev dependency
```

### Staggered Ramp-Up Test

Connects users gradually over a configurable window and has each user send messages at intervals. Good for measuring sustained throughput.

```bash
node Test/load-test.js
```

**Options (PowerShell):**

```powershell
# 500 users with a slow 10-second ramp-up
$env:USERS=500; $env:RAMP_UP_MS=10000; node Test/load-test.js

# 100 users quick test
$env:USERS=100; $env:RAMP_UP_MS=2000; node Test/load-test.js

# Full 1000-user test
$env:USERS=1000; $env:RAMP_UP_MS=5000; node Test/load-test.js

# Test a production deployment
$env:TARGET_URL="https://your-app.onrender.com"; node Test/load-test.js
```

| Variable | Default | Description |
|---|---|---|
| `TARGET_URL` | `http://localhost:2800` | Server to test |
| `USERS` | `1000` | Number of concurrent users |
| `MESSAGES_PER_USER` | `5` | Messages each user sends |
| `RAMP_UP_MS` | `5000` | Time window for all users to connect (ms) |
| `MSG_INTERVAL_MS` | `500` | Delay between messages per user (ms) |

### Simultaneous Burst Test

Two-phase test. Phase 1 connects all users and waits for every one of them to be in the room. Phase 2 fires all messages simultaneously at the exact same instant. Use this to measure peak concurrent load.

```bash
node Test/load-test-burst.js
```

**Options (PowerShell):**

```powershell
# Full 1000-user burst
$env:USERS=1000; node Test/load-test-burst.js

# 500 users with 5 messages each
$env:USERS=500; $env:MESSAGES_PER_USER=5; node Test/load-test-burst.js

# Test production
$env:TARGET_URL="https://your-app.onrender.com"; node Test/load-test-burst.js
```

| Variable | Default | Description |
|---|---|---|
| `TARGET_URL` | `http://localhost:2800` | Server to test |
| `USERS` | `1000` | Users to connect before burst |
| `MESSAGES_PER_USER` | `3` | Messages each user fires in the burst |
| `RAMP_UP_MS` | `8000` | Time allowed for all users to join (ms) |
| `CONNECT_TIMEOUT_MS` | `15000` | Per-user connection timeout (ms) |
| `BURST_WAIT_MS` | `3000` | Time to collect server echoes after burst (ms) |

### Observed Results (local machine, Windows)

| Test | Users Joined | Messages Fired | Throughput | Errors |
|---|---|---|---|---|
| Staggered (1000 users) | 748 / 1000 | 3,740 | 151 msgs/sec | 252 timeouts |
| Burst (1000 users) | 929 / 1000 | 2,787 in 23ms | 121,174 msgs/sec peak | 0 during burst |

Connection failures during the connection phase are caused by OS-level socket limits on Windows, not server code. On Linux (such as Render or a VPS), these limits are much higher and the success rate improves significantly.

---

## Deployment

ChatJet is configured for deployment on [Render](https://render.com) or any platform that runs Node.js.

### Build command

```bash
npm run build
```

### Start command

```bash
npm start
```

### Notes

- The server serves the built React client from `client/dist/` automatically
- Socket.IO CORS is currently set to `*` (allow all origins). Restrict this to your production domain before going live
- The session inactivity timeout is 2 minutes. Adjust `SESSION_TIMEOUT` in `App.jsx` if needed
- File attachments are transferred as base64 over the socket. The server allows payloads up to 20 MB (`maxHttpBufferSize`). Attachments are not persisted to disk and are not stored in localStorage to prevent quota errors

---

## Known Limitations

- **No persistent storage** — messages exist only in memory on the server and in the browser's localStorage. Restarting the server clears all rooms and message history.
- **Single process** — the server runs as a single Node.js process. Under very high load (1000+ simultaneous connections), consider cluster mode or horizontal scaling.
- **File attachments** — sent as base64 over WebSocket. Large files increase message size significantly and are not stored after the session ends.
- **Private room auto-rejoin** — users in private rooms are not automatically rejoined after a page refresh because the passcode is not stored. They are returned to the onboarding screen with their display name preserved.
- **Session timeout** — the 2-minute inactivity timer clears the session and requires the user to rejoin manually.

---

## Credits

Designed and developed by **Aryan Vala**.

| Platform | Link |
|---|---|
| Instagram | [@dez.aryan](https://www.instagram.com/dez.aryan) |
| LinkedIn | [aryan-vala](https://www.linkedin.com/in/aryan-vala-ba62a1212/) |

