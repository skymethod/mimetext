import type { EnvironmentContext } from './types.d.ts';
import { MimeMessageContentHeader } from './mime_message_header.ts';
import { Mailbox } from './mailbox.ts';

export class MimeMessageContent {
    readonly envctx: EnvironmentContext;
    readonly headers: MimeMessageContentHeader;
    readonly data: string;

    constructor(envctx: EnvironmentContext, data: string, headers = {}) {
        this.envctx = envctx;
        this.headers = new MimeMessageContentHeader(this.envctx);
        this.data = data;
        this.setHeaders(headers);
    }

    dump(): string {
        const eol = this.envctx.eol;
        return this.headers.dump() + eol + eol + this.data;
    }

    isAttachment(): boolean {
        const disposition = this.headers.get('Content-Disposition');
        return typeof disposition === 'string' && disposition.includes('attachment');
    }

    isInlineAttachment(): boolean {
        const disposition = this.headers.get('Content-Disposition');
        return typeof disposition === 'string' && disposition.includes('inline');
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
        return this.headers.toObject()
    }
}