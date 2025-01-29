class ListenerStore {
    #kv;
    #listenerMap = new Map();

    constructor(kv) {
        this.#kv = kv;
    }

    static #getMapKey(type, key) {
        return `${type}--${key}`;
    }

    addListener(type, key, callback) {
        const mapKey = ListenerStore.#getMapKey(type, key);
        console.log("Listening to key", mapKey);
        const callbacks = this.#listenerMap.get(mapKey);

        if (callbacks) {
            callbacks.add(callback);
        } else {
            this.#listenerMap.set(mapKey, new Set([callback]));
        }
    }

    notify(type, key, payload) {
        console.log("Enqueueing", { type, key, payload });
        this.#kv.enqueue({ type, key, payload });
    }

    startListening() {
        const testMap = new Map();
        testMap.set("testKey", "testValue");

        this.#kv.listenQueue(async (message) => {
            console.log("Receiving message", message);
            console.log("Test map", testMap);

            try {
                const { key, type, payload } = message;
                const mapKey = ListenerStore.#getMapKey(type, key);
                const callbacks = this.#listenerMap.get(mapKey);
                console.log("Calling callbacks", {
                    map: this.#listenerMap,
                    size: callbacks?.size,
                    mapKey,
                });

                if (callbacks) {
                    for (const callback of callbacks) {
                        try {
                            await callback(payload);
                        } catch (err) {
                            console.error(err);
                        }
                    }
                }
            } catch (err) {
                console.error(err);
            }
        });
    }
}

export { ListenerStore };
