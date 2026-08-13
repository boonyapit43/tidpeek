CREATE TABLE "transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"from_account_id" uuid NOT NULL,
	"to_account_id" uuid NOT NULL,
	"txn_date" date NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"note" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transfers_amount_check" CHECK ("transfers"."amount" > 0),
	CONSTRAINT "transfers_accounts_differ_check" CHECK ("transfers"."from_account_id" <> "transfers"."to_account_id")
);
--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_from_account_id_accounts_id_fk" FOREIGN KEY ("from_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_to_account_id_accounts_id_fk" FOREIGN KEY ("to_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_transfers_shop_date" ON "transfers" USING btree ("shop_id","is_deleted","txn_date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_transfers_from" ON "transfers" USING btree ("from_account_id","is_deleted");--> statement-breakpoint
CREATE INDEX "idx_transfers_to" ON "transfers" USING btree ("to_account_id","is_deleted");