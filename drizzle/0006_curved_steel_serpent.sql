DROP INDEX "students_class_number_unique";--> statement-breakpoint
CREATE INDEX "students_name_login_idx" ON "students" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "students_class_number_unique" ON "students" USING btree ("class_id","number") WHERE "students"."number" <> '';