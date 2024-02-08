import type { EnvironmentContext, MailboxType, Email, MailboxAddrObject, MailboxAddrText, Boundaries, ContentHeaders, ContentOptions, AttachmentOptions } from './types.d.ts';
import { MimeTextError } from './mime_text_error.ts';
import { MimeMessageHeader } from './mime_message_header.ts';
import { Mailbox } from './mailbox.ts';
import { MimeMessageContent } from './mime_message_content.ts';

export class MimeMessage {
    readonly envctx: EnvironmentContext;
    readonly headers: MimeMessageHeader;
    boundaries: Boundaries = { mixed: '', alt: '', related: '' };
    readonly validTypes = ['text/html', 'text/plain'];
    readonly validContentTransferEncodings = ['7bit', '8bit', 'binary', 'quoted-printable', 'base64'];
    readonly messages: MimeMessageContent[] = [];

    constructor(envctx: EnvironmentContext) {
        this.envctx = envctx;
        this.headers = new MimeMessageHeader(this.envctx);
        this.messages = [];

        this.generateBoundaries();
    }

    asRaw(): string {
        const eol = this.envctx.eol;
        const lines = this.headers.dump();

        const plaintext = this.getMessageByType('text/plain');
        const html = this.getMessageByType('text/html');
        const primaryMessage = html ? html : plaintext ? plaintext : undefined;

        if (primaryMessage === undefined) {
            throw new MimeTextError('MIMETEXT_MISSING_BODY', 'No content added to the message.');
        }

        const hasAttachments = this.hasAttachments();
        const hasInlineAttachments = this.hasInlineAttachments();

        const structure = hasInlineAttachments && hasAttachments ? 'mixed+related'
            : hasAttachments ? 'mixed'
                : hasInlineAttachments ? 'related'
                    : plaintext && html ? 'alternative'
                        : '';

        if (structure === 'mixed+related') {
            const attachments = this.getAttachments()
                .map((a) => '--' + this.boundaries.mixed + eol + a.dump() + eol + eol)
                .join('')
                .slice(0, -1 * eol.length);
            const inlineAttachments = this.getInlineAttachments()
                .map((a) => '--' + this.boundaries.related + eol + a.dump() + eol + eol)
                .join('')
                .slice(0, -1 * eol.length);
            return lines + eol
                + 'Content-Type: multipart/mixed; boundary=' + this.boundaries.mixed + eol
                + eol
                + '--' + this.boundaries.mixed + eol
                + 'Content-Type: multipart/related; boundary=' + this.boundaries.related + eol
                + eol
                + this.dumpTextContent(plaintext, html, this.boundaries.related) + eol
                + eol
                + inlineAttachments
                + '--' + this.boundaries.related + '--' + eol
                + attachments
                + '--' + this.boundaries.mixed + '--';
        }
        else if (structure === 'mixed') {
            const attachments = this.getAttachments()
                .map((a) => '--' + this.boundaries.mixed + eol + a.dump() + eol + eol)
                .join('')
                .slice(0, -1 * eol.length);
            return lines + eol
                + 'Content-Type: multipart/mixed; boundary=' + this.boundaries.mixed + eol
                + eol
                + this.dumpTextContent(plaintext, html, this.boundaries.mixed) + eol
                + (plaintext && html ? '' : eol)
                + attachments
                + '--' + this.boundaries.mixed + '--';
        }
        else if (structure === 'related') {
            const inlineAttachments = this.getInlineAttachments()
                .map((a) => '--' + this.boundaries.related + eol + a.dump() + eol + eol)
                .join('')
                .slice(0, -1 * eol.length);
            return lines + eol
                + 'Content-Type: multipart/related; boundary=' + this.boundaries.related + eol
                + eol
                + this.dumpTextContent(plaintext, html, this.boundaries.related) + eol
                + eol
                + inlineAttachments
                + '--' + this.boundaries.related + '--';
        }
        else if (structure === 'alternative') {
            return lines + eol
                + 'Content-Type: multipart/alternative; boundary=' + this.boundaries.alt + eol
                + eol
                + this.dumpTextContent(plaintext, html, this.boundaries.alt) + eol
                + eol
                + '--' + this.boundaries.alt + '--';
        }
        else {
            return lines + eol + (primaryMessage as MimeMessageContent).dump();
        }
    }

