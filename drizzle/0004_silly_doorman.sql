CREATE TABLE `chat_members` (
	`id` text PRIMARY KEY NOT NULL,
	`thread` text NOT NULL,
	`user_id` text NOT NULL,
	`joined` text NOT NULL,
	`left_at` text,
	`last_read` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`thread`) REFERENCES `chat_threads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chat_members_pair` ON `chat_members` (`thread`,`user_id`);--> statement-breakpoint
CREATE INDEX `chat_members_user` ON `chat_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`thread` text NOT NULL,
	`sender` text NOT NULL,
	`kind` text DEFAULT 'text' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`media` text,
	`created` text NOT NULL,
	FOREIGN KEY (`thread`) REFERENCES `chat_threads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sender`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`media`) REFERENCES `social_media`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chat_message_nonce` ON `chat_messages` (`sender`,`id`);--> statement-breakpoint
CREATE INDEX `chat_messages_thread` ON `chat_messages` (`thread`,`seq`);--> statement-breakpoint
CREATE TABLE `chat_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`target` text NOT NULL,
	`unread` integer DEFAULT 0 NOT NULL,
	`pinned` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`owner`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chat_preferences_owner_target` ON `chat_preferences` (`owner`,`target`);--> statement-breakpoint
CREATE TABLE `chat_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`creator` text NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `group_call_members` (
	`id` text PRIMARY KEY NOT NULL,
	`call_id` text NOT NULL,
	`user_id` text NOT NULL,
	`session` text NOT NULL,
	`state` text NOT NULL,
	`muted` integer DEFAULT 0 NOT NULL,
	`camera` integer DEFAULT 1 NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`call_id`) REFERENCES `group_calls`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `group_call_member` ON `group_call_members` (`call_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `group_call_signals` (
	`id` text PRIMARY KEY NOT NULL,
	`call_id` text NOT NULL,
	`sender` text NOT NULL,
	`recipient` text NOT NULL,
	`from_session` text NOT NULL,
	`to_session` text NOT NULL,
	`kind` text NOT NULL,
	`sdp` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`call_id`) REFERENCES `group_calls`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `group_call_signals_recipient` ON `group_call_signals` (`call_id`,`recipient`);--> statement-breakpoint
CREATE TABLE `group_calls` (
	`id` text PRIMARY KEY NOT NULL,
	`thread` text NOT NULL,
	`host` text NOT NULL,
	`mode` text NOT NULL,
	`status` text NOT NULL,
	`created` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`thread`) REFERENCES `chat_threads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `group_calls_thread` ON `group_calls` (`thread`,`status`);--> statement-breakpoint
CREATE TABLE `social_media` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`peer` text,
	`thread` text,
	`kind` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`duration` integer NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`owner`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`thread`) REFERENCES `chat_threads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `social_media_owner` ON `social_media` (`owner`);--> statement-breakpoint
ALTER TABLE `social_messages` ADD `kind` text DEFAULT 'text' NOT NULL;--> statement-breakpoint
ALTER TABLE `social_messages` ADD `media` text;