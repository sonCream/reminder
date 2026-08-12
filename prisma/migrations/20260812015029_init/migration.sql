-- CreateTable
CREATE TABLE "Reminder" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'local',
    "title" TEXT NOT NULL,
    "memo" TEXT,
    "remindAt" TIMESTAMPTZ(3) NOT NULL,
    "repeatRule" TEXT,
    "repeatEndAt" TIMESTAMPTZ(3),
    "leadMinutes" INTEGER,
    "snoozeMinutes" INTEGER NOT NULL DEFAULT 15,
    "autoComplete" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "reminderId" INTEGER NOT NULL,
    "occurrenceAt" TIMESTAMPTZ(3) NOT NULL,
    "kind" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "scheduledAt" TIMESTAMPTZ(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMPTZ(3),
    "error" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'local',
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reminder_userId_remindAt_idx" ON "Reminder"("userId", "remindAt");

-- CreateIndex
CREATE INDEX "Reminder_userId_doneAt_idx" ON "Reminder"("userId", "doneAt");

-- CreateIndex
CREATE INDEX "Notification_status_scheduledAt_idx" ON "Notification"("status", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_reminderId_occurrenceAt_kind_channel_key" ON "Notification"("reminderId", "occurrenceAt", "kind", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "Reminder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