    asEncoded(): string {
        return this.envctx.toBase64WebSafe(this.asRaw());
    }

    dumpTextContent(plaintext: MimeMessageContent | undefined, html: MimeMessageContent | undefined, boundary: string): string {
        const eol = this.envctx.eol;
        const primaryMessage = html ? html : plaintext;

        let data = '';

        if (plaintext && html && !this.hasInlineAttachments() && this.hasAttachments()) data = '--' + boundary + eol
            + 'Content-Type: multipart/alternative; boundary=' + this.boundaries.alt + eol
            + eol
            + '--' + this.boundaries.alt + eol
            + (plaintext as MimeMessageContent).dump() + eol
            + eol
            + '--' + this.boundaries.alt + eol
            + (html as MimeMessageContent).dump() + eol
            + eol
            + '--' + this.boundaries.alt + '--';
        else if (plaintext && html && this.hasInlineAttachments()) data = '--' + boundary + eol
            + (html as MimeMessageContent).dump()
        else if (plaintext && html) data = '--' + boundary + eol
            + (plaintext as MimeMessageContent).dump() + eol
            + eol
            + '--' + boundary + eol
            + (html as MimeMessageContent).dump();
        else data = '--' + boundary + eol
            + (primaryMessage as MimeMessageContent).dump();

        return data;
    }

    hasInlineAttachments(): boolean {
        return this.messages.some((msg) => msg.isInlineAttachment());
    }

    hasAttachments(): boolean {
        return this.messages.some((msg) => msg.isAttachment());
    }

    getAttachments(): MimeMessageContent[] | [] {
        const matcher = (msg: MimeMessageContent) => msg.isAttachment();
        return this.messages.some(matcher) ? this.messages.filter(matcher) : [];
    }

    getInlineAttachments(): MimeMessageContent[] | [] {
        const matcher = (msg: MimeMessageContent) => msg.isInlineAttachment();
        return this.messages.some(matcher) ? this.messages.filter(matcher) : [];
    }

    getMessageByType(type: string): MimeMessageContent | undefined {
        const matcher = (msg: MimeMessageContent) => !msg.isAttachment() && !msg.isInlineAttachment() && (msg.getHeader('Content-Type') as string || '').includes(type);
        return this.messages.some(matcher) ? this.messages.filter(matcher)[0] : undefined;
    }

    addAttachment(opts: AttachmentOptions): MimeMessageContent {
        if (!this.isObject(opts.headers)) opts.headers = {};

        if (typeof opts.filename !== 'string') {
            throw new MimeTextError('MIMETEXT_MISSING_FILENAME', 'The property filename must exist while adding attachments.');
        }

        let type = opts.headers['Content-Type'] || opts.contentType || 'none';
        if (this.envctx.validateContentType(type) === false) {
            throw new MimeTextError('MIMETEXT_INVALID_MESSAGE_TYPE', `You specified an invalid content type "${type}".`);
        }

        const encoding = opts.headers['Content-Transfer-Encoding'] || opts.encoding || 'base64';
        if (!this.validContentTransferEncodings.includes(encoding)) {
            type = 'application/octet-stream';
        }

        const contentId = opts.headers['Content-ID'];
        if (typeof contentId === 'string' && contentId.length > 2 && contentId.slice(0, 1) !== '<' && contentId.slice(-1) !== '>') {
            opts.headers['Content-ID'] = '<' + opts.headers['Content-ID'] + '>';
        }

        const disposition = opts.inline ? 'inline' : 'attachment';

        opts.headers = Object.assign({}, opts.headers, {
            'Content-Type': `${type}; name="${opts.filename}"`,
            'Content-Transfer-Encoding': encoding,
            'Content-Disposition': `${disposition}; filename="${opts.filename}"`
        })

        return this._addMessage({ data: opts.data, headers: opts.headers });
    }

