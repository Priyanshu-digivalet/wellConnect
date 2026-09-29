-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "WellnessUser" (
    "id" TEXT NOT NULL,
    "wellnessUserId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "appVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WellnessUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyHealthData" (
    "id" TEXT NOT NULL,
    "wellnessUserId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "steps" INTEGER NOT NULL,
    "distanceMeters" INTEGER NOT NULL,
    "activeCalories" INTEGER NOT NULL,
    "restingHeartRate" INTEGER,
    "averageHeartRate" INTEGER,
    "sleepMinutes" INTEGER,
    "dataAvailability" JSONB NOT NULL,
    "dataQuality" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyHealthData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WellnessProfile" (
    "id" TEXT NOT NULL,
    "wellnessUserId" TEXT NOT NULL,
    "activityLevel" TEXT NOT NULL,
    "sleepLevel" TEXT NOT NULL,
    "recoveryLevel" TEXT NOT NULL,
    "activityTrend" TEXT NOT NULL,
    "sleepTrend" TEXT NOT NULL,
    "consistencyScore" DOUBLE PRECISION NOT NULL,
    "avgSteps7d" DOUBLE PRECISION NOT NULL,
    "avgSleepMinutes7d" DOUBLE PRECISION NOT NULL,
    "avgRestingHeartRate7d" DOUBLE PRECISION,
    "profileData" JSONB NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL,
    "profileVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "WellnessProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyFeature" (
    "id" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "featureType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "serviceId" TEXT,
    "outletId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "deepLink" TEXT NOT NULL,
    "tags" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "wellnessUserId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "featureId" TEXT,
    "recommendationType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "context" JSONB NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDevice" (
    "id" TEXT NOT NULL,
    "wellnessUserId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "fcmToken" TEXT NOT NULL,
    "appVersion" TEXT NOT NULL,
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "recommendationId" TEXT,
    "wellnessUserId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "deepLink" TEXT,
    "featureId" TEXT,
    "status" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "actionedAt" TIMESTAMP(3),
    "provider" TEXT,
    "providerMessageId" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WellnessFeedback" (
    "id" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "wellnessUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "rating" INTEGER,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WellnessFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreferenceSignal" (
    "id" TEXT NOT NULL,
    "wellnessUserId" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "preferenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "interactionCount" INTEGER NOT NULL DEFAULT 0,
    "positiveCount" INTEGER NOT NULL DEFAULT 0,
    "negativeCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreferenceSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WellnessUser_wellnessUserId_key" ON "WellnessUser"("wellnessUserId");

-- CreateIndex
CREATE INDEX "WellnessUser_propertyId_idx" ON "WellnessUser"("propertyId");

-- CreateIndex
CREATE INDEX "DailyHealthData_wellnessUserId_date_idx" ON "DailyHealthData"("wellnessUserId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyHealthData_wellnessUserId_date_key" ON "DailyHealthData"("wellnessUserId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "WellnessProfile_wellnessUserId_key" ON "WellnessProfile"("wellnessUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Property_propertyId_key" ON "Property"("propertyId");

-- CreateIndex
CREATE INDEX "PropertyFeature_propertyId_enabled_available_idx" ON "PropertyFeature"("propertyId", "enabled", "available");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyFeature_propertyId_featureId_key" ON "PropertyFeature"("propertyId", "featureId");

-- CreateIndex
CREATE UNIQUE INDEX "Recommendation_recommendationId_key" ON "Recommendation"("recommendationId");

-- CreateIndex
CREATE INDEX "Recommendation_wellnessUserId_createdAt_idx" ON "Recommendation"("wellnessUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Recommendation_propertyId_createdAt_idx" ON "Recommendation"("propertyId", "createdAt");

-- CreateIndex
CREATE INDEX "Recommendation_wellnessUserId_status_expiresAt_idx" ON "Recommendation"("wellnessUserId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "NotificationDevice_wellnessUserId_idx" ON "NotificationDevice"("wellnessUserId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDevice_wellnessUserId_deviceId_key" ON "NotificationDevice"("wellnessUserId", "deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_notificationId_key" ON "Notification"("notificationId");

-- CreateIndex
CREATE INDEX "Notification_wellnessUserId_createdAt_idx" ON "Notification"("wellnessUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_status_scheduledAt_idx" ON "Notification"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "Notification_recommendationId_idx" ON "Notification"("recommendationId");

-- CreateIndex
CREATE INDEX "WellnessFeedback_recommendationId_idx" ON "WellnessFeedback"("recommendationId");

-- CreateIndex
CREATE INDEX "WellnessFeedback_wellnessUserId_createdAt_idx" ON "WellnessFeedback"("wellnessUserId", "createdAt");

-- CreateIndex
CREATE INDEX "UserPreferenceSignal_wellnessUserId_idx" ON "UserPreferenceSignal"("wellnessUserId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreferenceSignal_wellnessUserId_featureId_key" ON "UserPreferenceSignal"("wellnessUserId", "featureId");

-- AddForeignKey
ALTER TABLE "WellnessUser" ADD CONSTRAINT "WellnessUser_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("propertyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyHealthData" ADD CONSTRAINT "DailyHealthData_wellnessUserId_fkey" FOREIGN KEY ("wellnessUserId") REFERENCES "WellnessUser"("wellnessUserId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WellnessProfile" ADD CONSTRAINT "WellnessProfile_wellnessUserId_fkey" FOREIGN KEY ("wellnessUserId") REFERENCES "WellnessUser"("wellnessUserId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyFeature" ADD CONSTRAINT "PropertyFeature_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("propertyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_wellnessUserId_fkey" FOREIGN KEY ("wellnessUserId") REFERENCES "WellnessUser"("wellnessUserId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("propertyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDevice" ADD CONSTRAINT "NotificationDevice_wellnessUserId_fkey" FOREIGN KEY ("wellnessUserId") REFERENCES "WellnessUser"("wellnessUserId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "Recommendation"("recommendationId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_wellnessUserId_fkey" FOREIGN KEY ("wellnessUserId") REFERENCES "WellnessUser"("wellnessUserId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WellnessFeedback" ADD CONSTRAINT "WellnessFeedback_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "Recommendation"("recommendationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WellnessFeedback" ADD CONSTRAINT "WellnessFeedback_wellnessUserId_fkey" FOREIGN KEY ("wellnessUserId") REFERENCES "WellnessUser"("wellnessUserId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreferenceSignal" ADD CONSTRAINT "UserPreferenceSignal_wellnessUserId_fkey" FOREIGN KEY ("wellnessUserId") REFERENCES "WellnessUser"("wellnessUserId") ON DELETE RESTRICT ON UPDATE CASCADE;

