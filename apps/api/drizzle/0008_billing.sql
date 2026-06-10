ALTER TABLE `user` ADD `plan` text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `paid_customer_id` text;
