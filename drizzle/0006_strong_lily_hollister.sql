CREATE TABLE `status_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`media` text,
	`color` text DEFAULT 'forest' NOT NULL,
	`created` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`owner`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`media`) REFERENCES `social_media`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `status_owner_expiry` ON `status_posts` (`owner`,`expires`);--> statement-breakpoint
CREATE UNIQUE INDEX `status_media_once` ON `status_posts` (`media`);--> statement-breakpoint
CREATE TABLE `status_views` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`viewer` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`status`) REFERENCES `status_posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`viewer`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `status_view_once` ON `status_views` (`status`,`viewer`);--> statement-breakpoint
ALTER TABLE `social_media` ADD `filename` text DEFAULT 'attachment' NOT NULL;--> statement-breakpoint
ALTER TABLE `social_media` ADD `scope` text DEFAULT 'conversation' NOT NULL;