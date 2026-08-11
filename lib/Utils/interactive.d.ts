import { WAMessage } from '../Types';

export declare class BaseBuilder {
    protected _title: string;
    protected _subtitle: string;
    protected _body: string;
    protected _footer: string;
    protected _contextInfo: any;
    protected _extraPayload: any;
    setTitle(title: string): this;
    setSubtitle(subtitle: string): this;
    setBody(body: string): this;
    setFooter(footer: string): this;
    setContextInfo(infoObj: any): this;
    addPayload(payloadObj: any): this;
    title(t: string): this;
    subtitle(s: string): this;
    text(b: string): this;
    body(b: string): this;
    footer(f: string): this;
}

export declare class Button extends BaseBuilder {
    constructor(client: any);
    setVideo(pathStr: string | Buffer, options?: any): this;
    setImage(pathStr: string | Buffer, options?: any): this;
    setDocument(pathStr: string | Buffer, options?: any): this;
    setMedia(obj: any): this;
    clearButtons(): this;
    setParams(paramsObj: any): this;
    addButton(name: string, params: any): this;
    addReply(displayText?: string, id?: string, options?: any): this;
    addUrl(displayText?: string, url?: string, webviewInteraction?: boolean, options?: any): this;
    addCall(displayText?: string, id?: string, options?: any): this;
    addCopy(displayText?: string, copyCode?: string, options?: any): this;
    addSelection(title: string, options?: any): this;
    makeSection(title?: string, highlightLabel?: string): this;
    makeRow(header?: string, title?: string, description?: string, id?: string): this;
    toCard(): Promise<any>;
    build(jid: string, options?: any): Promise<WAMessage>;
    send(jid: string, options?: any): Promise<WAMessage>;
    button(displayText: string, id: string): this;
}

export declare class ButtonV2 extends BaseBuilder {
    constructor(client: any);
    addButton(displayText?: string, buttonId?: string): this;
    setThumbnail(pathStr: string | Buffer): this;
    build(jid: string, options?: any): Promise<WAMessage>;
    send(jid: string, options?: any): Promise<WAMessage>;
    button(displayText: string, id: string): this;
}

export declare class Carousel extends BaseBuilder {
    constructor(client: any);
    addCard(card: any): this;
    build(jid: string, options?: any): Promise<WAMessage>;
    send(jid: string, options?: any): Promise<WAMessage>;
    card(callback: (cardObj: any) => void): this;
}

export declare class MediaToolkit {
    static resize(buffer: Buffer, width: number, height: number, fit?: string): Promise<Buffer>;
    static waitAllPromises(input: any): Promise<any>;
    static fetchBuffer(url: string, options?: any, opt?: { silent?: boolean }): Promise<Buffer>;
    static toUrl(client: any, pathStr: string | Buffer, mediaType?: string): Promise<string>;
    static resolveMedia(client: any, media: any, mediaType?: string, options?: any): Promise<any>;
    static getMp4Duration(buffer: Buffer, opt?: { silent?: boolean }): number;
    static getMp4Preview(videoBuffer: Buffer, options?: any): Promise<Buffer | string>;
}

export declare class InteractiveEngine {
    static button(client: any, jid: string, options?: any): Promise<WAMessage>;
    static album(client: any, jid: string, options?: any): Promise<any>;
}
