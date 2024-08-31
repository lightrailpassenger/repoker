import { gc } from "../kv/mod.js";

const run = async (kv, options = {}) => {
    const { immediate = false } = options;

    Deno.cron("Garbage collection", "0 */4 * * *", async () => {
        await gc(kv);
    });

    if (immediate) {
        await gc(kv);
    }
};

export { run };
