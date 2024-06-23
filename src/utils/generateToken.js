function generateToken(size = 64) {
    const arr = crypto.getRandomValues(new Unit8Array(size));
    const blob = new Blob([arr]);
    const fileReader = new FileReader();

    return new Promise((res) => {
        fileReader.onload = (event) => {
            const url = event.target.result;
            const index = url.indexOf(",");

            res(url.substring(index + 1));
        };
        fileReader.readAsDataURL(blob);
    });
}

export default generateToken;
