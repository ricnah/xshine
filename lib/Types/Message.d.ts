import type { Readable } from "stream";
import type { URL } from "url";
import { proto } from "../../WAProto/index.js";
import type { MediaType } from "../Defaults/index.js";
import type { BinaryNode } from "../WABinary/index.js";
import type { GroupMetadata } from "./GroupMetadata.js";
import type { CacheStore } from "./Socket.js";
export { proto as WAProto };
export type WAMessage = proto.IWebMessageInfo & {
  key: WAMessageKey;
  messageStubParameters?: any;
  category?: string;
  retryCount?: number;
};
export type WAMessageContent = proto.IMessage;
export type WAContactMessage = proto.Message.IContactMessage;
export type WAContactsArrayMessage = proto.Message.IContactsArrayMessage;
export type WAMessageKey = proto.IMessageKey & {
  remoteJidAlt?: string;
  participantAlt?: string;
  server_id?: string;
  addressingMode?: string;
  isViewOnce?: boolean;
};
export type WATextMessage = proto.Message.IExtendedTextMessage;
export type WAContextInfo = proto.IContextInfo;
export type WALocationMessage = proto.Message.ILocationMessage;
export type WAGenericMediaMessage =
  | proto.Message.IVideoMessage
  | proto.Message.IImageMessage
  | proto.Message.IAudioMessage
  | proto.Message.IDocumentMessage
  | proto.Message.IStickerMessage;
export declare const WAMessageStubType: typeof proto.WebMessageInfo.StubType;
export declare const WAMessageStatus: typeof proto.WebMessageInfo.Status;
import type { ILogger } from "../Utils/logger.js";
export type WAMediaPayloadURL = {
  url: URL | string;
};
export type WAMediaPayloadStream = {
  stream: Readable;
};
export type WAMediaUpload = Buffer | WAMediaPayloadStream | WAMediaPayloadURL;

export type MessageType = keyof proto.Message;
export declare enum WAMessageAddressingMode {
  PN = "pn",
  LID = "lid",
}
export type MessageWithContextInfo =
  | "imageMessage"
  | "contactMessage"
  | "locationMessage"
  | "extendedTextMessage"
  | "documentMessage"
  | "audioMessage"
  | "videoMessage"
  | "call"
  | "contactsArrayMessage"
  | "liveLocationMessage"
  | "templateMessage"
  | "stickerMessage"
  | "groupInviteMessage"
  | "templateButtonReplyMessage"
  | "productMessage"
  | "listMessage"
  | "orderMessage"
  | "listResponseMessage"
  | "buttonsMessage"
  | "buttonsResponseMessage"
  | "interactiveMessage"
  | "interactiveResponseMessage"
  | "pollCreationMessage"
  | "requestPhoneNumberMessage"
  | "messageHistoryBundle"
  | "eventMessage"
  | "newsletterAdminInviteMessage"
  | "albumMessage"
  | "stickerPackMessage"
  | "pollResultSnapshotMessage"
  | "messageHistoryNotice";
export type DownloadableMessage = {
  mediaKey?: Uint8Array | null;
  directPath?: string | null;
  url?: string | null;
};
export type MessageReceiptType =
  | "read"
  | "read-self"
  | "hist_sync"
  | "peer_msg"
  | "sender"
  | "inactive"
  | "played"
  | undefined;
export type MediaConnInfo = {
  auth: string;
  ttl: number;
  hosts: {
    hostname: string;
    maxContentLengthBytes: number;
  }[];
  fetchDate: Date;
};
export interface WAUrlInfo {
  "canonical-url": string;
  "matched-text": string;
  title: string;
  description?: string;
  jpegThumbnail?: Buffer;
  highQualityThumbnail?: proto.Message.IImageMessage;
  originalThumbnailUrl?: string;
}
type Mentionable = {
  
  mentions?: string[];
  
  mentionAll?: boolean;
};
type Contextable = {
  
  contextInfo?: proto.IContextInfo;
};
type ViewOnce = {
  viewOnce?: boolean;
};
type Editable = {
  edit?: WAMessageKey;
};
type WithDimensions = {
  width?: number;
  height?: number;
};
export type PollMessageOptions = {
  name: string;
  selectableCount?: number;
  values: string[];
  
  messageSecret?: Uint8Array;
  toAnnouncementGroup?: boolean;
};
export type EventMessageOptions = {
  name: string;
  description?: string;
  startDate: Date;
  endDate?: Date;
  location?: WALocationMessage;
  call?: "audio" | "video";
  isCancelled?: boolean;
  isScheduleCall?: boolean;
  extraGuestsAllowed?: boolean;
  messageSecret?: Uint8Array<ArrayBufferLike>;
};
type SharePhoneNumber = {
  sharePhoneNumber: boolean;
};
type RequestPhoneNumber = {
  requestPhoneNumber: boolean;
};
export type AnyMediaMessageContent = (
  | ({
      image: WAMediaUpload;
      caption?: string;
      jpegThumbnail?: string;
    } & Mentionable &
      Contextable &
      WithDimensions)
  | ({
      video: WAMediaUpload;
      caption?: string;
      gifPlayback?: boolean;
      jpegThumbnail?: string;
      
      ptv?: boolean;
    } & Mentionable &
      Contextable &
      WithDimensions)
  | {
      audio: WAMediaUpload;
      
      ptt?: boolean;
      
      seconds?: number;
    }
  | ({
      sticker: WAMediaUpload;
      isAnimated?: boolean;
    } & WithDimensions)
  | ({
      document: WAMediaUpload;
      mimetype: string;
      fileName?: string;
      caption?: string;
    } & Contextable)
) & {
  mimetype?: string;
} & Editable;
export type ButtonReplyInfo = {
  displayText: string;
  id: string;
  index: number;
};
export type GroupInviteInfo = {
  inviteCode: string;
  inviteExpiration: number;
  text: string;
  jid: string;
  subject: string;
};
export type WASendableProduct = Omit<
  proto.Message.ProductMessage.IProductSnapshot,
  "productImage"
