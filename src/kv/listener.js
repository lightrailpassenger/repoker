import { getLatest, pushItem } from "./mod.js";

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
        pushItem(
            this.#kv,
            "temp-queue",
            { type, key, payload },
        );
    }

    async startListening() {
        for await (const values of getLatest(this.#kv, "temp-queue")) {
            if (values.length === 0) {
                continue;
            }

            for (const value of values) {
                const { type, key, payload } = value;
                const mapKey = ListenerStore.#getMapKey(type, key);
                const callbacks = this.#listenerMap.get(mapKey);

                if (callbacks) {
                    for (const callback of callbacks) {
                        try {
                            callback(payload);
                        } catch {
                            // pass
                        }
                    }
                }
            }
        }
    }
}

export { ListenerStore };
