import { errorCode } from "../constants/error.js";
import generateToken from "../utils/generateToken.js";
import JSONResponseError from "../utils/JSONResponseError.js";

const MAX_TRY = 10;

const CARD_KEY = "card";
const ROOM_NAME_KEY = "roomName";
const ROOM_VOTE_KEY = "roomVote";
const USER_NAME_KEY = "userNameKey";

const EXPIRE_MS = 3 * 60 * 60 * 1000;

const createRoom = async (kv, roomName, cards) => {
    const roomToken = await generateToken();

    await kv.atomic()
        .set([roomToken, CARD_KEY], cards, { expireIn: EXPIRE_MS })
        .set([roomToken, ROOM_VOTE_KEY], {
            vote: {},
            shown: false,
        }, { expireIn: EXPIRE_MS })
        .set([roomToken, ROOM_NAME_KEY], roomName, { expireIn: EXPIRE_MS })
        .set([roomToken, USER_NAME_KEY], {}, { expireIn: EXPIRE_MS })
        .commit();

    return roomToken;
};

const getRoomInfo = async (kv, roomToken) => {
    const [
        { value: cards },
        { value: name },
        { value: roomVotes },
        { value: mapping },
    ] = await kv.getMany([
        [roomToken, CARD_KEY],
        [roomToken, ROOM_NAME_KEY],
        [roomToken, ROOM_VOTE_KEY],
        [roomToken, USER_NAME_KEY],
    ]);

    if (!cards || !name || !roomVotes || !mapping) {
        return null;
    }

    const state = Object.create(null);
    const { vote, shown } = roomVotes;

    for (const key in mapping) {
        state[mapping[key]] = vote[key] ?? null;
    }

    return {
        name: name,
        cards: cards,
        vote: state,
        shown,
    };
};

const createUser = async (kv, roomToken, username) => {
    const newToken = await generateToken();
    const usernameRes = await kv.get([roomToken, USER_NAME_KEY]);

    let transaction;
    let count = 0;

    do {
        const { value } = usernameRes;

        if (!value) {
            throw new JSONResponseError(
                "Room does not exist",
                errorCode.ROOM_EXPIRED,
            );
        } else if (Object.values(value).includes(username)) {
            throw new JSONResponseError(
                "Name already used",
                errorCode.NAME_ALREADY_USED,
            );
        }

        const newValue = {
            ...value,
            [newToken]: username,
        };

        count++;
        transaction = await kv.atomic()
            .check(usernameRes)
            .set([roomToken, USER_NAME_KEY], newValue)
            .commit();
    } while (!transaction.ok && count <= MAX_TRY);

    if (transaction.ok) {
        return newToken;
    } else {
        throw new Error("Tried too many times");
    }
};

const getUserMapping = async (kv, roomToken) => {
    const { value } = await kv.get([roomToken, USER_NAME_KEY]);

    return value;
};

const vote = async (kv, roomToken, userToken, vote) => {
    const { value: availableCards } = await kv.get([roomToken, CARD_KEY]);

    if (!availableCards.includes(vote)) {
        throw new Error("Invalid vote");
    }

    let transaction;
    let count = 0;

    do {
        const statusRes = await kv.get([roomToken, ROOM_VOTE_KEY]);
        const { value: status } = statusRes;
        const newValue = {
            ...status,
            vote: {
                ...status.vote,
                [userToken]: vote,
            },
        };

        count++;
        transaction = await kv.atomic()
            .check(statusRes)
            .set([roomToken, ROOM_VOTE_KEY], newValue)
            .commit();
    } while (!transaction.ok && count <= MAX_TRY);

    if (!transaction.ok) {
        throw new Error("Tried too many times");
    }
};

const clear = async (kv, roomToken) => {
    await kv.set([roomToken, ROOM_VOTE_KEY], {
        vote: {},
        shown: false,
    });
};

const flip = async (kv, roomToken) => {
    let transaction;
    let count = 0;

    do {
        const statusRes = await kv.get([roomToken, ROOM_VOTE_KEY]);
        const { value } = statusRes;
        const newValue = {
            ...value,
            shown: !value.shown,
        };

        count++;
        transaction = await kv.atomic()
            .check(statusRes)
            .set([roomToken, ROOM_VOTE_KEY], newValue)
            .commit();
    } while (!transaction.ok && count <= MAX_TRY);

    if (!transaction.ok) {
        throw new Error("Tried too many times");
    }
};

const watch = async function* (kv, roomToken) {
    for await (
        const _change of kv.watch([
            [roomToken, ROOM_VOTE_KEY],
            [roomToken, USER_NAME_KEY],
        ])
    ) {
        const [{ value: { vote: roomVote, shown } }, { value: mapping }] =
            await kv.getMany([
                [roomToken, ROOM_VOTE_KEY],
                [roomToken, USER_NAME_KEY],
            ]);
        const mappedState = Object.create(null);

        for (const key in mapping) {
            mappedState[mapping[key]] = roomVote[key] ?? null;
        }

        yield {
            vote: mappedState,
            shown,
        };
    }
};

export {
    clear,
    createRoom,
    createUser,
    flip,
    getRoomInfo,
    getUserMapping,
    vote,
    watch,
};
