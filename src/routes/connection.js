import { getCookies } from "cookies";

import { clear, flip, vote } from "../kv/mod.js";

const handleCreateUser = async (kv, request) => {
    try {
        const { headers, body } = request;
        const { username } = body;
        const userToken = createUser(kv, roomToken, username);
        const cookies = {
            name: "user_token",
            value: userToken,
            httpOnly: true,
        };
        const headers = new Headers();

        setCookies(headers, cookies);

        return createJSONResponse({ created: true }, 201, headers);
    } catch (err) {
        console.error(err);

        return createJSONResponse({ err: "INTERNAL_SERVER_ERROR" }, 500);
    }
};

const handleCreateConnection = async (socket, request, reponse, event, kv) => {
    try {
        const { headers } = request;
        const cookies = getCookies(request);
        const {
            "room_token": roomToken,
            "user_token": userToken,
        } = cookies;

        for await (const state of watch(kv, roomToken)) {
            socket.write(JSON.stringify({
                roomState: status,
            }));
        }
    } catch (err) {
        console.error(err);
        socket.send("error");
        socket.close();
    }
};

const handleConnection = async (socket, request, response, event, kv) => {
    try {
        const { data } = event;
        const { headers } = request;
        const cookies = getCookies(headers);
        const {
            "room_token": roomToken,
            "user_token": userToken,
        } = cookies;
        const { name, changes } = data;

        // Changes
        if (Object.prototype.hasOwnProperty.call(changes, "vote")) {
            await vote(kv, roomToken, userToken, changes.vote);
        } else if (Object.prototype.hasOwnProperty.call(changes, "flip")) {
            await flip(kv, roomToken, userToken, Boolean(changes.flip));
        } else if (Object.prototype.hasOwnProperty.call(changes, "clear")) {
            await clear(kv, roomToken, userToken);
        }
    } catch (err) {
        console.error(err);
        socket.send("error");
        socket.close();
    }
};

export function createConnection(kv) {
    return {
        handleCreateUser(request) {
            return handleCreateUser(kv, request);
        },
        handleCreateConnection(socket, request, response, event) {
            return handleCreateConnection(socket, request, respnose, event, kv);
        },
        handleConnection(socket, request, response, event) {
            return handleConnection(socket, request, response, event, kv);
        },
        handleConnectionClose(socket, request, response, event) {
            return handleConnectionClose(socket, request, response, event, kv);
        },
    };
}
