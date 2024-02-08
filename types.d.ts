import { Mailbox } from './mailbox.ts';

export interface EnvironmentContext {
    toBase64: (v: string) => string,
    toBase64WebSafe: (v: string) => string,
    eol: string,
    validateContentType: (v: string) => string | false
}

export type MailboxType = 'To' | 'From' | 'Cc' | 'Bcc';

export type MailboxAddrObject = {
    addr: string,
    name?: string,
    type?: MailboxType
};
export type MailboxAddrText = string;
export type Email = string;

export type HeaderField = {
    name: string,
    dump?: (v: string | Mailbox | Mailbox[] | undefined) => string,
    value?: string | Mailbox | undefined,
    validate?: (v: unknown) => boolean
    required?: boolean,
    disabled?: boolean,
    generator?: () => string,
    custom?: boolean
};

export type Boundaries = {
    mixed: string,
    alt: string,
    related: string
};

export type ContentTransferEncoding = '7bit' | '8bit' | 'binary' | 'quoted-printable' | 'base64';

export type ContentHeaders = {
    'Content-Type'?: string,
    'Content-Transfer-Encoding'?: ContentTransferEncoding,
    'Content-Disposition'?: string,
    'Content-ID'?: string,
    [index: string]: string | undefined
};

export type ContentOptions = {
    data: string
    encoding?: ContentTransferEncoding
    contentType: string,
    headers?: ContentHeaders
    charset?: string
};

export interface AttachmentOptions extends ContentOptions {
    inline?: boolean,
    filename: string
}
