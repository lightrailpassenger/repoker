import { setCookie } from "cookies";

import { availableCards } from "../constants/card.js";
import { createRoom } from "../kv/mod.js";
import { createJSONResponse } from "../utils/createResponse.js";

const handleCreateRoom = async (kv, request) => {
    try {
        const { name, cards } = await request.json();

        if (
            typeof name !== "string" ||
            !Array.isArray(cards) ||
            cards.some((card) => (!availableCards.has(card)))
        ) {
            return createJSONResponse({
                err: "BAD_REQUEST",
            }, 404);
        }

        const token = await createRoom(kv, name, cards);
        const cookie = {
            name: "room_token",
            value: token,
            httpOnly: true,
        };
        const headers = new Headers();

        setCookie(headers, cookie);

        return createJSONResponse(
            {
                created: true,
                token,
            },
            201,
            headers,
        );
    } catch (err) {
        console.error(err);

        return createJSONResponse({
            err: "INTERNAL_SERVER_ERROR",
        }, 500);
    }
};

export function createRoomHandler(kv) {
    return {
        handleCreateRoom(request) {
            return handleCreateRoom(kv, request);
        },
    };
}
