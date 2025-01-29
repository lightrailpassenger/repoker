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
        const callbacks = this.#listenerMap.get(
            ListenerStore.#getMapKey(type, key),
        );

        if (callbacks) {
            callbacks.add(callback);
        } else {
            this.#listenerMap.set(
                ListenerStore.#getMapKey(type, key),
                new Set([callback]),
            );
        }
    }

    notify(type, key, payload) {
        this.#kv.enqueue({ type, key, payload });
    }

    startListening() {
        this.#kv.listenQueue((message) => {
            try {
                const { key, type, payload } = message;
                const mapKey = ListenerStore.#getMapKey(type, key);
                const callbacks = this.#listenerMap.get(mapKey);

                if (callbacks) {
                    for (const callback of callbacks) {
                        try {
                            callback(payload);
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
