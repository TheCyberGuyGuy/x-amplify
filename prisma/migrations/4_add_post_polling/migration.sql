-- Step 1 of push notifications: discovered-post storage + poll audit log.

-- Per-handle push opt-in (admin-toggled; off by default to prevent fatigue)
ALTER TABLE "PoolHandle" ADD COLUMN "pushEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Posts discovered by the cron poll (tweetId unique = dedupe anchor)
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "tweetId" TEXT NOT NULL,
    "poolHandleId" TEXT NOT NULL,
    "text" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Post_tweetId_key" ON "Post"("tweetId");

-- CreateIndex
CREATE INDEX "Post_poolHandleId_postedAt_idx" ON "Post"("poolHandleId", "postedAt");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_poolHandleId_fkey" FOREIGN KEY ("poolHandleId") REFERENCES "PoolHandle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Poll audit log (powers the monthly read-budget kill switch)
CREATE TABLE "PollRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "postsRead" INTEGER NOT NULL DEFAULT 0,
    "newPosts" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "error" TEXT,

    CONSTRAINT "PollRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PollRun_startedAt_idx" ON "PollRun"("startedAt");
