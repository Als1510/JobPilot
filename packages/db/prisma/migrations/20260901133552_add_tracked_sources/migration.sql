-- CreateTable
CREATE TABLE "TrackedSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceType" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT,
    "url" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastFetchedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "TrackedSource_sourceType_identifier_key" ON "TrackedSource"("sourceType", "identifier");
