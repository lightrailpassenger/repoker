import { createConnection } from "./routes/connection.js";
import { createRoomHandler } from "./routes/room.js";

import { createJSONResponse } from "./utils/createResponse.js";

const port = Deno.env.get("PORT") ?? 8000;
const kv = Deno.openKv();

const { handleCreateConnection, handleConnection, handleConnectionClose } =
    createConnection(kv);
const { handleCreateRoom } = createRoomHandler(kv);

Deno.serve({
    port,
    handler: async (request) => {
        const { headers, url } = request;

        if (url === "/conn") {
            const upgradeHeader = headers.get("Upgrade");

            if (upgradeHeader === "websocket") {
                const { socket, response } = Deno.upgradeWebSocket(request);

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
        } else if (url.startsWith("/rooms")) {
            if (method === "POST") {
                return handleCreateRoom(request);
            }
        } else if (url.startsWith("/users")) {
            if (method === "POST") {
                return handleCreateUser(request);
            }
        }

        return createJSONResponse({
            err: "Not Found",
        }, 404);
    },
});
