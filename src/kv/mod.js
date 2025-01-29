import { errorCode } from "../constants/error.js";
import generateToken from "../utils/generateToken.js";
import JSONResponseError from "../utils/JSONResponseError.js";

const MAX_TRY = 10;

const CARD_KEY = "card";
const ROOM_NAME_KEY = "roomName";
const ROOM_VOTE_KEY = "roomVote";
const USER_NAME_KEY = "userNameKey";
const USER_TOKEN_TO_ID_KEY = "userTokenToId";
const FIRST_USER_KEY = "firstUser";

const EXPIRE_MS = 3 * 60 * 60 * 1000;
const MAX_USERS_COUNT = 100;

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
        .set([roomToken, USER_TOKEN_TO_ID_KEY], {}, { expireIn: EXPIRE_MS })
        .commit();

    return roomToken;
};

const getRoomInfo = async (kv, roomToken, myToken) => {
    const [
        { value: cards },
        { value: name },
        { value: roomVotes },
        { value: mapping },
        { value: ids },
        {
            value: firstUserInfo,
        },
    ] = await kv.getMany([
        [roomToken, CARD_KEY],
        [roomToken, ROOM_NAME_KEY],
        [roomToken, ROOM_VOTE_KEY],
        [roomToken, USER_NAME_KEY],
        [roomToken, USER_TOKEN_TO_ID_KEY],
        [roomToken, FIRST_USER_KEY],
    ]);

    if (!cards || !name || !roomVotes || !mapping) {
        return null;
    }

    const state = Object.create(null);
    const { vote, shown } = roomVotes;

    for (const key in mapping) {
        state[mapping[key]] = {
            vote: vote[key] ?? null,
            id: ids[key],
        };
    }

    const result = {
        name: name,
        cards: cards,
        vote: state,
        shown,
    };

    if (myToken) {
        const { token: firstUserToken = null } = firstUserInfo ?? {};

        result.isFirst = firstUserToken === null
            ? null
            : firstUserToken === myToken;
        result.userId = ids[myToken];
    }

    return result;
};

const createUser = async (kv, roomToken, username) => {
    const newToken = await generateToken();
    const newUserId = crypto.randomUUID();
    const [
        usernameRes,
        userTokenToIdRes,
    ] = await kv.getMany([
        [roomToken, USER_NAME_KEY],
        [roomToken, USER_TOKEN_TO_ID_KEY],
    ]);

    let transaction;
    let count = 0;
    let isFirst;

    do {
        const { value } = usernameRes;

        if (!value) {
            throw new JSONResponseError(
                "Room does not exist",
                errorCode.ROOM_EXPIRED,
            );
        } else if (Object.keys(value).length >= MAX_USERS_COUNT) {
            throw new JSONResponseError(
                "Too many users",
                errorCode.TOO_MANY_USER,
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
        const newUserTokenToIdValue = {
            ...userTokenToIdRes.value,
            [newToken]: newUserId,
        };

        count++;
        let pendingTransaction = kv.atomic()
            .check(usernameRes)
            .check(userTokenToIdRes)
            .set([roomToken, USER_NAME_KEY], newValue)
            .set([roomToken, USER_TOKEN_TO_ID_KEY], newUserTokenToIdValue);

        isFirst = Object.keys(value).length === 0;

        if (isFirst) {
            pendingTransaction = pendingTransaction.set([
                roomToken,
                FIRST_USER_KEY,
            ], {
                token: newToken,
            });
        }

        transaction = await pendingTransaction.commit();
    } while (!transaction.ok && count <= MAX_TRY);

    if (transaction.ok) {
        return {
            token: newToken,
            userId: newUserId,
            isFirst,
        };
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

const watch = async function* (kv, roomToken, myToken) {
    for await (
        const _change of kv.watch([
            [roomToken, ROOM_VOTE_KEY],
            [roomToken, USER_NAME_KEY],
        ])
    ) {
        const [
            { value: { vote: roomVote, shown } },
            { value: mapping },
            { value: ids },
        ] = await kv.getMany([
            [roomToken, ROOM_VOTE_KEY],
            [roomToken, USER_NAME_KEY],
            [roomToken, USER_TOKEN_TO_ID_KEY],
        ]);

        if (!mapping[myToken]) {
            yield { evicted: true };
        }

        const mappedState = Object.create(null);

        for (const key in mapping) {
            mappedState[mapping[key]] = {
                vote: roomVote[key] ?? null,
                id: ids[key],
            };
        }

        yield {
            vote: mappedState,
            shown,
        };
    }
};

const gc = async (kv) => {
    for await (const { key } of kv.list({ prefix: [] })) {
        try {
            const [token, type] = key;

            if (type !== ROOM_NAME_KEY) {
                const { value: roomName } = await kv.get([
                    token,
                    ROOM_NAME_KEY,
                ]);

                if (!roomName) {
                    await kv.delete(key);
                }
            }
        } catch {
            // pass
        }
    }
};

const evictUser = async (kv, roomToken, firstUserToken, userId) => {
    const {
        value: {
            token: actualFirstUserToken,
        },
    } = await kv.get([roomToken, FIRST_USER_KEY]);

    if (actualFirstUserToken !== firstUserToken) {
        return false;
    }

    const userTokenToIdRes = await kv.get([roomToken, USER_TOKEN_TO_ID_KEY]);
    const { value: userTokenToIdMapping } = userTokenToIdRes;
    const removingToken = Object.entries(userTokenToIdMapping).find((entry) => (
        entry[1] === userId
    ))?.[0];

    if (!removingToken || firstUserToken === removingToken) {
        return false;
    }

    const [userNameRes, roomVoteRes] = await kv.getMany([
        [roomToken, USER_NAME_KEY],
        [roomToken, ROOM_VOTE_KEY],
    ]);

    let transaction;
    let count;

    do {
        const {
            vote: {
                [removingToken]: ___,
                ...newVotes
            },
            shown,
        } = roomVoteRes.value;
        const {
            [removingToken]: __,
            ...newUserNames
        } = userNameRes.value;
        const {
            [removingToken]: _,
            ...newUserTokenToIdMapping
        } = userTokenToIdMapping;

        count++;
        transaction = await kv.atomic()
            .check(userNameRes)
            .check(roomVoteRes)
            .set([roomToken, USER_NAME_KEY], newUserNames)
            .set([roomToken, ROOM_VOTE_KEY], { vote: newVotes, shown })
            .set([roomToken, USER_TOKEN_TO_ID_KEY], newUserTokenToIdMapping)
            .commit();
    } while (!transaction.ok && count <= MAX_TRY);

    return transaction.ok;
};

const pushItem = async (kv, key, item) => {
    const res = await kv.get([key]);
    let transaction;

    do {
        const { value } = res;

        transaction = await kv.atomic()
            .check(res)
            .set([key], value ? [...value, item] : [item])
            .commit();
    } while (!transaction.ok && count <= MAX_TRY);

    return transaction.ok;
};

const getLatest = async function* (kv, key) {
    for await (const _change of kv.watch([[key]])) {
        const { value } = await kv.get([key]);

        yield value?.at(-1) ?? null;
    }
};

export {
    clear,
    createRoom,
    createUser,
    evictUser,
    flip,
    gc,
    getLatest,
    getRoomInfo,
    getUserMapping,
    pushItem,
    vote,
    watch,
};
