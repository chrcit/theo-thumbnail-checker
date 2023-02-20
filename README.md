# Theo Thumbnail Checker
Based on this tweet: https://twitter.com/t3dotgg/status/1627051713810300928

`/api/check-thumbnails` fetches the RSS feed of a specific Youtube Channel and fetches the thumbnails.
The script then hashes each thumbnail and then checks it against a previous hash in Redis.

If the hash is different it gets updated in Redis and a message is sent to a Discord webhook.

## Config
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `DISCORD_WEBHOOK_URL` = Discord channel to post to

## Uses
- Redis via Upstash
- Discord Webhook
- Youtube Channel RSS Feed
- `rss-parser` for parsing the RSS feed
- `zod` for validation of the RSS feed

## Todos
- [ ] Upload thumbnail to some image storage and get back fresh URL to post to Discord (else Discord/Youtube use the previous cached thumbnail)
- [ ] Post initial thumbnails as well?
