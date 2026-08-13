DROP INDEX "idx_txn_shop_date";--> statement-breakpoint
DROP INDEX "idx_txn_shop_created";--> statement-breakpoint
DROP INDEX "idx_transfers_shop_date";--> statement-breakpoint
CREATE INDEX "idx_txn_shop_date" ON "transactions" USING btree ("shop_id","is_deleted","txn_date" desc);--> statement-breakpoint
CREATE INDEX "idx_txn_shop_created" ON "transactions" USING btree ("shop_id","is_deleted","created_at" desc);--> statement-breakpoint
CREATE INDEX "idx_transfers_shop_date" ON "transfers" USING btree ("shop_id","is_deleted","txn_date" desc);