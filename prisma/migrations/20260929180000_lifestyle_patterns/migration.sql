-- AlterTable
ALTER TABLE "DailyHealthData" ADD COLUMN "hourlySteps" JSONB;
ALTER TABLE "DailyHealthData" ADD COLUMN "dayContext" JSONB;

-- AlterTable
ALTER TABLE "WellnessFeedback" ADD COLUMN "context" JSONB;

-- CreateTable
CREATE TABLE "WellnessLifestyleProfile" (
    "id" TEXT NOT NULL,
    "wellnessUserId" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "observationDays" INTEGER NOT NULL,
    "patternsData" JSONB NOT NULL,
    "lifestyleSummary" JSONB NOT NULL,
    "wellnessJourney" JSONB NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL,
    "profileVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "WellnessLifestyleProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WellnessLifestyleProfile_wellnessUserId_key" ON "WellnessLifestyleProfile"("wellnessUserId");

-- AddForeignKey
ALTER TABLE "WellnessLifestyleProfile" ADD CONSTRAINT "WellnessLifestyleProfile_wellnessUserId_fkey" FOREIGN KEY ("wellnessUserId") REFERENCES "WellnessUser"("wellnessUserId") ON DELETE RESTRICT ON UPDATE CASCADE;
