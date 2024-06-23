import generateToken from "../utils/generateToken.js";

const MAX_TRY = 10;

const CARD_KEY = "card";
const ROOM_VOTE_KEY = "roomVote";
const USER_NAME_KEY = "userNameKey";

const createUser = async (kv, roomToken, username) => {
    const newToken = await generateToken();
    const usernameRes = await kv.get([roomToken, USER_NAME_KEY]);

    let transaction;
    let count = 0;

    do {
        const { value } = usernameRes;
        const newValue = {
            ...value,
            [newToken]: username,
        };

        count++;
        transaction = await kv.atomic()
            .check(usernameRes)
            .set([roomToken, USER_NAME_KEY], newValue)
            .commit();
    } while (transaction.ok && count <= MAX_TRY);

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
    const availableCards = await kv.get([roomToken, CARD_KEY]);

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
        shown: true,
    });
};

const flip = async (kv, roomToken) => {
    let transaction;
    let count = 0;

    do {
        const statusRes = await kv.get([roomToken, ROOM_VOTE_KEY]);
        const { value } = statusRes;
        const newValue = {
            ...status,
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

const watch = (kv, roomToken) => {
    return async function* () {
        for await (const change of kv.watch([[roomToken, ROOM_VOTE_KEY]])) {
            const [{ value }] = change;
            const mapping = await getUserMapping(kv, roomToken);
            const mappedState = Object.create(null);

            for (const key in value) {
                mappedState[mapping[key]] = value;
            }

            yield mappedState;
        }
    };
};

export { clear, createUser, flip, getUserMapping, vote, watch };
