'use strict';
import { generateWAMessageFromContent, prepareWAMessageMedia } from '../index.js';
import crypto from 'crypto';
import { PassThrough, Readable } from 'stream';

const VERSION = '1.0.0';

let sharpModule = null;
let ffmpegModule = null;
let sharpChecked = false;
let ffmpegChecked = false;

async function getSharp() {
    if (!sharpChecked) {
        sharpChecked = true;
        try {
            sharpModule = (await import('sharp')).default;
        } catch {
        }
    }
    return sharpModule;
}

async function getFfmpeg() {
    if (!ffmpegChecked) {
        ffmpegChecked = true;
        try {
            ffmpegModule = (await import('fluent-ffmpeg')).default;
        } catch {
        }
    }
    return ffmpegModule;
}

async function resolvePromiseTree(input) {
    if (!input) return input;
    if (typeof input.then === 'function') return resolvePromiseTree(await input);
    if (Array.isArray(input)) return Promise.all(input.map(resolvePromiseTree));
    if (typeof input === 'object' && input.constructor === Object) {
        const resolvedEntries = await Promise.all(
            Object.entries(input).map(async ([key, val]) => [key, await resolvePromiseTree(val)])
        );
        return Object.fromEntries(resolvedEntries);
    }
    return input;
}

class MediaToolkit {
    static async resize(buffer, width, height, fit = 'cover') {
        const sharpInstance = await getSharp();
        if (!sharpInstance) return buffer;
        return await sharpInstance(buffer)
            .resize(width, height, {
                fit,
                position: 'center',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .png()
            .toBuffer();
    }

    static async waitAllPromises(input) {
        return await resolvePromiseTree(input);
    }

    static async fetchBuffer(url, options = {}, { silent = true } = {}) {
        try {
            const res = await fetch(url, options);
            if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
            return Buffer.from(await res.arrayBuffer());
        } catch (err) {
            if (silent) return Buffer.alloc(0);
            throw err;
        }
    }

    static async toUrl(client, pathStr, mediaType = 'document') {
        if (!pathStr) throw new Error('Url or buffer needed');
        const media = await prepareWAMessageMedia(
            { [mediaType]: Buffer.isBuffer(pathStr) ? pathStr : { url: pathStr } },
            { upload: client.waUploadToServer, jid: '@newsletter' }
        );
        return Object.values(media)[0]?.url;
    }

    static async resolveMedia(client, media, mediaType = 'image', options = {}) {
        const { resolveUrl = false, resolveWAUrl = false, result = 'url', resize = false, width = 300, height = 300 } = options;
        const isUrl = (str) => /^https?:\/\/.+/i.test(str);
        const isWAUrl = (str) => /^https?:\/\/[^/]*\.whatsapp\.net\//i.test(str);

        if (Array.isArray(media)) {
            return Promise.all(
                media.map((item) => MediaToolkit.resolveMedia(client, item, mediaType, options))
            );
        }

        if (typeof media === 'string' && isUrl(media)) {
            if (isWAUrl(media)) {
                if (resolveWAUrl || result !== 'url') {
                    media = await MediaToolkit.fetchBuffer(media, {}, { silent: true });
                }
            } else if (resolveUrl || result !== 'url') {
                media = await MediaToolkit.fetchBuffer(media, {}, { silent: true });
            }
        }

        if (typeof media === 'string' && !isUrl(media)) {
            media = Buffer.from(media, 'base64');
        }

        if (!Buffer.isBuffer(media) || !media.length) {
            return media;
        }

        if (resize && Buffer.isBuffer(media)) {
            media = await MediaToolkit.resize(media, width, height);
        }

        if (result === 'buffer') return media;
        if (result === 'base64') return media.toString('base64');
        return MediaToolkit.toUrl(client, media, mediaType);
    }

    static getMp4Duration(buffer, { silent = true } = {}) {
        try {
            if (!Buffer.isBuffer(buffer) || buffer.length < 8) {
                if (silent) return 0;
                throw new Error('Invalid mp4 buffer');
            }
            let offset = 0;
            while (offset < buffer.length - 8) {
                const size = buffer.readUInt32BE(offset);
                if (size < 8 || offset + size > buffer.length) {
                    if (silent) return 0;
                    throw new Error('Invalid atom size');
                }
                const type = buffer.toString('ascii', offset + 4, offset + 8);
                if (type === 'moov') {
                    let moovOffset = offset + 8;
                    const moovEnd = offset + size;
                    while (moovOffset < moovEnd - 8) {
                        const childSize = buffer.readUInt32BE(moovOffset);
                        if (childSize < 8 || moovOffset + childSize > moovEnd) break;
                        const childType = buffer.toString('ascii', moovOffset + 4, moovOffset + 8);
                        if (childType === 'mvhd') {
                            const version = buffer.readUInt8(moovOffset + 8);
                            if (version === 0) {
                                const timescale = buffer.readUInt32BE(moovOffset + 20);
                                const duration = buffer.readUInt32BE(moovOffset + 24);
                                return timescale ? duration / timescale : 0;
                            }
                            if (version === 1) {
                                const timescale = buffer.readUInt32BE(moovOffset + 32);
                                const duration = Number(buffer.readBigUInt64BE(moovOffset + 36));
                                return timescale ? duration / timescale : 0;
                            }
                        }
                        moovOffset += childSize;
                    }
                }
                offset += size;
            }
            return 0;
        } catch (err) {
            if (silent) return 0;
            throw err;
        }
    }

    static async getMp4Preview(videoBuffer, options = {}) {
        const { time, result = 'buffer', resize = true, width = 300, height = 300, silent = true } = options;
        const ffmpegInstance = await getFfmpeg();
        if (!ffmpegInstance || !Buffer.isBuffer(videoBuffer) || !videoBuffer.length) {
            return silent ? (result === 'base64' ? '' : Buffer.alloc(0)) : Promise.reject(new Error('ffmpeg or videoBuffer unavailable'));
        }
        return new Promise((resolve, reject) => {
            const fail = (err) => silent ? resolve(result === 'base64' ? '' : Buffer.alloc(0)) : reject(err);
            try {
                const inputStream = new Readable({ read() {} });
                inputStream.push(videoBuffer);
                inputStream.push(null);
                const outputStream = new PassThrough();
                const chunks = [];
                outputStream.on('data', (chunk) => chunks.push(chunk));
                outputStream.on('end', async () => {
                    try {
                        let output = Buffer.concat(chunks);
                        if (!output.length) return fail(new Error('Empty video preview output'));
                        if (resize) output = await MediaToolkit.resize(output, width, height);
                        return resolve(result === 'base64' ? output.toString('base64') : output);
                    } catch (e) {
                        return fail(e);
                    }
                });
                outputStream.on('error', fail);
                const targetTime = time ?? Math.min(MediaToolkit.getMp4Duration(videoBuffer) * 0.2, 10);
                ffmpegInstance(inputStream)
                    .outputOptions([`-ss ${targetTime}`, '-vframes 1', '-vcodec png', '-f image2pipe'])
                    .on('error', (err) => fail(new Error(`ffmpeg error: ${err.message}`)))
                    .pipe(outputStream, { end: true });
            } catch (err) {
                return fail(err);
            }
        });
    }
}

class BaseBuilder {
    constructor() {
        this._title = '';
        this._subtitle = '';
        this._body = '';
        this._footer = '';
        this._contextInfo = {};
        this._extraPayload = {};
    }
    setTitle(title) { this._title = String(title || ''); return this; }
    setSubtitle(subtitle) { this._subtitle = String(subtitle || ''); return this; }
    setBody(body) { this._body = String(body || ''); return this; }
    setFooter(footer) { this._footer = String(footer || ''); return this; }
    setContextInfo(infoObj) {
        if (typeof infoObj === 'object' && infoObj !== null) this._contextInfo = infoObj;
        return this;
    }
    addPayload(payloadObj) {
        if (typeof payloadObj === 'object' && payloadObj !== null) Object.assign(this._extraPayload, payloadObj);
        return this;
    }
    title(t) { return this.setTitle(t); }
    subtitle(s) { return this.setSubtitle(s); }
    text(b) { return this.setBody(b); }
    body(b) { return this.setBody(b); }
    footer(f) { return this.setFooter(f); }
}

class RowBuilder {
    constructor() { this.buttons = []; }
    button(displayText, buttonId) {
        this.buttons.push({ buttonId, buttonText: { displayText }, type: 1 });
        return this;
    }
}

class CardBuilder {
    constructor(client) { this._card = new Button(client); }
    image(url) { this._card.setImage(url); return this; }
    title(t) { this._card.setTitle(t); return this; }
    text(t) { this._card.setBody(t); return this; }
    button(displayText, id) { this._card.addReply(displayText, id); return this; }
}

class Button extends BaseBuilder {
    #client;
    constructor(client) {
        super();
        if (!client) throw new Error('Socket client is required');
        this.#client = client;
        this._buttons = [];
        this._mediaData = null;
        this._currentSelectionIndex = -1;
        this._currentSectionIndex = -1;
        this._params = {};
    }
    setVideo(pathStr, options = {}) {
        this._mediaData = Buffer.isBuffer(pathStr) ? { video: pathStr, ...options } : { video: { url: pathStr }, ...options };
        return this;
    }
    setImage(pathStr, options = {}) {
        this._mediaData = Buffer.isBuffer(pathStr) ? { image: pathStr, ...options } : { image: { url: pathStr }, ...options };
        return this;
    }
    setDocument(pathStr, options = {}) {
        this._mediaData = Buffer.isBuffer(pathStr) ? { document: pathStr, ...options } : { document: { url: pathStr }, ...options };
        return this;
    }
    setMedia(obj) { this._mediaData = obj; return this; }
    clearButtons() { this._buttons = []; return this; }
    setParams(paramsObj) { this._params = paramsObj; return this; }
    addButton(name, params) {
        this._buttons.push({
            name,
            buttonParamsJson: typeof params === 'string' ? params : JSON.stringify(params),
        });
        return this;
    }
    addReply(displayText = '', id = '', options = {}) {
        return this.addButton('quick_reply', { display_text: displayText, id, ...options });
    }
    addUrl(displayText = '', url = '', webviewInteraction = false, options = {}) {
        return this.addButton('cta_url', { display_text: displayText, url, webview_interaction: webviewInteraction, ...options });
    }
    addCall(displayText = '', id = '', options = {}) {
        return this.addButton('cta_call', { display_text: displayText, id, ...options });
    }
    addCopy(displayText = '', copyCode = '', options = {}) {
        return this.addButton('cta_copy', { display_text: displayText, copy_code: copyCode, ...options });
    }
    addSelection(title, options = {}) {
        this._buttons.push({ ...options, name: 'single_select', buttonParamsJson: JSON.stringify({ title, sections: [] }) });
        this._currentSelectionIndex = this._buttons.length - 1;
        this._currentSectionIndex = -1;
        return this;
    }
    makeSection(title = '', highlightLabel = '') {
        if (this._currentSelectionIndex === -1) throw new Error('Selection must be created before section');
        const params = JSON.parse(this._buttons[this._currentSelectionIndex].buttonParamsJson);
        params.sections.push({ title, highlight_label: highlightLabel, rows: [] });
        this._currentSectionIndex = params.sections.length - 1;
        this._buttons[this._currentSelectionIndex].buttonParamsJson = JSON.stringify(params);
        return this;
    }
    makeRow(header = '', title = '', description = '', id = '') {
        if (this._currentSelectionIndex === -1 || this._currentSectionIndex === -1) {
            throw new Error('Selection and Section required before adding a row');
        }
        const params = JSON.parse(this._buttons[this._currentSelectionIndex].buttonParamsJson);
        params.sections[this._currentSectionIndex].rows.push({ header, title, description, id });
        this._buttons[this._currentSelectionIndex].buttonParamsJson = JSON.stringify(params);
        return this;
    }
    async toCard() {
        return {
            body: { text: this._body },
            footer: { text: this._footer },
            header: {
                title: this._title,
                subtitle: this._subtitle,
                hasMediaAttachment: !!this._mediaData,
                ...(this._mediaData ? await prepareWAMessageMedia(this._mediaData, { upload: this.#client.waUploadToServer }).catch((e) => {
                    if (String(e).includes('Invalid media type')) return this._mediaData;
                    throw e;
                }) : {}),
            },
            nativeFlowMessage: {
                messageParamsJson: JSON.stringify(this._params),
                buttons: this._buttons,
            },
        };
    }
    async build(jid, options = {}) {
        return generateWAMessageFromContent(
            jid,
            {
                ...this._extraPayload,
                interactiveMessage: {
                    body: { text: this._body },
                    footer: { text: this._footer },
                    header: { title: this._title, subtitle: this._subtitle, hasMediaAttachment: false },
                    nativeFlowMessage: {
                        messageParamsJson: JSON.stringify(this._params),
                        buttons: this._buttons,
                    },
                    contextInfo: this._contextInfo,
                },
            },
            { ...options }
        );
    }
    async send(jid, options = {}) {
        const msg = await this.build(jid, options);
        await this.#client.relayMessage(msg.key.remoteJid, msg.message, {
            messageId: msg.key.id,
            additionalNodes: [
                {
                    tag: 'biz',
                    attrs: {},
                    content: [
                        {
                            tag: 'interactive',
                            attrs: { type: 'native_flow', v: '1' },
                            content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }],
                        },
                    ],
                },
            ],
            ...options,
        });
        return msg;
    }
    button(displayText, id) { return this.addReply(displayText, id); }
}

