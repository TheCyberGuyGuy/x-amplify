-- Re-engagement "new people joined" digest: per-user watermark of the last
-- time we notified them about new pool members.
ALTER TABLE "User" ADD COLUMN "joinDigestAt" TIMESTAMP(3);
