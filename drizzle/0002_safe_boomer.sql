CREATE TABLE "registration_windows" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"class_id" text NOT NULL,
	"code" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"opens_at" timestamp with time zone NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	CONSTRAINT "registration_windows_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "registration_windows" ADD CONSTRAINT "registration_windows_class_id_classrooms_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classrooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "registration_owner_idx" ON "registration_windows" USING btree ("owner_id");