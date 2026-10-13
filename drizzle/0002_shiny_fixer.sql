PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_community_admins` (
	`id` text PRIMARY KEY NOT NULL,
	`community` text NOT NULL,
	`user` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`community`) REFERENCES `communities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_community_admins`("id", "community", "user", "created") SELECT "id", "community", "user", "created" FROM `community_admins`;--> statement-breakpoint
DROP TABLE `community_admins`;--> statement-breakpoint
ALTER TABLE `__new_community_admins` RENAME TO `community_admins`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `community_admin_user` ON `community_admins` (`community`,`user`);--> statement-breakpoint
CREATE TABLE `__new_credentials` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_credentials`("user_id", "email", "password_hash") SELECT "user_id", "email", "password_hash" FROM `credentials`;--> statement-breakpoint
DROP TABLE `credentials`;--> statement-breakpoint
ALTER TABLE `__new_credentials` RENAME TO `credentials`;--> statement-breakpoint
CREATE UNIQUE INDEX `credentials_email` ON `credentials` (`email`);--> statement-breakpoint
CREATE TABLE `__new_account_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_account_sessions`("id", "user_id", "expires") SELECT "id", "user_id", "expires" FROM `account_sessions`;--> statement-breakpoint
DROP TABLE `account_sessions`;--> statement-breakpoint
ALTER TABLE `__new_account_sessions` RENAME TO `account_sessions`;--> statement-breakpoint
CREATE TABLE `__new_community_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`community` text NOT NULL,
	`author` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`category` text NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL,
	FOREIGN KEY (`community`) REFERENCES `communities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_community_posts`("id", "community", "author", "title", "content", "category", "status", "created", "updated") SELECT "id", "community", "author", "title", "content", "category", "status", "created", "updated" FROM `community_posts`;--> statement-breakpoint
DROP TABLE `community_posts`;--> statement-breakpoint
ALTER TABLE `__new_community_posts` RENAME TO `community_posts`;--> statement-breakpoint
CREATE TRIGGER community_admin_limit BEFORE INSERT ON community_admins
WHEN (SELECT count(*) FROM community_admins WHERE community=NEW.community)>=10
BEGIN SELECT RAISE(ABORT,'community admin limit reached'); END;
--> statement-breakpoint
CREATE UNIQUE INDEX community_name_lga ON communities(lower(name),lga) WHERE status<>'rejected';
