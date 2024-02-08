import { MimeMessage } from './mime_message.ts';
import { EnvironmentContext } from './types.d.ts';
import { encodeBase64 } from 'https://deno.land/std@0.214.0/encoding/base64.ts';
import { encodeBase64Url } from 'https://deno.land/std@0.214.0/encoding/base64url.ts';

export function createMimeMessage(): MimeMessage {
    const ctx: EnvironmentContext = {
        toBase64: (data: string) => encodeBase64(new TextEncoder().encode(data)),
        toBase64WebSafe: (data: string) => encodeBase64Url(new TextEncoder().encode(data)),
        eol: '\r\n',
        validateContentType: (v: string): string | false => {
            return v.length > 0 ? v : false;
        }
    }

    return new MimeMessage(ctx);
}
