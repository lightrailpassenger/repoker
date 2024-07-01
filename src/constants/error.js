const errorCode = {
    NAME_ALREADY_USED: {
        value: 1001,
        status: 409,
        message: "Name already used.",
    },
    ROOM_EXPIRED: {
        value: 1002,
        status: 404,
        message: "Room expired",
    },
};

export { errorCode };
