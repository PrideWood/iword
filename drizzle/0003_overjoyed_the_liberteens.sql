CREATE TABLE "billing_settings" (
	"id" text PRIMARY KEY DEFAULT 'root' NOT NULL,
	"enforced" boolean DEFAULT false NOT NULL,
	"points_per_character" integer DEFAULT 1 NOT NULL,
	"tts_cents_per_million" integer DEFAULT 0 NOT NULL,
	"cos_cents_per_gb" integer DEFAULT 0 NOT NULL,
	"cos_cents_per_10k_requests" integer DEFAULT 0 NOT NULL,
	"cos_storage_cents_per_gb_month" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "one_billing_settings" CHECK ("billing_settings"."id" = 'root')
);
--> statement-breakpoint
CREATE TABLE "credit_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"kind" text NOT NULL,
	"delta" bigint NOT NULL,
	"balance_after" bigint NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_admin" (
	"id" text PRIMARY KEY DEFAULT 'root' NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "platform_admin_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "one_platform_admin" CHECK ("platform_admin"."id" = 'root')
);
--> statement-breakpoint
CREATE TABLE "redemption_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"code_hash" text NOT NULL,
	"suffix" text NOT NULL,
	"points" bigint NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked" boolean DEFAULT false NOT NULL,
	"redeemed_by" text,
	"redeemed_workspace" text,
	"redeemed_at" timestamp with time zone,
	CONSTRAINT "redemption_codes_code_hash_unique" UNIQUE("code_hash")
);
--> statement-breakpoint
CREATE TABLE "usage_events" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"kind" text NOT NULL,
	"term" text DEFAULT '' NOT NULL,
	"characters" integer DEFAULT 0 NOT NULL,
	"tts_requests" integer DEFAULT 0 NOT NULL,
	"cos_requests" integer DEFAULT 0 NOT NULL,
	"uploaded_bytes" bigint DEFAULT 0 NOT NULL,
	"download_bytes" bigint DEFAULT 0 NOT NULL,
	"outcome" text DEFAULT 'success' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"workspace_id" text PRIMARY KEY NOT NULL,
	"balance" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "wallet_nonnegative" CHECK ("wallets"."balance" >= 0)
);
--> statement-breakpoint
ALTER TABLE "pronunciation_assets" ADD COLUMN "byte_size" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "disabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_admin" ADD CONSTRAINT "platform_admin_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ledger_workspace_idx" ON "credit_ledger" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "usage_workspace_time_idx" ON "usage_events" USING btree ("workspace_id","created_at");
--> statement-breakpoint
INSERT INTO "platform_admin" ("id","user_id") SELECT 'root',"id" FROM "users" WHERE "username"='teacher' AND "role"='teacher' ON CONFLICT DO NOTHING;
