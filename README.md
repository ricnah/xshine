<div align="center">
  <img src="logo/xshine-logo.svg" alt="xshine logo" width="100%" />

  <br />

  [![npm version](https://img.shields.io/npm/v/xshine-wa.svg?style=flat-square&color=8A2BE2)](https://www.npmjs.com/package/xshine-wa)
  [![npm downloads](https://img.shields.io/npm/dm/xshine-wa.svg?style=flat-square&color=blue)](https://www.npmjs.com/package/xshine-wa)
  [![license](https://img.shields.io/github/license/ricnah/xshine?style=flat-square&color=green)](LICENSE)
  [![node version](https://img.shields.io/node/v/xshine?style=flat-square&color=purple)](package.json)
</div>

# xshine

High-performance, lightweight WhatsApp Web API library developed by [ricnah](https://github.com/ricnah). Designed for stability, clean memory management, native flow buttons, carousel cards, visual payload responses, and hybrid store handling.

---

## Technical Overview

xshine is an enhanced WhatsApp Web protocol library built on top of WebSocket and Noise protocol transport layers. It delivers an optimized runtime footprint for production Node.js applications, providing native primitives for interactive UI elements, code tokenization, media stream chunking, and memory-bounded state management.

### Key Capabilities

1. Dual Module Compatibility: Native support for both ESM (`import`) and CommonJS (`require`).
2. Interactive Flow Buttons: Builders for quick reply, CTA URL, CTA copy, single select list menus, and multi-card carousels.
3. Visual Payload Engine: Syntax highlighter tokenization, markdown table formatting, citation links, and LaTeX image rendering wrappers.
4. Hybrid In-Memory Store: Optional state store bound by LRU cache limits (default max 500 messages per chat) with automatic background TTL eviction.
5. Stream Chunking Pipeline: Media download and upload handling via 64 KB PassThrough streams to prevent high V8 heap allocation.
6. WebAssembly VoIP Integration: Native WebSockets and WebRTC engine interface via embedded WebAssembly binaries (`libvoip.wasm`).
7. Clean Environment: 100% free of hardcoded secret channel auto-follows, console output pollution, or embedded tracking scripts.

---

## Installation

Install via npm:

```bash
npm install xshine-wa
```

Prerequisites:
- Node.js >= 20.0.0
- Peer dependencies (optional, install as needed by your application):
  - `pino` (recommended for logging)
  - `qrcode-terminal` (if rendering QR codes in terminal)
  - `sharp` / `jimp` (for image processing)

---

## Quick Start Examples

### 1. ESM Usage (`import`)

```javascript
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from 'xshine-wa';
import pino from 'pino';

const logger = pino({ level: 'silent' });

async function startSocket() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_session');

    const sock = makeWASocket({
        auth: state,
        logger,
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startSocket();
        } else if (connection === 'open') {
            console.log('Socket connection established.');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const jid = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

        if (text === '!ping') {
            await sock.sendMessage(jid, { text: 'pong' }, { quoted: msg });
        }
    });
}

startSocket();
```

### 2. CommonJS Usage (`require`)

```javascript
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('xshine-wa');

async function main() {
    const { state, saveCreds } = await useMultiFileAuthState('./session_cjs');
    const sock = makeWASocket({ auth: state });
    sock.ev.on('creds.update', saveCreds);
    console.log('xshine initialized via CommonJS');
}

main();
```

---

## Interactive Messages & Builders

### Interactive Flow Buttons

```javascript
import { InteractiveEngine, Button } from 'xshine-wa';

const flowMsg = new InteractiveEngine(sock)
    .setTitle('System Menu')
    .setBody('Select an action from the options below.')
    .setFooter('xshine framework')
    .addButton(Button.reply('cmd_ping', 'Check Status'))
    .addButton(Button.url('https://github.com/ricnah', 'Visit Website'))
    .addButton(Button.copy('PROMO2026', 'Copy Coupon'));

await flowMsg.send(jid);
```

### Carousel Cards

```javascript
import { Carousel } from 'xshine-wa';

const carousel = new Carousel(sock)
    .setText('Product Catalog')
    .addCard({
        title: 'Package Plan A',
        body: 'Starter allocation',
        image: { url: 'https://example.com/plan-a.jpg' },
        buttons: [{ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'Order A', id: 'order_a' }) }]
    })
    .addCard({
        title: 'Package Plan B',
        body: 'Pro allocation',
        image: { url: 'https://example.com/plan-b.jpg' },
        buttons: [{ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'Order B', id: 'order_b' }) }]
    });

await carousel.send(jid);
```

---

## Hybrid Memory Store

To maintain compatibility with applications querying historical message states without risking Out-Of-Memory (OOM) heap exceptions, xshine provides a hybrid store implementation bounded by LRU capacity:

```javascript
import makeWASocket, { useMultiFileAuthState, makeInMemoryStore } from 'xshine-wa';

const store = makeInMemoryStore({ maxMessagesPerChat: 500 });
const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

const sock = makeWASocket({ auth: state });
store.bind(sock.ev);

sock.ev.on('messages.upsert', async ({ messages }) => {
    const jid = messages[0].key.remoteJid;
    const history = await store.loadMessages(jid, 20);
    console.log(`Retrieved ${history.length} recent messages for ${jid}`);
});
```

---

## API Reference Summary

### Primary Exports

- `makeWASocket` (default export): Socket initialization factory.
- `useMultiFileAuthState`: Multi-file JSON session persistence helper.
- `makeInMemoryStore`: LRU-bounded hybrid store instance factory.
- `InteractiveEngine`, `Button`, `ButtonV2`, `Carousel`: Builder utilities for interactive components.
- `PayloadEngine`: Low-level visual response payload builder.
- `VoipClient`: WebAssembly and WebRTC voice call interface layer.

---

## Credits & Acknowledgements

This software is distributed under a Custom Public License with Mandatory Attribution Clause.

- **Developer of xshine**: [ricnah](https://github.com/ricnah)
- **Special Thanks & Acknowledgements**:
  - [WhiskeySockets/Baileys](https://github.com/WhiskeySockets/Baileys) & original open-source contributors for the base WhatsApp Web protocol architecture and specification.
  - Node.js and open-source ecosystem contributors.
- Free for all users to install, run, use, modify, and integrate into any WhatsApp bot or application (personal, commercial, or private).
- Re-publishing, hosting public repository clones, or uploading source mirrors on public platforms (such as GitHub, GitLab, npm, or yarn) is permitted without manual permission, **provided that explicit credit and attribution to the developer of xshine ([ricnah](https://github.com/ricnah)) is stated in the project repository and documentation**.
- Re-distributing or hosting public clones without crediting [ricnah](https://github.com/ricnah) is strictly prohibited. See the [LICENSE](LICENSE) file for full legal terms.

---

## Legal Disclaimer

This software (`xshine`) is an independent open-source project and is **not affiliated, endorsed, authorized, sponsored, or associated with WhatsApp Inc., Meta Platforms, Inc., or any of their subsidiaries or affiliates**.

- "WhatsApp" as well as related names, marks, emblems, and logos are registered trademarks of Meta Platforms, Inc.
- This library is provided strictly for educational, research, and legitimate automation purposes.
- Users are solely responsible for complying with WhatsApp's official Terms of Service (ToS) and local telecommunication and privacy regulations.
- The developer ([ricnah](https://github.com/ricnah)) assumes NO responsibility or liability for any account bans, suspensions, service interruptions, or damages arising from the use or misuse of this software.
