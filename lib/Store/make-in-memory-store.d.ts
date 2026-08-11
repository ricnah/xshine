import { BaileysEventEmitter, Chat, Contact, GroupMetadata, PresenceData, WAMessage } from '../Types';

export interface InMemoryStoreConfig {
    maxMessagesPerChat?: number;
    logger?: any;
}

export declare const waChatKey: (pin: boolean) => any;
export declare const waMessageID: (m: WAMessage) => string;

export declare const makeInMemoryStore: (config?: InMemoryStoreConfig) => {
    chats: Map<string, Chat>;
    messages: Record<string, any>;
    contacts: Record<string, Contact>;
    groupMetadata: Record<string, GroupMetadata>;
    presences: Record<string, Record<string, PresenceData>>;
    state: { connection: string };
    bind: (ev: BaileysEventEmitter) => void;
    loadMessages: (jid: string, count: number) => Promise<WAMessage[]>;
    loadMessage: (jid: string, id: string) => Promise<WAMessage | undefined>;
    mostRecentMessage: (jid: string) => Promise<WAMessage | undefined>;
};

export default makeInMemoryStore;
