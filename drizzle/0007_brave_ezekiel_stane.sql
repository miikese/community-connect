CREATE TABLE `saved_creations` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`template` text,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`owner`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `saved_creations_owner` ON `saved_creations` (`owner`);--> statement-breakpoint
CREATE UNIQUE INDEX `saved_creations_template` ON `saved_creations` (`owner`,`template`);