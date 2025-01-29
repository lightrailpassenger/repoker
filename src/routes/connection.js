import { getCookies, setCookie } from "cookies";

import { types as messageTypes } from "../constants/message.js";
import {
    clear,
    createUser,
    evictUser,
    flip,
    getRoomInfo,
    getUserMapping,
    vote,
    watch,
} from "../kv/mod.js";
import { createJSONResponse } from "../utils/createResponse.js";
import JSONResponseError from "../utils/JSONResponseError.js";

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

        const { isFirst, userId, token: userToken } = await createUser(
            kv,
            mergedRoomToken,
            username,
        );
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

        return createJSONResponse(
            { created: true, isFirst, userId },
            201,
            headers,
        );
    } catch (err) {
        if (err instanceof JSONResponseError) {
            const { value, status } = err.code;

            return createJSONResponse({ code: value }, status);
        }

        console.error(err);

        return createJSONResponse({ err: "INTERNAL_SERVER_ERROR" }, 500);
    }
};

const handleDeleteUser = async (
    kv,
    request,
) => {
    try {
        const { url, headers } = request;
        const cookies = getCookies(headers);
        const {
            "room_token": roomToken,
            "user_token": userToken,
        } = cookies;
        const { searchParams } = new URL(url);
        const userId = searchParams.get("userId");

        if (!userId) {
            return createJSONResponse({ err: "BAD_REQUEST" }, 400);
        }

        const isSuccessful = await evictUser(
            kv,
            roomToken,
            userToken,
            userId,
        );

        if (!isSuccessful) {
            return createJSONResponse({ err: "FORBIDDEN" }, 403);
        }

        return createJSONResponse({ res: "OK" }, 200);
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
    listenerStore,
) => {
    let onClose;

    try {
        const { headers } = request;
        const cookies = getCookies(headers);
        const {
            "room_token": roomToken,
            "user_token": userToken,
        } = cookies;

        if (!roomToken) {
            socket.send("not_found");

            return {
                onClose: () => {},
            };
        }

        const room = await getRoomInfo(kv, roomToken, userToken);

        if (room?.userId) {
            socket.send(JSON.stringify({ init: true, room }));
        } else {
            socket.send("not_found");
        }

        let isClosed = false;

        onClose = () => {
            isClosed = true;
        };

        listenerStore.addListener(
            messageTypes.ROOM_MESSAGE_TYPE_V1,
            roomToken,
            async (payload) => {
                const { id, ut, msg, at } = payload;
                const { [ut]: name } = await getUserMapping(kv, roomToken);

                socket.send(JSON.stringify({
                    message: { id, name, at, msg, me: ut === userToken },
                }));
            },
        );
        (async () => {
            try {
                for await (const state of watch(kv, roomToken, userToken)) {
                    if (isClosed) {
                        break;
                    } else if (state.evicted) {
                        socket.send(JSON.stringify({ evicted: true }));
                    }

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
        })();
    } catch (err) {
        console.error(err);
        try {
            socket.send("error");
            socket.close();
        } catch (err2) {
            console.error(err2);
        }
    }

    return { onClose };
};

const handleConnection = async (
    socket,
    request,
    _response,
    event,
    kv,
    listenerStore,
) => {
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
        } else if (Object.prototype.hasOwnProperty.call(changes, "msg")) {
            listenerStore.notify(
                messageTypes.ROOM_MESSAGE_TYPE_V1,
                roomToken,
                {
                    id: changes.msg.id.substring(0, 64),
                    ut: userToken,
                    msg: changes.msg.txt.substring(0, 2048),
                    at: Date.now(),
                },
            );
        }
    } catch (err) {
        console.error(err);
        socket.send("error");
        socket.close();
    }
};

export function createConnection(kv, listenerStore) {
    return {
        handleCreateUser(request) {
            return handleCreateUser(kv, request);
        },
        handleCreateConnection(socket, request, response, event) {
            return handleCreateConnection(
                socket,
                request,
                response,
                event,
                kv,
                listenerStore,
            );
        },
        handleConnection(socket, request, response, event) {
            return handleConnection(
                socket,
                request,
                response,
                event,
                kv,
                listenerStore,
            );
        },
        handleConnectionClose(_socket, _request, _response, _event, onClose) {
            // TODO: Any extra logic?
            return onClose?.();
        },
        handleDeleteUser(request) {
            return handleDeleteUser(kv, request);
        },
    };
}
