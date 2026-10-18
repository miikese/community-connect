CREATE TABLE `friendships` (
	`id` text PRIMARY KEY NOT NULL,
	`member_a` text NOT NULL,
	`member_b` text NOT NULL,
	`requester` text NOT NULL,
	`status` text NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL,
	FOREIGN KEY (`member_a`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_b`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `friendships_a` ON `friendships` (`member_a`);--> statement-breakpoint
CREATE INDEX `friendships_b` ON `friendships` (`member_b`);--> statement-breakpoint
CREATE TABLE `social_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`blocker` text NOT NULL,
	`target` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`blocker`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `social_calls` (
	`id` text PRIMARY KEY NOT NULL,
	`caller` text NOT NULL,
	`callee` text NOT NULL,
	`mode` text NOT NULL,
	`status` text NOT NULL,
	`offer` text DEFAULT '' NOT NULL,
	`answer` text DEFAULT '' NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`caller`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`callee`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `social_calls_caller` ON `social_calls` (`caller`,`status`);--> statement-breakpoint
CREATE INDEX `social_calls_callee` ON `social_calls` (`callee`,`status`);--> statement-breakpoint
CREATE TABLE `social_messages` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`sender` text NOT NULL,
	`recipient` text NOT NULL,
	`body` text NOT NULL,
	`created` text NOT NULL,
	`read_at` text,
	FOREIGN KEY (`sender`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipient`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `social_message_nonce` ON `social_messages` (`sender`,`id`);--> statement-breakpoint
CREATE INDEX `social_messages_pair` ON `social_messages` (`sender`,`recipient`,`seq`);--> statement-breakpoint
CREATE TABLE `social_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`handle` text NOT NULL,
	`name` text NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`area` text DEFAULT '' NOT NULL,
	`color` text DEFAULT 'teal' NOT NULL,
	`discoverable` integer DEFAULT 0 NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `social_handle` ON `social_profiles` (`handle`);