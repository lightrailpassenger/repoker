import CaptchaVerifier from "./captcha/Verifier.js";

import { run } from "./cron/index.js";

import { createConnection } from "./routes/connection.js";
import { handleServeFile } from "./routes/frontend.js";
import { createRoomHandler } from "./routes/room.js";

import { createJSONResponse } from "./utils/createResponse.js";

const port = Deno.env.get("PORT") ?? 8000;
const kv = await Deno.openKv();
const captchaVerifier = new CaptchaVerifier();

const {
    handleCreateUser,
    handleCreateConnection,
    handleConnection,
    handleConnectionClose,
} = createConnection(kv);
const { handleCreateRoom, handleShareRoom } = createRoomHandler(
    kv,
    captchaVerifier,
);

Deno.serve({
    port,
    handler: async (request) => {
        const { method: httpMethod, headers, url } = request;
        const method = httpMethod.toUpperCase();
        const urlObject = new URL(url);
        const { pathname } = urlObject;

        if (pathname === "/conn") {
            const upgradeHeader = headers.get("Upgrade");

            if (upgradeHeader === "websocket") {
                const { socket, response } = Deno.upgradeWebSocket(request);

                socket.onopen = async (event) => {
                    const { onClose } = await handleCreateConnection(
                        socket,
                        request,
                        response,
                        event,
                        kv,
                    );

                    socket.onmessage = (event) => {
                        handleConnection(socket, request, response, event);
                    };
                    socket.onclose = (event) => {
                        handleConnectionClose(
                            socket,
                            request,
                            response,
                            event,
                            onClose,
                        );
                    };
                };

                return response;
            } else {
                return createJSONResponse(
                    {
                        err: "Upgrade Required",
                    },
                    426,
                    {
                        "Connection": "Upgrade",
                        "Upgrade": "websocket",
                    },
                );
            }
        } else if (pathname.startsWith("/rooms")) {
            if (method === "POST") {
                return await handleCreateRoom(request);
            } else if (
                pathname === "/rooms/url" &&
                (method === "GET" || method === "HEAD")
            ) {
                return await handleShareRoom(request);
            }
        } else if (pathname.startsWith("/users")) {
            if (method === "POST") {
                return await handleCreateUser(request);
            }
        } else if (method === "GET" && pathname === "/" || pathname === "") {
            return new Response(undefined, {
                status: 308,
                headers: {
                    "Location": "/welcome",
                },
            });
        } else if (method === "GET") {
            return await handleServeFile(kv, urlObject, headers);
        }

        return createJSONResponse({
            err: "Not Found",
        }, 404);
    },
});

run(kv, { immediate: true });
