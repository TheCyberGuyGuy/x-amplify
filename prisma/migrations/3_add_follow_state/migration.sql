-- Per-viewer follow-state snapshots (powers the network leaderboard)
CREATE TABLE "FollowState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "poolHandleId" TEXT NOT NULL,
    "following" BOOLEAN NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FollowState_userId_poolHandleId_key" ON "FollowState"("userId", "poolHandleId");

-- AddForeignKey
ALTER TABLE "FollowState" ADD CONSTRAINT "FollowState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowState" ADD CONSTRAINT "FollowState_poolHandleId_fkey" FOREIGN KEY ("poolHandleId") REFERENCES "PoolHandle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