class ButtonV2 extends BaseBuilder {
    #client;
    constructor(client) {
        super();
        if (!client) throw new Error('Socket client is required');
        this.#client = client;
        this._thumbnail = null;
        this._mediaData = null;
        this._buttons = [];
    }
    addButton(displayText = '', buttonId = crypto.randomUUID()) {
        this._buttons.push({ buttonId, buttonText: { displayText }, type: 1 });
        return this;
    }
    setThumbnail(pathStr) { this._thumbnail = pathStr; return this; }
    async build(jid, options = {}) {
        const thumb = this._thumbnail ? await MediaToolkit.resize(
            Buffer.isBuffer(this._thumbnail) ? this._thumbnail : await MediaToolkit.fetchBuffer(this._thumbnail, {}, { silent: true }),
            300, 300
        ) : null;
        return generateWAMessageFromContent(
            jid,
            {
                ...this._extraPayload,
                buttonsMessage: {
                    contentText: this._body,
                    footerText: this._footer,
                    ...(this._mediaData || {
                        headerType: 6,
                        locationMessage: {
                            degreesLatitude: 0,
                            degreesLongitude: 0,
                            name: this._title,
                            address: this._subtitle,
                            jpegThumbnail: thumb,
                        },
                    }),
                    viewOnce: true,
                    contextInfo: this._contextInfo,
                    buttons: [...this._buttons],
                },
            },
            { ...options }
        );
    }
    async send(jid, options = {}) {
        if (this._buttons.length < 1) throw new Error('ButtonV2 requires at least one button');
        const msg = await this.build(jid, options);
        await this.#client.relayMessage(msg.key.remoteJid, msg.message, { messageId: msg.key.id, ...options });
        return msg;
    }
    button(displayText, id) { return this.addButton(displayText, id); }
}

