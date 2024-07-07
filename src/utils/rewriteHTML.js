const cache = new Map();

const getCacheKey = async (path) => {
    const { mtime } = await Deno.stat(`./src/${path}`);

    return `${path}___${mtime}`;
};

const rewriteHTML = async (path, mapping) => {
    const cacheKey = await getCacheKey(path);
    const result = cache.get(cacheKey);

    if (result) {
        return result;
    }

    const data = await Deno.readFile(`./src/${path}`);
    const content = new TextDecoder("utf-8").decode(data);

    return Object.entries(mapping).reduce((acc, [
        placeholder,
        { envName, defaultValue },
    ]) => {
        const value = Deno.env.get(envName) ?? defaultValue;
        return acc.replace(new RegExp(placeholder, "g"), value);
    }, content);
};

export default rewriteHTML;
