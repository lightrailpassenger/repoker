function createJSONResponse(body, status = 200, headers = {}) {
    const stringifiedBody = JSON.stringify(body);

    return new Response(
        stringifiedBody,
        {
            status,
            headers: {
                ...headers,
                "Content-Type": "application/json",
            },
        },
    );
}

export { createJSONResponse };
