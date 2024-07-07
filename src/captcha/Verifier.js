const url = "https://api.hcaptcha.com/siteverify";
const headers = {
    "Content-Type": "application/x-www-form-urlencoded",
};

class Verifier {
    async verify(responseToken) {
        const secret = Deno.env.get("HCAPTCHA_SECRET_KEY") ??
            "0x0000000000000000000000000000000000000000";
        const payload = `response=${responseToken}&secret=${secret}`;
        const res = await fetch(url, {
            method: "POST",
            body: payload,
            headers,
        });
        const { ok } = res;

        if (!ok) {
            throw new Error("hCaptcha call failed");
        }

        const { success } = await res.json();

        return success;
    }
}

export default Verifier;
