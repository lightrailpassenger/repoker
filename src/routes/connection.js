import { getCookies, setCookie } from "cookies";

import {
    clear,
    createUser,
    flip,
    getRoomInfo,
    vote,
    watch,
} from "../kv/mod.js";
import { createJSONResponse } from "../utils/createResponse.js";

const handleCreateUser = async (kv, request) => {
    try {
        const { headers: requestHeaders } = request;
        const cookies = getCookies(requestHeaders);
        const {
            "room_token": roomToken,
        } = cookies;
        const {
            roomToken: roomTokenFromBody,
            username,
        } = await request.json();
        const mergedRoomToken = roomToken ?? roomTokenFromBody;

        if (typeof username !== "string") {
            return createJSONResponse({ err: "BAD_REQUEST" }, 400);
        }

        // TODO: Room not found case
        const userToken = await createUser(kv, mergedRoomToken, username);
        const headers = new Headers();

        setCookie(headers, {
            name: "user_token",
            value: userToken,
            httpOnly: true,
        });
        setCookie(headers, {
            name: "room_token",
            value: mergedRoomToken,
            httpOnly: true,
        });

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

        if (room) {
            socket.send(JSON.stringify({ init: true, room }));
        } else {
            socket.send("not_found");
        }

        for await (const state of watch(kv, roomToken)) {
            socket.send(JSON.stringify({
                roomState: state,
            }));
        }
    } catch (err) {
        console.error(err);
        try {
            socket.send("error");
            socket.close();
        } catch (err2) {
            console.error(err2);
        }
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
        const { changes } = JSON.parse(data);

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
        handleConnectionClose() {
            return () => {}; // TODO
        },
    };
}
