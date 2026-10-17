CREATE TABLE "attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"task_id" text NOT NULL,
	"student_id" text NOT NULL,
	"answers" text NOT NULL,
	"correct" integer NOT NULL,
	"total" integer NOT NULL,
	"completed_at" text NOT NULL,
	"practice" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classrooms" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"major" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"task_id" text NOT NULL,
	"student_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"ratings" text DEFAULT '{}' NOT NULL,
	"active_seconds" integer DEFAULT 0 NOT NULL,
	"started_at" text,
	"last_seen_at" text,
	"first_completed_at" text
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"class_id" text NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"number" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"book_id" text NOT NULL,
	"class_id" text NOT NULL,
	"start_at" text NOT NULL,
	"deadline" text NOT NULL,
	"status" text NOT NULL,
	"word_snapshot" text NOT NULL,
	"rules_snapshot" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wordbooks" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"color" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "words" (
	"id" text PRIMARY KEY NOT NULL,
	"book_id" text NOT NULL,
	"english" text NOT NULL,
	"phonetic" text NOT NULL,
	"pos" text NOT NULL,
	"meaning" text NOT NULL,
	"example" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning" ADD CONSTRAINT "learning_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning" ADD CONSTRAINT "learning_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_class_id_classrooms_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classrooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_book_id_wordbooks_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."wordbooks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_class_id_classrooms_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classrooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "words" ADD CONSTRAINT "words_book_id_wordbooks_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."wordbooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attempts_owner_idx" ON "attempts" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "classrooms_owner_idx" ON "classrooms" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "learning_student_task_unique" ON "learning" USING btree ("task_id","student_id");--> statement-breakpoint
CREATE INDEX "learning_owner_idx" ON "learning" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "students_class_number_unique" ON "students" USING btree ("class_id","number");--> statement-breakpoint
CREATE INDEX "students_owner_idx" ON "students" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "tasks_owner_idx" ON "tasks" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "wordbooks_owner_idx" ON "wordbooks" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "words_book_idx" ON "words" USING btree ("book_id");