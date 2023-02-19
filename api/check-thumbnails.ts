import Parser from "rss-parser";

const getYTChannelViaRSS = async (youtubeId: string) => {
  const parser = new Parser();
  const rssResponse = await parser.parseURL(
    "https://www.youtube.com/feeds/videos.xml?channel_id=" + youtubeId
  );

  console.log(rssResponse);
  return rssResponse;
};

// const filterVideo;

const YT_CHANNEL_ID = "UCbRP3c757lWg9M-U7TyEkXA"; // https://www.youtube.com/@t3dotgg
const MAX_AGE_IN_SECONDS = 60 * 60 * 24 * 7; // 1 week

export default async (req: Request) => {
  try {
    // const channel = await getYTChannelViaRSS(YT_CHANNEL_ID);

    return new Response(JSON.stringify({}), { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response(error.message, { status: 500 });
  }
};

export const config = {
  runtime: "edge", // this is a pre-requisite
  regions: ["sf1"], // only execute this function on iad1
};
