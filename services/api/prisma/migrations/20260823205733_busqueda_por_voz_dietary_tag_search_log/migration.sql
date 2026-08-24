-- CreateEnum
CREATE TYPE "search_channel" AS ENUM ('TEXT', 'VOICE');

-- CreateEnum
CREATE TYPE "search_intent" AS ENUM ('SEARCH', 'ADD');

-- CreateEnum
CREATE TYPE "search_outcome" AS ENUM ('RESULTS', 'CLARIFICATION', 'NO_RESULTS', 'RESOLVED', 'NOT_FOUND', 'ERROR');

-- CreateTable
CREATE TABLE "dietary_tag" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "dietary_tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_log" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "channel" "search_channel" NOT NULL,
    "intent" "search_intent" NOT NULL,
    "outcome" "search_outcome" NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "tokens_used" INTEGER,
    "model" TEXT NOT NULL,
    "error_code" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_productDietaryTags" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_productDietaryTags_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "dietary_tag_name_key" ON "dietary_tag"("name");

-- CreateIndex
CREATE INDEX "search_log_session_id_created_at_idx" ON "search_log"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "_productDietaryTags_B_index" ON "_productDietaryTags"("B");

-- AddForeignKey
ALTER TABLE "search_log" ADD CONSTRAINT "search_log_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_productDietaryTags" ADD CONSTRAINT "_productDietaryTags_A_fkey" FOREIGN KEY ("A") REFERENCES "dietary_tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_productDietaryTags" ADD CONSTRAINT "_productDietaryTags_B_fkey" FOREIGN KEY ("B") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