class Carousel extends BaseBuilder {
    #client;
    constructor(client) {
        super();
        if (!client) throw new Error('Socket client is required');
        this.#client = client;
        this._cards = [];
    }
    addCard(card) {
        const cards = Array.isArray(card) ? card : [card];
        this._cards.push(...cards);
        return this;
    }
    build(jid, options = {}) {
        return generateWAMessageFromContent(
            jid,
            {
                ...this._extraPayload,
                interactiveMessage: {
                    header: { hasMediaAttachment: false },
                    body: { text: this._body },
                    footer: { text: this._footer },
                    contextInfo: this._contextInfo,
                    carouselMessage: { cards: this._cards },
                },
            },
            { ...options }
        );
    }
    async send(jid, options = {}) {
        const msg = await this.build(jid, options);
        await this.#client.relayMessage(msg.key.remoteJid, msg.message, {
            messageId: msg.key.id,
            additionalNodes: [
                {
                    tag: 'biz',
                    attrs: {},
                    content: [
                        {
                            tag: 'interactive',
                            attrs: { type: 'native_flow', v: '1' },
                            content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }],
                        },
                    ],
                },
            ],
            ...options,
        });
        return msg;
    }
    card(callback) {
        const cardObj = new CardBuilder(this.#client);
        callback(cardObj);
        this.addCard(cardObj._card.toCard());
        return this;
    }
}

