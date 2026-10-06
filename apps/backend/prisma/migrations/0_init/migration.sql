-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'DOING', 'DONE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "EventSource" AS ENUM ('MANUAL', 'AI_APPLIED', 'IMPORTED');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'SENT', 'DISMISSED');

-- CreateEnum
CREATE TYPE "AiMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "SuggestionType" AS ENUM ('CREATE_TASK', 'UPDATE_TASK', 'CREATE_EVENT', 'CREATE_REMINDER', 'DAILY_PLAN');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'APPLIED');

-- CreateEnum
CREATE TYPE "TargetType" AS ENUM ('TASK', 'CALENDAR_EVENT', 'REMINDER');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('MICROSOFT_TODO');

-- CreateEnum
CREATE TYPE "RoutineIntervalUnit" AS ENUM ('HOURS', 'DAYS', 'WEEKS', 'MONTHS');

-- CreateEnum
CREATE TYPE "RoutineCheckInStatus" AS ENUM ('COMPLETED', 'SKIPPED', 'MISSED', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "SleepLogSource" AS ENUM ('MANUAL', 'IMPORTED');

-- CreateEnum
CREATE TYPE "MediaWorkType" AS ENUM ('BOOK', 'MOVIE', 'SERIES', 'ANIME', 'GAME', 'OTHER');

-- CreateEnum
CREATE TYPE "MediaReviewStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'DROPPED');

-- CreateEnum
CREATE TYPE "MediaRatingProvider" AS ENUM ('DOUBAN', 'ROTTEN_TOMATOES', 'IMDB', 'METACRITIC', 'OTHER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "due_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "source" "EventSource" NOT NULL DEFAULT 'MANUAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "task_id" TEXT,
    "event_id" TEXT,
    "title" TEXT NOT NULL,
    "remind_at" TIMESTAMP(3) NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_scores" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "score" INTEGER NOT NULL,
    "mood_score" INTEGER,
    "productivity_score" INTEGER,
    "health_score" INTEGER,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" "AiMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_suggestions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "conversation_id" TEXT,
    "type" "SuggestionType" NOT NULL,
    "title" TEXT NOT NULL,
    "explanation" TEXT,
    "payload_json" JSONB NOT NULL,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applied_at" TIMESTAMP(3),

    CONSTRAINT "ai_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suggestion_applications" (
    "id" TEXT NOT NULL,
    "suggestion_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "target_type" "TargetType" NOT NULL,
    "target_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suggestion_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "scope" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_integrations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "external_task_id" TEXT NOT NULL,
    "external_list_id" TEXT NOT NULL,
    "external_etag" TEXT,
    "raw_json" JSONB,
    "last_synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routine_habits" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT '生活',
    "interval_value" INTEGER NOT NULL,
    "interval_unit" "RoutineIntervalUnit" NOT NULL,
    "next_due_at" TIMESTAMP(3) NOT NULL,
    "is_rolling" BOOLEAN NOT NULL DEFAULT false,
    "reminder_enabled" BOOLEAN NOT NULL DEFAULT true,
    "add_to_today" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_reminded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "depends_on_id" TEXT,
    "delay_value" INTEGER,
    "delay_unit" "RoutineIntervalUnit",
    "depends_on_fixed_time" TEXT,

    CONSTRAINT "routine_habits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routine_check_ins" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "habit_id" TEXT NOT NULL,
    "performed_at" TIMESTAMP(3) NOT NULL,
    "due_at" TIMESTAMP(3),
    "status" "RoutineCheckInStatus" NOT NULL DEFAULT 'COMPLETED',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "routine_check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sleep_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "went_to_bed_at" TIMESTAMP(3) NOT NULL,
    "fell_asleep_at" TIMESTAMP(3),
    "woke_up_at" TIMESTAMP(3) NOT NULL,
    "quality" INTEGER,
    "note" TEXT,
    "source" "SleepLogSource" NOT NULL DEFAULT 'MANUAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sleep_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "electricity_readings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL,
    "remaining_kwh" DOUBLE PRECISION NOT NULL,
    "did_recharge" BOOLEAN NOT NULL DEFAULT false,
    "recharge_kwh" DOUBLE PRECISION,
    "recharge_amount_yuan" DOUBLE PRECISION,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "electricity_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_works" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "original_title" TEXT,
    "work_type" "MediaWorkType" NOT NULL,
    "release_date" DATE,
    "creator" TEXT,
    "cover_url" TEXT,
    "description" TEXT,
    "language" TEXT,
    "country" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_works_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_reviews" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "work_id" TEXT NOT NULL,
    "status" "MediaReviewStatus" NOT NULL DEFAULT 'COMPLETED',
    "personal_score" INTEGER NOT NULL,
    "completed_at" DATE,
    "reviewed_at" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_external_ratings" (
    "id" TEXT NOT NULL,
    "work_id" TEXT NOT NULL,
    "provider" "MediaRatingProvider" NOT NULL,
    "rating_value" DOUBLE PRECISION NOT NULL,
    "rating_scale" INTEGER NOT NULL DEFAULT 10,
    "rating_count" INTEGER,
    "source_url" TEXT,
    "fetched_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_external_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "daily_scores_user_id_date_key" ON "daily_scores"("user_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "integration_accounts_user_id_provider_key" ON "integration_accounts"("user_id", "provider");

-- CreateIndex
CREATE INDEX "task_integrations_user_id_provider_idx" ON "task_integrations"("user_id", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "task_integrations_provider_external_task_id_key" ON "task_integrations"("provider", "external_task_id");

-- CreateIndex
CREATE INDEX "routine_habits_user_id_is_active_next_due_at_idx" ON "routine_habits"("user_id", "is_active", "next_due_at");

-- CreateIndex
CREATE INDEX "routine_check_ins_user_id_performed_at_idx" ON "routine_check_ins"("user_id", "performed_at");

-- CreateIndex
CREATE INDEX "routine_check_ins_habit_id_performed_at_idx" ON "routine_check_ins"("habit_id", "performed_at");

-- CreateIndex
CREATE INDEX "sleep_logs_user_id_woke_up_at_idx" ON "sleep_logs"("user_id", "woke_up_at");

-- CreateIndex
CREATE INDEX "electricity_readings_user_id_recorded_at_idx" ON "electricity_readings"("user_id", "recorded_at");

-- CreateIndex
CREATE INDEX "media_works_user_id_work_type_created_at_idx" ON "media_works"("user_id", "work_type", "created_at");

-- CreateIndex
CREATE INDEX "media_reviews_user_id_reviewed_at_idx" ON "media_reviews"("user_id", "reviewed_at");

-- CreateIndex
CREATE UNIQUE INDEX "media_reviews_user_id_work_id_key" ON "media_reviews"("user_id", "work_id");

-- CreateIndex
CREATE INDEX "media_external_ratings_work_id_provider_idx" ON "media_external_ratings"("work_id", "provider");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "calendar_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_scores" ADD CONSTRAINT "daily_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestion_applications" ADD CONSTRAINT "suggestion_applications_suggestion_id_fkey" FOREIGN KEY ("suggestion_id") REFERENCES "ai_suggestions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_accounts" ADD CONSTRAINT "integration_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_integrations" ADD CONSTRAINT "task_integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_integrations" ADD CONSTRAINT "task_integrations_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_habits" ADD CONSTRAINT "routine_habits_depends_on_id_fkey" FOREIGN KEY ("depends_on_id") REFERENCES "routine_habits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_habits" ADD CONSTRAINT "routine_habits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_check_ins" ADD CONSTRAINT "routine_check_ins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_check_ins" ADD CONSTRAINT "routine_check_ins_habit_id_fkey" FOREIGN KEY ("habit_id") REFERENCES "routine_habits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sleep_logs" ADD CONSTRAINT "sleep_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "electricity_readings" ADD CONSTRAINT "electricity_readings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_works" ADD CONSTRAINT "media_works_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_reviews" ADD CONSTRAINT "media_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_reviews" ADD CONSTRAINT "media_reviews_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "media_works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_external_ratings" ADD CONSTRAINT "media_external_ratings_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "media_works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

