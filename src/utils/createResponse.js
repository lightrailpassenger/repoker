function createJSONResponse(body, status = 200, headers = new Headers()) {
    const stringifiedBody = JSON.stringify(body);

    headers.append("Content-Type", "application/json");

    return new Response(
        stringifiedBody,
        {
            status,
            headers,
        },
    );
}

export { createJSONResponse };
