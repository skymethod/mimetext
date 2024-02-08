export class MimeTextError extends Error {
    override name = '';
    description = '';

    constructor(message: string, description = '') {
        super(description);

        this.name = message;
        this.description = description;
    }
}
