import type { VercelRequest, VercelResponse } from "@vercel/node";
import Parser from "rss-parser";
import { z } from "zod";
import { Redis } from "@upstash/redis";
import { createHash } from "crypto";

const YT_CHANNEL_ID = "UCbRP3c757lWg9M-U7TyEkXA"; // https://www.youtube.com/@t3dotgg
// const YT_CHANNEL_ID = "UCkXG-z8ONIUGToBEwFEKE2w"; // https://www.youtube.com/@chrcit
const MAX_DATE = new Date();
MAX_DATE.setDate(MAX_DATE.getDate() - 7);

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const ChannelRSSResponseValidator = z.object({
  items: z.array(
    z.object({
      mediaContent: z.object({
        "media:title": z.array(z.string()),
        "media:content": z.array(
          z.object({
            $: z.object({
              url: z.string(),
              type: z.string(),
              width: z.string(),
              height: z.string(),
            }),
          })
        ),
        "media:thumbnail": z.array(
          z.object({
            $: z.object({
              url: z.string(),
              width: z.string(),
              height: z.string(),
            }),
          })
        ),
        "media:description": z.array(z.string()),
        "media:community": z.array(
          z.object({
            "media:starRating": z.array(
              z.object({
                $: z.object({
                  count: z.string(),
                  average: z.string(),
                  min: z.string(),
                  max: z.string(),
                }),
              })
            ),
            "media:statistics": z.array(
              z.object({ $: z.object({ views: z.string() }) })
            ),
          })
        ),
      }),
      title: z.string(),
      link: z.string(),
      pubDate: z.string(),
      author: z.string(),
      id: z.string(),
      isoDate: z.string(),
    })
  ),
  link: z.string(),
  feedUrl: z.string(),
  title: z.string(),
});

const getYTChannelViaRSS = async (youtubeId: string) => {
  const parser = new Parser({
    customFields: {
      item: [["media:group", "mediaContent"]],
    },
  });
  const rssResponse = await parser.parseURL(
    "https://www.youtube.com/feeds/videos.xml?channel_id=" + youtubeId
  );

  const validated = ChannelRSSResponseValidator.parse(rssResponse);

  return {
    channel: {
      title: validated.title,
    },
    items: validated.items,
  };
};

const fetchAndHashThumbnail = async (thumbnailUrl: string) => {
  const res = await fetch(thumbnailUrl);
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const hash = createHash("sha256");
  hash.update(buffer);
  return hash.digest("hex");
};

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  try {
    const channel = await getYTChannelViaRSS(YT_CHANNEL_ID);

    const filteredItems = channel.items.filter((item) => {
      return new Date(item.pubDate) > MAX_DATE;
    });

    const data: {
      title: string;
      id: string;
      thumbnail: string;
      thumbnailHash: string;
      thumbnailChanged: boolean;
    }[] = [];

    for (const item of filteredItems) {
      const previousHash = await redis.get(item.id);

      const currentHash = await fetchAndHashThumbnail(
        item.mediaContent["media:thumbnail"][0].$.url
      );

      if (previousHash) {
        if (currentHash !== previousHash) {
          await redis.set(item.id, currentHash);

          data.push({
            id: item.id,
            title: item.title,
            thumbnail: item.mediaContent["media:thumbnail"][0].$.url,
            thumbnailHash: currentHash,
            thumbnailChanged: true,
          });

          continue;
        }
      } else {
        await redis.set(item.id, currentHash);
      }

      data.push({
        id: item.id,
        title: item.title,
        thumbnail: item.mediaContent["media:thumbnail"][0].$.url,
        thumbnailHash: currentHash,
        thumbnailChanged: false,
      });
    }

    const videosWithUpdatedThumbnails = data.filter(
      (video) => video.thumbnailChanged
    );
    for (const updatedVideo of videosWithUpdatedThumbnails) {
      await fetch(process.env.DISCORD_WEBHOOK_URL!, {
        method: "POST",
        body: JSON.stringify({
          content: `Thumbnail for "${updatedVideo.title}" updated!`,
          embeds: [
            {
              title: updatedVideo.title,
              url: `https://www.youtube.com/watch?v=${updatedVideo.id}`,
              image: {
                url: updatedVideo.thumbnail,
              },
            },
          ],
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    response.status(200).json({ data });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: error.message });
  }
}
