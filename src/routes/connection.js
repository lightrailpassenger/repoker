import { getCookies } from "cookies";

import { clear, createUser, flip, getRoomInfo, vote } from "../kv/mod.js";

const handleCreateUser = async (kv, request) => {
    try {
        const { headers, body } = request;
        const { username } = body;
        const userToken = await createUser(kv, roomToken, username);
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

const handleCreateConnection = async (
    socket,
    request,
    _response,
    _event,
    kv,
) => {
    try {
        const { headers } = request;
        const cookies = getCookies(headers);
        const {
            "room_token": roomToken,
        } = cookies;

        const room = await getRoomInfo(kv, roomToken);

        socket.write(JSON.stringify({ room }));

        for await (const state of watch(kv, roomToken)) {
            socket.write(JSON.stringify({
                roomState: state,
            }));
        }
    } catch (err) {
        console.error(err);
        socket.send("error");
        socket.close();
    }
};

const handleConnection = async (socket, request, _response, event, kv) => {
    try {
        const { data } = event;
        const { headers } = request;
        const cookies = getCookies(headers);
        const {
            "room_token": roomToken,
            "user_token": userToken,
        } = cookies;
        const { changes } = data;

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
            return handleCreateConnection(socket, request, response, event, kv);
        },
        handleConnection(socket, request, response, event) {
            return handleConnection(socket, request, response, event, kv);
        },
        handleConnectionClose(socket, request, response, event) {
            return handleConnectionClose(socket, request, response, event, kv);
        },
    };
}
