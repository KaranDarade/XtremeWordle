-- CreateEnum
CREATE TYPE "League" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND');

-- CreateEnum
CREATE TYPE "ArenaMode" AS ENUM ('DUEL', 'TRIO');

-- CreateEnum
CREATE TYPE "ArenaMatchStatus" AS ENUM ('PLAYING', 'FINISHED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "ArenaQueueStatus" AS ENUM ('WAITING', 'MATCHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MatchResult" AS ENUM ('WIN', 'LOSS', 'DRAW');

-- CreateEnum
CREATE TYPE "PresenceStatus" AS ENUM ('BROWSING', 'IN_MATCH');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarConfig" JSONB,
ADD COLUMN     "bestStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "currentStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "draws" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "googleId" TEXT,
ADD COLUMN     "league" "League" NOT NULL DEFAULT 'BRONZE',
ADD COLUMN     "losses" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "matchesPlayed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "passwordUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "rankPoints" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "username" TEXT,
ADD COLUMN     "wins" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- Backfill a username for accounts that already existed before the arena launch.
UPDATE "User"
SET "username" = 'player-' || substr(md5("id"), 1, 10)
WHERE "username" IS NULL;

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;

-- CreateTable
CREATE TABLE "ArenaMatch" (
    "id" TEXT NOT NULL,
    "mode" "ArenaMode" NOT NULL DEFAULT 'DUEL',
    "status" "ArenaMatchStatus" NOT NULL DEFAULT 'PLAYING',
    "gameId" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "roundCount" INTEGER NOT NULL DEFAULT 6,
    "roundMs" INTEGER NOT NULL DEFAULT 12000,
    "breakMs" INTEGER NOT NULL DEFAULT 5000,
    "countdownMs" INTEGER NOT NULL DEFAULT 3000,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "winnerPlayerId" TEXT,
    "isDraw" BOOLEAN NOT NULL DEFAULT false,
    "isCasual" BOOLEAN NOT NULL DEFAULT false,
    "endReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "rematchOfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArenaMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArenaPlayer" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "userId" TEXT,
    "guestId" TEXT,
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "displayName" TEXT NOT NULL,
    "username" TEXT,
    "avatarSeed" TEXT,
    "league" "League" NOT NULL DEFAULT 'BRONZE',
    "pointsBefore" INTEGER NOT NULL DEFAULT 0,
    "pointsAfter" INTEGER NOT NULL DEFAULT 0,
    "pointsDelta" INTEGER NOT NULL DEFAULT 0,
    "result" "MatchResult",
    "solvedRound" INTEGER,
    "solvedAt" TIMESTAMP(3),
    "bestGreens" INTEGER NOT NULL DEFAULT 0,
    "bestYellows" INTEGER NOT NULL DEFAULT 0,
    "bestAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArenaPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArenaGuess" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "guess" TEXT NOT NULL,
    "feedback" JSONB NOT NULL DEFAULT '[]',
    "correct" BOOLEAN NOT NULL DEFAULT false,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArenaGuess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArenaReaction" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArenaReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArenaQueue" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "guestId" TEXT,
    "displayName" TEXT NOT NULL,
    "username" TEXT,
    "avatarSeed" TEXT,
    "league" "League" NOT NULL DEFAULT 'BRONZE',
    "status" "ArenaQueueStatus" NOT NULL DEFAULT 'WAITING',
    "matchId" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArenaQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetOtp" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "requestIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetOtp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Presence" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "userId" TEXT,
    "guestId" TEXT,
    "status" "PresenceStatus" NOT NULL DEFAULT 'BROWSING',
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Presence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArenaMatch_status_startedAt_idx" ON "ArenaMatch"("status", "startedAt");

-- CreateIndex
CREATE INDEX "ArenaMatch_createdAt_idx" ON "ArenaMatch"("createdAt");

-- CreateIndex
CREATE INDEX "ArenaPlayer_matchId_idx" ON "ArenaPlayer"("matchId");

-- CreateIndex
CREATE INDEX "ArenaPlayer_userId_idx" ON "ArenaPlayer"("userId");

-- CreateIndex
CREATE INDEX "ArenaPlayer_guestId_idx" ON "ArenaPlayer"("guestId");

-- CreateIndex
CREATE UNIQUE INDEX "ArenaPlayer_matchId_slot_key" ON "ArenaPlayer"("matchId", "slot");

-- CreateIndex
CREATE INDEX "ArenaGuess_matchId_round_idx" ON "ArenaGuess"("matchId", "round");

-- CreateIndex
CREATE UNIQUE INDEX "ArenaGuess_playerId_round_key" ON "ArenaGuess"("playerId", "round");

-- CreateIndex
CREATE INDEX "ArenaReaction_matchId_createdAt_idx" ON "ArenaReaction"("matchId", "createdAt");

-- CreateIndex
CREATE INDEX "ArenaQueue_status_joinedAt_idx" ON "ArenaQueue"("status", "joinedAt");

-- CreateIndex
CREATE INDEX "ArenaQueue_userId_idx" ON "ArenaQueue"("userId");

-- CreateIndex
CREATE INDEX "ArenaQueue_guestId_idx" ON "ArenaQueue"("guestId");

-- CreateIndex
CREATE INDEX "PasswordResetOtp_email_createdAt_idx" ON "PasswordResetOtp"("email", "createdAt");

-- CreateIndex
CREATE INDEX "PasswordResetOtp_expiresAt_idx" ON "PasswordResetOtp"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Presence_key_key" ON "Presence"("key");

-- CreateIndex
CREATE INDEX "Presence_lastSeenAt_idx" ON "Presence"("lastSeenAt");

-- CreateIndex
CREATE INDEX "Presence_status_idx" ON "Presence"("status");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE INDEX "User_rankPoints_idx" ON "User"("rankPoints");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- AddForeignKey
ALTER TABLE "ArenaMatch" ADD CONSTRAINT "ArenaMatch_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaPlayer" ADD CONSTRAINT "ArenaPlayer_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "ArenaMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaPlayer" ADD CONSTRAINT "ArenaPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaPlayer" ADD CONSTRAINT "ArenaPlayer_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "GuestSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaGuess" ADD CONSTRAINT "ArenaGuess_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "ArenaMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaGuess" ADD CONSTRAINT "ArenaGuess_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "ArenaPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaReaction" ADD CONSTRAINT "ArenaReaction_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "ArenaMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaQueue" ADD CONSTRAINT "ArenaQueue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaQueue" ADD CONSTRAINT "ArenaQueue_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "GuestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presence" ADD CONSTRAINT "Presence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presence" ADD CONSTRAINT "Presence_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "GuestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
