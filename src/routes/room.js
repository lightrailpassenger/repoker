import { getCookies, setCookie } from "cookies";

import { availableCards } from "../constants/card.js";
import { createRoom, getRoomInfo } from "../kv/mod.js";
import { createJSONResponse } from "../utils/createResponse.js";

const MAX_ROOM_NAME_LENGTH = 100;
const handleCreateRoom = async (kv, captchaVerifier, request) => {
    try {
        const { name, cards, captchaToken } = await request.json();

        if (
            typeof name !== "string" ||
            name.length > MAX_ROOM_NAME_LENGTH ||
            !Array.isArray(cards) ||
            cards.some((card) => (!availableCards.has(card))) ||
            typeof captchaToken !== "string"
        ) {
            return createJSONResponse({
                err: "BAD_REQUEST",
            }, 401);
        }

        const isValid = await captchaVerifier.verify(captchaToken);

        if (!isValid) {
            return createJSONResponse({
                err: "FORBIDDEN",
            }, 403);
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

const handleShareRoom = async (kv, request) => {
    try {
        const { headers, url } = request;
        const { "room_token": roomToken } = getCookies(headers);
        const { searchParams } = new URL(url);
        const mergedRoomToken = roomToken ?? searchParams.get("token");

        if (!mergedRoomToken) {
            return createJSONResponse({
                err: "BAD_REQUEST",
            }, 400);
        }

        const roomInfo = await getRoomInfo(kv, mergedRoomToken);

        if (!roomInfo) {
            return createJSONResponse({
                err: "NOT_FOUND",
            }, 404);
        }

        return createJSONResponse({
            url: `/playground?id=${encodeURIComponent(mergedRoomToken)}`,
        }, 200);
    } catch (err) {
        console.error(err);

        return createJSONResponse({
            err: "INTERNAL_SERVER_ERROR",
        }, 500);
    }
};

export function createRoomHandler(kv, captchaVerifier) {
    return {
        handleCreateRoom(request) {
            return handleCreateRoom(kv, captchaVerifier, request);
        },
        handleShareRoom(request) {
            return handleShareRoom(kv, request);
        },
    };
}
