# mimetext
Raw email generator, port of https://github.com/muratgozel/MIMEText

Useful when working with [Amazon SES](https://aws.amazon.com/ses/), [Google Gmail](https://developers.google.com/gmail/api/guides) or [Cloudflare Email Workers](https://developers.cloudflare.com/email-routing/email-workers/send-email-workers/).

### Usage

```ts
import { createMimeMessage } from 'jsr:@skymethod/mimetext';

const msg = createMimeMessage();
msg.setSender({ name: 'Example Sender', addr: 'from@example.com' });
msg.setRecipient('to@example.com');
msg.setSubject('🚀 Hello world!');
msg.addMessage({ contentType: 'text/plain', data: `Hi,\nThis is a simple text message.` });

const raw = msg.asRaw();
```

### Usage (more complex)

```ts
import { createMimeMessage } from 'jsr:@skymethod/mimetext';

const msg = createMimeMessage();
msg.setSender('from@example.com');
msg.setRecipient('Firstname Lastname <first@example.com>'); // 'To' field by default
msg.setRecipient('Firstname Lastname <second@example.com>', { type: 'Cc' }); // To, Cc, Bcc
msg.setRecipient({ addr: 'third@example.com', name: 'Firstname Lastname', type: 'Bcc' });
msg.setSubject('Testing 🐬 (Text/HTML/Mixed attachments)');

// support both plain-text and html
msg.addMessage({
    contentType: 'text/plain',
    data: 'Hello there,\n\nThis is a the text part!',
});
msg.addMessage({
    contentType: 'text/html',
    data: 'Hello there,<br><br>' +
        'This is the <b>html part</b>.<br><br>' +
        'The term \'html part\' above should be bold.<br><br>' +
        'Below, there should be a small image:<br><br>' +
        '<img src="cid:dots123456">', // specify inline attachment's content id (declared below)
});

// attachments
msg.addAttachment({
    filename: 'sample.jpg',
    contentType: 'image/jpg',
    data: '...base64 encoded data...',
});
msg.addAttachment({
    filename: 'sample.txt',
    contentType: 'text/plain',
    data: '...base64 encoded data...',
});
msg.addAttachment({
    inline: true, // this is inline attachment!
    filename: 'dots.jpg',
    contentType: 'image/jpg',
    data: '...base64 encoded data...',
    headers: { 'Content-ID': 'dots123456' }, // referenced in html part
});

const raw = msg.asRaw();
```