import { setCookies } from "cookies";

import { availableCards } from "../constants/card.js";
import { createRoom } from "../kv/mod.js";

const handleCreateRoom = async (kv, request) => {
    try {
        const { body } = request;
        const { name, cards } = body;

        if (
            typeof name !== "string" ||
            !Array.isArray(cards) ||
            cards.some((card) => (!availableCards.has(card)))
        ) {
            return createJSONResponse({
                err: "BAD_REQUEST",
            }, 401);
        }

        const token = await createRoom(kv, name, cards);
        const cookies = {
            name: "room_token",
            value: token,
            httpOnly: true,
        };
        const headers = new Headers();

        setCookies(headers, cookies);

        return createJSONResponse(
            {
                created: true,
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

export default function (kv) {
    return {
        handleCreateRoom(request) {
            return handleCreateRoom(kv, request);
        },
    };
}
