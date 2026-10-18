CREATE TABLE "study_events" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"event_key" text NOT NULL,
	"task_id" text,
	"day" text NOT NULL,
	"kind" text NOT NULL,
	"terms" text DEFAULT '[]' NOT NULL,
	"active_seconds" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study_profiles" (
	"student_id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"baseline" text NOT NULL,
	"started_at" text NOT NULL,
	"last_activity_at" text
);
--> statement-breakpoint
ALTER TABLE "study_events" ADD CONSTRAINT "study_events_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_profiles" ADD CONSTRAINT "study_profiles_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "study_event_student_key" ON "study_events" USING btree ("student_id","event_key");--> statement-breakpoint
CREATE INDEX "study_student_day_idx" ON "study_events" USING btree ("student_id","day");