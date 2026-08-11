'use strict';
import { LRUCache } from 'lru-cache';
import { DEFAULT_CONNECTION_CONFIG } from '../Defaults/index.js';

export const waChatKey = (pin) => ({
    key: (c) => (pin ? (c.pinned ? '1' : '0') : '') + (c.archived ? '0' : '1') + (c.conversationTimestamp ? c.conversationTimestamp.toString(16).padStart(8, '0') : '') + c.id,
    compare: (k1, k2) => k2.localeCompare(k1)
});

export const waMessageID = (m) => m?.key?.id || '';

export const makeInMemoryStore = (config = {}) => {
    const maxMessagesPerChat = config.maxMessagesPerChat || 500;
    const logger = config.logger || DEFAULT_CONNECTION_CONFIG.logger.child({ stream: 'in-mem-store' });

    const chats = new Map();
    const messages = {};
    const contacts = {};
    const groupMetadata = {};
    const presences = {};
    const state = { connection: 'close' };

    const getMessageCache = (jid) => {
        if (!messages[jid]) {
            messages[jid] = new LRUCache({
                max: maxMessagesPerChat,
                ttl: 1000 * 60 * 60 * 24,
                ttlAutopurge: true
            });
        }
        return messages[jid];
    };

    const contactsUpsert = (newContacts) => {
        const oldContacts = new Set(Object.keys(contacts));
        for (const contact of newContacts) {
            oldContacts.delete(contact.id);
            contacts[contact.id] = Object.assign(contacts[contact.id] || {}, contact);
        }
        return oldContacts;
    };

    const bind = (ev) => {
        ev.on('connection.update', (update) => {
            Object.assign(state, update);
        });

        ev.on('messaging-history.set', ({ chats: newChats, contacts: newContacts, messages: newMessages, isLatest }) => {
            if (isLatest) {
                chats.clear();
                for (const id in messages) {
                    messages[id].clear();
                }
            }

            for (const chat of newChats) {
                chats.set(chat.id, Object.assign(chats.get(chat.id) || {}, chat));
            }

            contactsUpsert(newContacts);

            for (const msg of newMessages) {
                const jid = msg.key?.remoteJid;
                if (jid) {
                    const cache = getMessageCache(jid);
                    if (msg.key?.id) cache.set(msg.key.id, msg);
                }
            }
        });

        ev.on('contacts.upsert', (newContacts) => {
            contactsUpsert(newContacts);
        });

        ev.on('contacts.update', (updates) => {
            for (const update of updates) {
                if (contacts[update.id]) {
                    Object.assign(contacts[update.id], update);
                }
            }
        });

        ev.on('chats.upsert', (newChats) => {
            for (const chat of newChats) {
                chats.set(chat.id, Object.assign(chats.get(chat.id) || {}, chat));
            }
        });

        ev.on('chats.update', (updates) => {
            for (const update of updates) {
                if (chats.has(update.id)) {
                    Object.assign(chats.get(update.id), update);
                }
            }
        });

        ev.on('chats.delete', (deletions) => {
            for (const id of deletions) {
                chats.delete(id);
                delete messages[id];
            }
        });

        ev.on('messages.upsert', ({ messages: newMessages }) => {
            for (const msg of newMessages) {
                const jid = msg.key?.remoteJid;
                if (!jid) continue;
                const cache = getMessageCache(jid);
                if (msg.key?.id) cache.set(msg.key.id, msg);

                if (chats.has(jid)) {
                    const chat = chats.get(jid);
                    chat.conversationTimestamp = msg.messageTimestamp;
                }
            }
        });

        ev.on('messages.update', (updates) => {
            for (const { key, update } of updates) {
                const jid = key.remoteJid;
                if (!jid || !messages[jid]) continue;
                const cache = messages[jid];
                const msg = cache.get(key.id);
                if (msg) {
                    Object.assign(msg, update);
                }
            }
        });

        ev.on('messages.delete', (item) => {
            if ('all' in item) {
                const jid = item.jid;
                if (messages[jid]) messages[jid].clear();
            } else {
                for (const key of item.keys) {
                    const jid = key.remoteJid;
                    if (jid && messages[jid]) {
                        messages[jid].delete(key.id);
                    }
                }
            }
        });

        ev.on('groups.update', (updates) => {
            for (const update of updates) {
                const id = update.id;
                if (groupMetadata[id]) {
                    Object.assign(groupMetadata[id], update);
                }
            }
        });

        ev.on('group-participants.update', ({ id, participants, action }) => {
            const metadata = groupMetadata[id];
            if (metadata) {
                if (action === 'add') {
                    metadata.participants.push(...participants.map((id) => ({ id, admin: null })));
                } else if (action === 'remove') {
                    metadata.participants = metadata.participants.filter((p) => !participants.includes(p.id));
                }
            }
        });
    };

    const loadMessages = async (jid, count) => {
        const cache = getMessageCache(jid);
        const allMsgs = Array.from(cache.values());
        allMsgs.sort((a, b) => (b.messageTimestamp || 0) - (a.messageTimestamp || 0));
        return allMsgs.slice(0, count);
    };

    const loadMessage = async (jid, id) => {
        const cache = messages[jid];
        return cache ? cache.get(id) : undefined;
    };

    const mostRecentMessage = async (jid) => {
        const msgs = await loadMessages(jid, 1);
        return msgs[0];
    };

    return {
        chats,
        messages,
        contacts,
        groupMetadata,
        presences,
        state,
        bind,
        loadMessages,
        loadMessage,
        mostRecentMessage
    };
};

export default makeInMemoryStore;
