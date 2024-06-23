import { createConnection } from "./routes/connection.js";
import { createRoomHandler } from "./routes/room.js";

import { createJSONResponse } from "./utils/createResponse.js";

const port = Deno.env.get("PORT") ?? 8000;
const kv = await Deno.openKv();

const {
    handleCreateUser,
    handleCreateConnection,
    handleConnection,
    handleConnectionClose,
} = createConnection(kv);
const { handleCreateRoom } = createRoomHandler(kv);

Deno.serve({
    port,
    handler: async (request) => {
        const { method: httpMethod, headers, url } = request;
        const method = httpMethod.toUpperCase();
        const { pathname } = new URL(url);

        if (pathname === "/conn") {
            const upgradeHeader = headers.get("Upgrade");

            if (upgradeHeader === "websocket") {
                const { socket, response } = Deno.upgradeWebSocket(request);

                socket.onopen = (event) => {
                    handleCreateConnection(
                        socket,
                        request,
                        response,
                        event,
                        kv,
                    );
                };
                socket.onmessage = (event) => {
                    handleConnection(socket, request, response, event);
                };
                socket.onclose = (event) => {
                    handleConnectionClose(socket, request, response, event);
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
            }
        } else if (pathname.startsWith("/users")) {
            if (method === "POST") {
                return await handleCreateUser(request);
            }
        }

        return createJSONResponse({
            err: "Not Found",
        }, 404);
    },
});
