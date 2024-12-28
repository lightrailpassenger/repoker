# repoker

## Run

```bash
deno task main

# or
deno run --unstable-kv --unstable-cron --allow-env --allow-net --allow-read src/main.js
```

## Environment variables

| Name                  | Meaning                     |
| --------------------- | --------------------------- |
| `HCAPTCHA_SITE_KEY`   | hCaptcha site key           |
| `HCAPTCHA_SECRET_KEY` | hCaptcha secret key         |
| `PORT`                | Server port, default `8000` |
