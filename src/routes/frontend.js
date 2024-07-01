import { deleteCookie } from "cookies";

import { createJSONResponse } from "../utils/createResponse.js";

const routeToFileMap = new Map([
    ["/welcome", "frontend/welcome.html"],
    ["/create", "frontend/create.html"],
    ["/playground", "frontend/room.html"],
    ["/constants/card.js", "constants/card.js"],
    ["/constants/error.js", "constants/error.js"],
]);

const handleServeFile = async (url) => {
    try {
        const { pathname } = url;
        const file = routeToFileMap.get(pathname) ?? "frontend/not_found.html";
        const contentType = file.endsWith(".html")
            ? "text/html; charset=utf-8"
            : "text/javascript";
        const { readable } = await Deno.open(`src/${file}`, { read: true });
        const headers = new Headers();
        headers.append("Content-Type", contentType);

        if (pathname === "/create") {
            deleteCookie(headers, "room_token");
            deleteCookie(headers, "user_token");
        }

        return new Response(readable, { headers });
    } catch (err) {
        console.error(err);

        return createJSONResponse({ err: "INTERNAL_SERVER_ERROR" }, 500);
    }
};

export { handleServeFile };
