# repoker

## Run

```bash
deno --unstable-kv --unstable-cron run --allow-env --allow-net --allow-read src/main.js
```

## Environment variables

| Name                  | Meaning                     |
| --------------------- | --------------------------- |
| `HCAPTCHA_SITE_KEY`   | hCaptcha site key           |
| `HCAPTCHA_SECRET_KEY` | hCaptcha secret key         |
| `PORT`                | Server port, default `8000` |