    addMessage(opts: ContentOptions): MimeMessageContent {
        if (!this.isObject(opts.headers)) opts.headers = {};

        let type = opts.headers['Content-Type'] || opts.contentType || 'none';
        if (!this.validTypes.includes(type)) {
            throw new MimeTextError('MIMETEXT_INVALID_MESSAGE_TYPE', `Valid content types are ${this.validTypes.join(', ')} but you specified "${type}".`);
        }

        const encoding = opts.headers['Content-Transfer-Encoding'] || opts.encoding || '7bit';
        if (!this.validContentTransferEncodings.includes(encoding)) {
            type = 'application/octet-stream';
        }

        const charset = opts.charset || 'UTF-8';

        opts.headers = Object.assign({}, opts.headers, {
            'Content-Type': `${type}; charset=${charset}`,
            'Content-Transfer-Encoding': encoding
        });

        return this._addMessage({ data: opts.data, headers: opts.headers });
    }

    private _addMessage(opts: { data: string, headers: ContentHeaders }): MimeMessageContent {
        const msg = new MimeMessageContent(this.envctx, opts.data, opts.headers);

        this.messages.push(msg);

        return msg;
    }

    setSender(input: MailboxAddrObject | MailboxAddrText | Email, config: { type: MailboxType } = { type: 'From' }): Mailbox {
        const mailbox = new Mailbox(input, config);
        this.setHeader('From', mailbox);
        return mailbox;
    }

    getSender(): Mailbox | undefined {
        return this.getHeader('From') as Mailbox | undefined;
    }

    setRecipients(input: MailboxAddrObject | MailboxAddrText | Email | MailboxAddrObject[] | MailboxAddrText[] | Email[], config: { type: MailboxType } = { type: 'To' }): Mailbox[] {
        const arr = !this.isArray(input) ? [input] : input;
        const recs = arr.map((_input) => new Mailbox(_input, config));
        this.setHeader(config.type, recs);
        return recs;
    }

    getRecipients(config: { type: MailboxType } = { type: 'To' }): Mailbox | Mailbox[] | undefined {
        return this.getHeader(config.type) as Mailbox | Mailbox[] | undefined;
    }

    setRecipient(input: MailboxAddrObject | MailboxAddrText | Email | MailboxAddrObject[] | MailboxAddrText[] | Email[]): Mailbox[] {
        return this.setRecipients(input, { type: 'To' });
    }

    setTo(input: MailboxAddrObject | MailboxAddrText | Email | MailboxAddrObject[] | MailboxAddrText[] | Email[]): Mailbox[] {
        return this.setRecipients(input, { type: 'To' });
    }

    setCc(input: MailboxAddrObject | MailboxAddrText | Email | MailboxAddrObject[] | MailboxAddrText[] | Email[]): Mailbox[] {
        return this.setRecipients(input, { type: 'Cc' });
    }

    setBcc(input: MailboxAddrObject | MailboxAddrText | Email | MailboxAddrObject[] | MailboxAddrText[] | Email[]): Mailbox[] {
        return this.setRecipients(input, { type: 'Bcc' });
    }

    setSubject(value: string): string {
        this.setHeader('subject', value);
        return value;
    }

    getSubject(): string | Mailbox | undefined {
        return this.getHeader('subject');
    }

    // deno-lint-ignore no-explicit-any
    setHeader(name: string, value: any): string {
        this.headers.set(name, value);
        return name;
    }

    getHeader(name: string): string | Mailbox | undefined {
        return this.headers.get(name);
    }

    setHeaders(obj: { [index: string]: string }): string[] {
        return Object.keys(obj).map((prop) => this.setHeader(prop, obj[prop]));
    }

    getHeaders(): object {
        return this.headers.toObject();
    }

    toBase64(v: string): string {
        return this.envctx.toBase64(v);
    }

    toBase64WebSafe(v: string): string {
        return this.envctx.toBase64WebSafe(v);
    }

    generateBoundaries(): void {
        this.boundaries = {
            mixed: Math.random().toString(36).slice(2),
            alt: Math.random().toString(36).slice(2),
            related: Math.random().toString(36).slice(2)
        };
    }

    isArray(v: unknown): v is unknown[] {
        return (!!v) && (v.constructor === Array);
    }

    isObject(v: unknown): v is object {
        return (!!v) && (v.constructor === Object);
    }

}