> & {
  productImage: WAMediaUpload;
};
export type StickerPackItem =
  | WAMediaUpload
  | {
      sticker: WAMediaUpload;
      emojis?: string[];
      accessibilityLabel?: string;
    };
export type StickerPackContent = {
  name: string;
  publisher?: string;
  description?: string;
  packId?: string;
  stickers: StickerPackItem[];
  cover?: WAMediaUpload;
};
export type AnyRegularMessageContent = (
  | ({
      text: string;
      linkPreview?: WAUrlInfo | null;
    } & Mentionable &
      Contextable &
      Editable)
  | AnyMediaMessageContent
  | {
      event: EventMessageOptions;
    }
  | ({
      poll: PollMessageOptions;
    } & Mentionable &
      Contextable &
      Editable)
  | {
      contacts: {
        displayName?: string;
        contacts: proto.Message.IContactMessage[];
      };
    }
  | {
      location: WALocationMessage;
    }
  | {
      react: proto.Message.IReactionMessage;
    }
  | {
      buttonReply: ButtonReplyInfo;
      type: "template" | "plain";
    }
  | {
      groupInvite: GroupInviteInfo;
    }
  | {
      listReply: Omit<proto.Message.IListResponseMessage, "contextInfo">;
    }
  | {
      pin: WAMessageKey;
      type: proto.PinInChat.Type;
      


      time?: 86400 | 604800 | 2592000;
    }
  | {
      product: WASendableProduct;
      businessOwnerJid?: string;
      body?: string;
      footer?: string;
    }
  | ({
      stickerPack: StickerPackContent;
    } & Mentionable &
      Contextable)
  | SharePhoneNumber
  | RequestPhoneNumber
) &
  ViewOnce;
export type AnyMessageContent =
  | AnyRegularMessageContent
  | {
      forward: WAMessage;
      force?: boolean;
    }
  | {
      
      delete: WAMessageKey;
    }
  | {
      disappearingMessagesInChat: boolean | number;
    }
  | {
      limitSharing: boolean;
    };
export type GroupMetadataParticipants = Pick<GroupMetadata, "participants">;
type MinimalRelayOptions = {
  
  messageId?: string;
  
  useCachedGroupMetadata?: boolean;
};
export type MessageRelayOptions = MinimalRelayOptions & {
  
  participant?: {
    jid: string;
    count: number;
  };
  
  additionalAttributes?: {
    [_: string]: string;
  };
  additionalNodes?: BinaryNode[];
  
  useUserDevicesCache?: boolean;
  
  statusJidList?: string[];
};
export type MiscMessageGenerationOptions = MinimalRelayOptions & {
  
  timestamp?: Date;
  
  quoted?: WAMessage;
  
  ephemeralExpiration?: number | string;
  
  mediaUploadTimeoutMs?: number;
  
  statusJidList?: string[];
  
  backgroundColor?: string;
  
  font?: number;
  
  broadcast?: boolean;
};
export type MessageGenerationOptionsFromContent =
  MiscMessageGenerationOptions & {
    userJid: string;
  };
export type WAMediaUploadFunction = (
  encFilePath: string,
  opts: {
    fileEncSha256B64: string;
    mediaType: MediaType;
    newsletter?: boolean;
    timeoutMs?: number;
  },
) => Promise<{
  mediaUrl: string;
  directPath: string;
  meta_hmac?: string;
  ts?: number;
  fbid?: number;
}>;
export type MediaGenerationOptions = {
  logger?: ILogger;
  mediaTypeOverride?: MediaType;
  upload: WAMediaUploadFunction;
  
  mediaCache?: CacheStore;
  mediaUploadTimeoutMs?: number;
  options?: RequestInit;
  backgroundColor?: string;
  font?: number;
};
export type MessageContentGenerationOptions = MediaGenerationOptions & {
  getUrlInfo?: (text: string) => Promise<WAUrlInfo | undefined>;
  getProfilePicUrl?: (
    jid: string,
    type: "image" | "preview",
  ) => Promise<string | undefined>;
  getCallLink?: (
    type: "audio" | "video",
    event?: {
      startTime: number;
    },
  ) => Promise<string | undefined>;
  jid?: string;
};
export type MessageGenerationOptions = MessageContentGenerationOptions &
  MessageGenerationOptionsFromContent;





export type MessageUpsertType = "append" | "notify";
export type MessageUserReceipt = proto.IUserReceipt;
export type WAMessageUpdate = {
  update: Partial<WAMessage>;
  key: WAMessageKey;
};
export type WAMessageCursor =
  | {
      before: WAMessageKey | undefined;
    }
  | {
      after: WAMessageKey | undefined;
    };
export type MessageUserReceiptUpdate = {
  key: WAMessageKey;
  receipt: MessageUserReceipt;
};
export type MediaDecryptionKeyInfo = {
  iv: Uint8Array;
  cipherKey: Uint8Array;
  macKey?: Uint8Array;
};
export type MinimalMessage = Pick<WAMessage, "key" | "messageTimestamp">;

