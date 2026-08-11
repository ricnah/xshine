import { Boom } from '@hapi/boom';
import type { Contact } from './Contact.js';
export declare enum SyncState {
    
    Connecting = 0,
    
    AwaitingInitialSync = 1,
    
    Syncing = 2,
    
    Online = 3
}
export type WAConnectionState = 'open' | 'connecting' | 'close';
export type ConnectionState = {
    
    connection: WAConnectionState;
    
    lastDisconnect?: {
        error: Boom | Error | undefined;
        date: Date;
    };
    
    isNewLogin?: boolean;
    
    qr?: string;
    
    receivedPendingNotifications?: boolean;
    
    legacy?: {
        phoneConnected: boolean;
        user?: Contact;
    };
    



    isOnline?: boolean;
};