class InteractiveEngine {
    static async button(client, jid, options = {}) {
        const btn = new Button(client);
        if (options.text) btn.setBody(options.text);
        if (options.footer) btn.setFooter(options.footer);
        if (options.title) btn.setTitle(options.title);
        if (options.buttons && Array.isArray(options.buttons)) {
            options.buttons.forEach((b) => {
                if (b.type === 'reply') btn.addReply(b.text || b.display_text, b.id);
                else if (b.type === 'url') btn.addUrl(b.text || b.display_text, b.url);
                else if (b.type === 'copy') btn.addCopy(b.text || b.display_text, b.code || b.copy_code);
                else if (b.type === 'call') btn.addCall(b.text || b.display_text, b.id);
            });
        }
        return await btn.send(jid, options);
    }
    static async album(client, jid, options = {}) {
        const images = options.images || [];
        const caption = options.caption || '';
        const albumMessages = await Promise.all(
            images.map(async (img) => {
                const url = typeof img === 'string' ? img : img.url;
                return { image: { url }, caption };
            })
        );
        if (albumMessages.length > 0) {
            return await client.sendMessage(jid, albumMessages[0], options);
        }
    }
}

export {
    VERSION,
    InteractiveEngine,
    MediaToolkit,
    Button,
    ButtonV2,
    Carousel,
    BaseBuilder,
    RowBuilder,
    CardBuilder,
};
