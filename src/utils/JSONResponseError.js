export default class JSONResponseError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
    }
}
