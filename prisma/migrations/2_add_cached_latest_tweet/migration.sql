-- Cache each pool handle's latest original post (shared across viewers, TTL-refreshed)
ALTER TABLE "PoolHandle" ADD COLUMN "latestTweetId" TEXT;
ALTER TABLE "PoolHandle" ADD COLUMN "latestTweetAt" TIMESTAMP(3);
ALTER TABLE "PoolHandle" ADD COLUMN "tweetsCheckedAt" TIMESTAMP(3);
