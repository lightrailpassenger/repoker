import { deleteCookie, getCookies } from "cookies";
import { extname } from "path";

import { getRoomInfo, getUserMapping } from "../kv/mod.js";
import { createJSONResponse } from "../utils/createResponse.js";
import rewriteHTML from "../utils/rewriteHTML.js";

const routeToFileMap = new Map([
    ["/welcome", "frontend/welcome.html"],
    ["/create", "frontend/create.html"],
    ["/playground", "frontend/room.html"],
    ["/confirm", "frontend/confirm.html"],
    ["/assets/og.png", "assets/og.png"],
    ["/constants/card.js", "constants/card.js"],
    ["/constants/error.js", "constants/error.js"],
    ["/frontend/chatbox.js", "frontend/chatbox.js"],
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

const extensionToContentTypeMap = new Map([
    [".html", "text/html; charset=utf-8"],
    [".js", "text/javascript"],
    [".png", "image/png"],
]);

const NOT_FOUND_FILE_NAME = "frontend/not_found.html";

const handleServeFile = async (kv, url, requestHeaders) => {
    try {
        const { pathname, searchParams } = url;
        const file = routeToFileMap.get(pathname) ?? NOT_FOUND_FILE_NAME;
        const ext = extname(file);
        const contentType = extensionToContentTypeMap.get(ext);

        if (!contentType) {
            throw new Error(`Content type not found for file extension ${ext}`);
        }

        const headers = new Headers();
        headers.append("Content-Type", contentType);

        if (pathname === "/confirm") {
            const {
                "room_token": roomToken,
                "user_token": userToken,
            } = getCookies(requestHeaders);

            if (!roomToken || !userToken) {
                return new Response(null, {
                    headers: {
                        "Location": "/welcome",
                    },
                    status: 307,
                });
            }
        } else if (pathname === "/playground" && searchParams.has("id")) {
            const {
                "room_token": roomToken,
                "user_token": userToken,
            } = getCookies(requestHeaders);

            if (searchParams.get("id") === roomToken) {
                const roomInfo = await getRoomInfo(kv, roomToken);

                if (roomInfo) {
                    const userMapping = await getUserMapping(kv, roomToken);

                    if (
                        userToken &&
                        userMapping &&
                        Object.prototype.hasOwnProperty.call(
                            userMapping,
                            userToken,
                        )
                    ) {
                        return new Response(undefined, {
                            headers: {
                                "Location": "/playground",
                            },
                            status: 303,
                        });
                    }
                } else {
                    deleteCookie(headers, "room_token");
                    deleteCookie(headers, "user_token");
                    headers.append("Location", "/welcome");

                    return new Response(undefined, {
                        headers,
                        status: 307,
                    });
                }
            }

            const forceJoin = searchParams.get("fj");

            if (forceJoin) {
                deleteCookie(headers, "room_token");
                deleteCookie(headers, "user_token");
            } else if (roomToken && userToken) {
                return new Response(undefined, {
                    headers: {
                        "Location": `/confirm?nr=${
                            encodeURIComponent(searchParams.get("id"))
                        }`,
                    },
                    status: 307,
                });
            }
        } else if (pathname === "/create") {
            const forceJoin = searchParams.get("fj");

            if (forceJoin) {
                deleteCookie(headers, "room_token");
                deleteCookie(headers, "user_token");
            } else {
                const {
                    "room_token": roomToken,
                    "user_token": userToken,
                } = getCookies(requestHeaders);

                if (roomToken && userToken) {
                    const roomInfo = await getRoomInfo(kv, roomToken);

                    if (roomInfo) {
                        return new Response(undefined, {
                            headers: {
                                "Location": "/confirm",
                            },
                            status: 307,
                        });
                    } else {
                        deleteCookie(headers, "room_token");
                        deleteCookie(headers, "user_token");
                    }
                }
            }
        }

        if (rewritePaths.has(file)) {
            const content = await rewriteHTML(file, envMapping);
            return new Response(content, { headers });
        }

        const { readable } = await Deno.open(`src/${file}`, { read: true });
        return new Response(readable, {
            headers,
            status: file === NOT_FOUND_FILE_NAME ? 404 : 200,
        });
    } catch (err) {
        console.error(err);

        return createJSONResponse({ err: "INTERNAL_SERVER_ERROR" }, 500);
    }
};

export { handleServeFile };
