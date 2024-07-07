import { deleteCookie, getCookies } from "cookies";

import { createJSONResponse } from "../utils/createResponse.js";
import rewriteHTML from "../utils/rewriteHTML.js";

const routeToFileMap = new Map([
    ["/welcome", "frontend/welcome.html"],
    ["/create", "frontend/create.html"],
    ["/playground", "frontend/room.html"],
    ["/constants/card.js", "constants/card.js"],
    ["/constants/error.js", "constants/error.js"],
]);
const envMapping = {
    "__HCAPTCHA_SITE_KEY__": {
        envName: "HCAPTCHA_SITE_KEY",
        defaultValue: "10000000-ffff-ffff-ffff-000000000001",
    },
};
const rewritePaths = new Set([
    "frontend/create.html",
]);

const handleServeFile = async (url, requestHeaders) => {
    try {
        const { pathname, searchParams } = url;
        const file = routeToFileMap.get(pathname) ?? "frontend/not_found.html";
        const contentType = file.endsWith(".html")
            ? "text/html; charset=utf-8"
            : "text/javascript";
        const headers = new Headers();
        headers.append("Content-Type", contentType);

        if (pathname === "/playground" && searchParams.has("id")) {
            const {
                "room_token": roomToken,
            } = getCookies(requestHeaders);

            if (searchParams.get("id") !== roomToken) {
                deleteCookie(headers, "room_token");
                deleteCookie(headers, "user_token");
            }
        } else if (pathname === "/create") {
            deleteCookie(headers, "room_token");
            deleteCookie(headers, "user_token");
        }

        if (rewritePaths.has(file)) {
            const content = await rewriteHTML(file, envMapping);
            return new Response(content, { headers });
        }

        const { readable } = await Deno.open(`src/${file}`, { read: true });
        return new Response(readable, { headers });
    } catch (err) {
        console.error(err);

        return createJSONResponse({ err: "INTERNAL_SERVER_ERROR" }, 500);
    }
};

export { handleServeFile };
