CREATE TABLE `audit_logs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned,
	`user_name` varchar(191),
	`action` varchar(64) NOT NULL,
	`resource` varchar(64) NOT NULL,
	`resource_id` varchar(64),
	`summary` varchar(255),
	`diff` json,
	`ip_hash` varchar(64),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`email` varchar(191) NOT NULL,
	`ip_hash` varchar(64),
	`success` boolean NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `login_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `password_resets` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`used_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `password_resets_id` PRIMARY KEY(`id`),
	CONSTRAINT `password_resets_token_uq` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `recovery_codes` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`code_hash` varchar(64) NOT NULL,
	`used_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `recovery_codes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` varchar(64) NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`two_factor_passed` boolean NOT NULL DEFAULT false,
	`csrf_secret` varchar(64) NOT NULL,
	`ip_hash` varchar(64),
	`user_agent` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`last_seen_at` timestamp NOT NULL DEFAULT (now()),
	`expires_at` timestamp NOT NULL,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`email` varchar(191) NOT NULL,
	`name` varchar(191) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`role` enum('owner','admin','editor','viewer') NOT NULL DEFAULT 'editor',
	`totp_secret` varchar(255),
	`totp_enabled` boolean NOT NULL DEFAULT false,
	`failed_attempts` int NOT NULL DEFAULT 0,
	`locked_until` timestamp,
	`last_login_at` timestamp,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_uq` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`type` enum('project','training','certification','post','service_type','album','faq') NOT NULL,
	`name` varchar(120) NOT NULL,
	`slug` varchar(140) NOT NULL,
	`description` text,
	`status` enum('draft','published','scheduled') NOT NULL DEFAULT 'draft',
	`published_at` timestamp,
	`featured` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_sample` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` timestamp,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_type_slug_uq` UNIQUE(`type`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `homepage_sections` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`key` varchar(40) NOT NULL,
	`title` varchar(191) NOT NULL,
	`kicker` varchar(80),
	`intro` text,
	`status` enum('draft','published','scheduled') NOT NULL DEFAULT 'draft',
	`published_at` timestamp,
	`featured` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_sample` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` timestamp,
	CONSTRAINT `homepage_sections_id` PRIMARY KEY(`id`),
	CONSTRAINT `homepage_sections_key_uq` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `menu_items` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`menu_id` bigint unsigned NOT NULL,
	`parent_id` bigint unsigned,
	`label` varchar(80) NOT NULL,
	`href` varchar(500) NOT NULL,
	`new_tab` boolean NOT NULL DEFAULT false,
	`visible` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `menu_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `menus` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`key` varchar(40) NOT NULL,
	`name` varchar(80) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `menus_id` PRIMARY KEY(`id`),
	CONSTRAINT `menus_key_uq` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `page_blocks` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`page_id` bigint unsigned NOT NULL,
	`type` varchar(40) NOT NULL,
	`data` json NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `page_blocks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pages` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`title` varchar(191) NOT NULL,
	`slug` varchar(191) NOT NULL,
	`seo_title` varchar(191),
	`seo_description` varchar(320),
	`og_image_id` bigint unsigned,
	`status` enum('draft','published','scheduled') NOT NULL DEFAULT 'draft',
	`published_at` timestamp,
	`featured` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_sample` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` timestamp,
	CONSTRAINT `pages_id` PRIMARY KEY(`id`),
	CONSTRAINT `pages_slug_uq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` varchar(64) NOT NULL,
	`value` json NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `settings_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `social_links` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`platform` varchar(40) NOT NULL,
	`label` varchar(80) NOT NULL,
	`url` varchar(500) NOT NULL,
	`icon` varchar(60),
	`status` enum('draft','published','scheduled') NOT NULL DEFAULT 'draft',
	`published_at` timestamp,
	`featured` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_sample` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` timestamp,
	CONSTRAINT `social_links_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stats` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`label` varchar(80) NOT NULL,
	`value` int NOT NULL DEFAULT 0,
	`suffix` varchar(10),
	`icon` varchar(60),
	`status` enum('draft','published','scheduled') NOT NULL DEFAULT 'draft',
	`published_at` timestamp,
	`featured` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_sample` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` timestamp,
	CONSTRAINT `stats_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `taggables` (
	`tag_id` bigint unsigned NOT NULL,
	`taggable_type` varchar(40) NOT NULL,
	`taggable_id` bigint unsigned NOT NULL,
	CONSTRAINT `taggables_tag_id_taggable_type_taggable_id_pk` PRIMARY KEY(`tag_id`,`taggable_type`,`taggable_id`)
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(80) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `tags_slug_uq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `media` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`driver` enum('local','s3') NOT NULL DEFAULT 'local',
	`key` varchar(255) NOT NULL,
	`original_name` varchar(255) NOT NULL,
	`mime` varchar(100) NOT NULL,
	`size` int NOT NULL,
	`width` int,
	`height` int,
	`blur_data_url` text,
	`variants` json,
	`alt` varchar(255),
	`caption` varchar(500),
	`credit` varchar(191),
	`checksum` varchar(64),
	`folder` varchar(40) NOT NULL DEFAULT 'library',
	`album_id` bigint unsigned,
	`album_order` int NOT NULL DEFAULT 0,
	`created_by` bigint unsigned,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` timestamp,
	CONSTRAINT `media_id` PRIMARY KEY(`id`),
	CONSTRAINT `media_key_uq` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `media_usages` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`media_id` bigint unsigned NOT NULL,
	`resource` varchar(40) NOT NULL,
	`resource_id` bigint unsigned NOT NULL,
	`field` varchar(60) NOT NULL,
	CONSTRAINT `media_usages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `albums` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`title` varchar(191) NOT NULL,
	`slug` varchar(191) NOT NULL,
	`description` text,
	`cover_id` bigint unsigned,
	`date` date,
	`category_id` bigint unsigned,
	`seo_title` varchar(191),
	`seo_description` varchar(320),
	`og_image_id` bigint unsigned,
	`status` enum('draft','published','scheduled') NOT NULL DEFAULT 'draft',
	`published_at` timestamp,
	`featured` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_sample` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` timestamp,
	CONSTRAINT `albums_id` PRIMARY KEY(`id`),
	CONSTRAINT `albums_slug_uq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `certifications` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(191) NOT NULL,
	`slug` varchar(191) NOT NULL,
	`issuer` varchar(191) NOT NULL,
	`issuer_logo_id` bigint unsigned,
	`category_id` bigint unsigned,
	`issue_date` date,
	`expiry_date` date,
	`credential_id` varchar(191),
	`verify_url` varchar(500),
	`file_id` bigint unsigned,
	`description` text,
	`seo_title` varchar(191),
	`seo_description` varchar(320),
	`og_image_id` bigint unsigned,
	`status` enum('draft','published','scheduled') NOT NULL DEFAULT 'draft',
	`published_at` timestamp,
	`featured` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_sample` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` timestamp,
	CONSTRAINT `certifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `certifications_slug_uq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(191) NOT NULL,
	`logo_id` bigint unsigned,
	`url` varchar(500),
	`note` varchar(191),
	`status` enum('draft','published','scheduled') NOT NULL DEFAULT 'draft',
	`published_at` timestamp,
	`featured` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_sample` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` timestamp,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `courses` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`title` varchar(191) NOT NULL,
	`slug` varchar(191) NOT NULL,
	`track_id` bigint unsigned,
	`summary` text,
	`body_json` json,
	`body_html` longtext,
	`outline` json,
	`duration_label` varchar(60),
	`schedule_label` varchar(120),
	`start_date` date,
	`price` decimal(12,2),
	`currency` enum('NGN','USD') NOT NULL DEFAULT 'NGN',
	`seats` int,
	`registration_open` boolean NOT NULL DEFAULT true,
	`cover_id` bigint unsigned,
	`seo_title` varchar(191),
	`seo_description` varchar(320),
	`og_image_id` bigint unsigned,
	`status` enum('draft','published','scheduled') NOT NULL DEFAULT 'draft',
	`published_at` timestamp,
	`featured` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_sample` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` timestamp,
	CONSTRAINT `courses_id` PRIMARY KEY(`id`),
	CONSTRAINT `courses_slug_uq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `cv_files` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`title` varchar(191) NOT NULL,
	`media_id` bigint unsigned,
	`is_primary` boolean NOT NULL DEFAULT false,
	`downloads` int NOT NULL DEFAULT 0,
	`status` enum('draft','published','scheduled') NOT NULL DEFAULT 'draft',
	`published_at` timestamp,
	`featured` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_sample` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` timestamp,
	CONSTRAINT `cv_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `education` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`institution` varchar(191) NOT NULL,
	`qualification` varchar(191) NOT NULL,
	`field` varchar(191),
	`start_year` int,
	`end_year` int,
	`notes` text,
	`status` enum('draft','published','scheduled') NOT NULL DEFAULT 'draft',
	`published_at` timestamp,
	`featured` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_sample` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` timestamp,
	CONSTRAINT `education_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `experiences` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`organization` varchar(191) NOT NULL,
	`role` varchar(191) NOT NULL,
	`location` varchar(120),
	`start_date` date,
	`end_date` date,
	`is_current` boolean NOT NULL DEFAULT false,
	`period_label` varchar(80),
	`description` text,
	`logo_id` bigint unsigned,
	`url` varchar(500),
	`is_leadership` boolean NOT NULL DEFAULT false,
	`status` enum('draft','published','scheduled') NOT NULL DEFAULT 'draft',
	`published_at` timestamp,
	`featured` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_sample` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` timestamp,
	CONSTRAINT `experiences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `faqs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`question` varchar(255) NOT NULL,
	`answer` text NOT NULL,
	`category_id` bigint unsigned,
	`status` enum('draft','published','scheduled') NOT NULL DEFAULT 'draft',
	`published_at` timestamp,
	`featured` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_sample` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` timestamp,
	CONSTRAINT `faqs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`title` varchar(191) NOT NULL,
	`slug` varchar(191) NOT NULL,
	`excerpt` text,
	`cover_id` bigint unsigned,
	`body_json` json,
	`body_html` longtext,
	`category_id` bigint unsigned,
	`author_id` bigint unsigned,
	`reading_minutes` int NOT NULL DEFAULT 1,
	`seo_title` varchar(191),
	`seo_description` varchar(320),
	`og_image_id` bigint unsigned,
	`status` enum('draft','published','scheduled') NOT NULL DEFAULT 'draft',
	`published_at` timestamp,
	`featured` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_sample` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` timestamp,
	CONSTRAINT `posts_id` PRIMARY KEY(`id`),
	CONSTRAINT `posts_slug_uq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `press_items` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`title` varchar(191) NOT NULL,
	`outlet` varchar(191),
	`kind` enum('speaking','press','podcast','article') NOT NULL DEFAULT 'speaking',
	`date` date,
	`url` varchar(500),
	`image_id` bigint unsigned,
	`status` enum('draft','published','scheduled') NOT NULL DEFAULT 'draft',
	`published_at` timestamp,
	`featured` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_sample` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` timestamp,
	CONSTRAINT `press_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_images` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`project_id` bigint unsigned NOT NULL,
	`media_id` bigint unsigned NOT NULL,
	`caption` varchar(255),
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `project_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_metrics` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`project_id` bigint unsigned NOT NULL,
	`label` varchar(120) NOT NULL,
	`value` varchar(60) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `project_metrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_skills` (
	`project_id` bigint unsigned NOT NULL,
	`skill_id` bigint unsigned NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `project_skills_project_id_skill_id_pk` PRIMARY KEY(`project_id`,`skill_id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`title` varchar(191) NOT NULL,
	`slug` varchar(191) NOT NULL,
	`category_id` bigint unsigned,
	`client_name` varchar(191),
	`client_logo_id` bigint unsigned,
	`show_client` boolean NOT NULL DEFAULT true,
	`role` varchar(191),
	`year` int,
	`start_date` date,
	`end_date` date,
	`project_status` enum('completed','ongoing','concept') NOT NULL DEFAULT 'completed',
	`summary` text,
	`body_json` json,
	`body_html` longtext,
	`cover_id` bigint unsigned,
	`video_url` varchar(500),
	`live_url` varchar(500),
	`repo_url` varchar(500),
	`app_store_url` varchar(500),
	`play_store_url` varchar(500),
	`seo_title` varchar(191),
	`seo_description` varchar(320),
	`og_image_id` bigint unsigned,
	`status` enum('draft','published','scheduled') NOT NULL DEFAULT 'draft',
	`published_at` timestamp,
	`featured` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_sample` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` timestamp,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `projects_slug_uq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `review_requests` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(191) NOT NULL,
	`email` varchar(191) NOT NULL,
	`project_id` bigint unsigned,
	`training_id` bigint unsigned,
	`service_type_id` bigint unsigned,
	`message` text,
	`token_hash` varchar(64) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`sent_at` timestamp,
	`opened_at` timestamp,
	`used_at` timestamp,
	`testimonial_id` bigint unsigned,
	`created_by` bigint unsigned,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `review_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `review_requests_token_uq` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `service_faqs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`service_id` bigint unsigned NOT NULL,
	`question` varchar(255) NOT NULL,
	`answer` text NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `service_faqs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`title` varchar(191) NOT NULL,
	`slug` varchar(191) NOT NULL,
	`icon` varchar(60),
	`summary` text,
	`body_json` json,
	`body_html` longtext,
	`deliverables` json,
	`process` json,
	`cta_text` varchar(191),
	`service_type_id` bigint unsigned,
	`project_category_ids` json,
	`seo_title` varchar(191),
	`seo_description` varchar(320),
	`og_image_id` bigint unsigned,
	`status` enum('draft','published','scheduled') NOT NULL DEFAULT 'draft',
	`published_at` timestamp,
	`featured` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_sample` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` timestamp,
	CONSTRAINT `services_id` PRIMARY KEY(`id`),
	CONSTRAINT `services_slug_uq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `skills` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`category` enum('languages','frameworks','databases','cloud','ai_data','methodologies','training','tools') NOT NULL,
	`proficiency` tinyint NOT NULL DEFAULT 4,
	`years` int,
	`icon_id` bigint unsigned,
	`show_on_home` boolean NOT NULL DEFAULT false,
	`status` enum('draft','published','scheduled') NOT NULL DEFAULT 'draft',
	`published_at` timestamp,
	`featured` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_sample` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` timestamp,
	CONSTRAINT `skills_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `testimonials` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`author_name` varchar(191) NOT NULL,
	`author_role` varchar(191),
	`company` varchar(191),
	`company_logo_id` bigint unsigned,
	`author_photo_id` bigint unsigned,
	`rating` tinyint NOT NULL DEFAULT 5,
	`service_type_id` bigint unsigned,
	`project_id` bigint unsigned,
	`training_id` bigint unsigned,
	`quote` text NOT NULL,
	`date` date,
	`source` enum('direct','linkedin','google','email') NOT NULL DEFAULT 'direct',
	`consent` boolean NOT NULL DEFAULT false,
	`moderation` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`status` enum('draft','published','scheduled') NOT NULL DEFAULT 'draft',
	`published_at` timestamp,
	`featured` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_sample` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` timestamp,
	CONSTRAINT `testimonials_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `training_images` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`training_id` bigint unsigned NOT NULL,
	`media_id` bigint unsigned NOT NULL,
	`caption` varchar(255),
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `training_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `training_modules` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`training_id` bigint unsigned NOT NULL,
	`title` varchar(191) NOT NULL,
	`description` text,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `training_modules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trainings` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`title` varchar(191) NOT NULL,
	`slug` varchar(191) NOT NULL,
	`track_id` bigint unsigned,
	`client_name` varchar(191),
	`show_client` boolean NOT NULL DEFAULT true,
	`format` enum('onsite','virtual','hybrid') NOT NULL DEFAULT 'onsite',
	`location` varchar(191),
	`start_date` date,
	`end_date` date,
	`duration_label` varchar(60),
	`participants` int,
	`summary` text,
	`body_json` json,
	`body_html` longtext,
	`outcomes` json,
	`related_certification_ids` json,
	`cover_id` bigint unsigned,
	`seo_title` varchar(191),
	`seo_description` varchar(320),
	`og_image_id` bigint unsigned,
	`status` enum('draft','published','scheduled') NOT NULL DEFAULT 'draft',
	`published_at` timestamp,
	`featured` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_sample` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` timestamp,
	CONSTRAINT `trainings_id` PRIMARY KEY(`id`),
	CONSTRAINT `trainings_slug_uq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `course_registrations` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`course_id` bigint unsigned,
	`kind` enum('registration','training_request') NOT NULL DEFAULT 'registration',
	`subject` varchar(191),
	`name` varchar(191) NOT NULL,
	`email` varchar(191) NOT NULL,
	`phone` varchar(40),
	`company` varchar(191),
	`seats` int NOT NULL DEFAULT 1,
	`message` text,
	`status` enum('new','contacted','confirmed','cancelled') NOT NULL DEFAULT 'new',
	`notes` text,
	`meta` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `course_registrations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `maintenance_tickets` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`ticket_no` varchar(32) NOT NULL,
	`client_name` varchar(191) NOT NULL,
	`company` varchar(191),
	`email` varchar(191) NOT NULL,
	`phone` varchar(40),
	`project_id` bigint unsigned,
	`project_other` varchar(191),
	`issue_type` enum('bug','downtime','content_update','feature_request','security','performance') NOT NULL,
	`priority` enum('low','normal','high','critical') NOT NULL DEFAULT 'normal',
	`description` text NOT NULL,
	`affected_url` varchar(500),
	`contact_method` enum('email','phone','whatsapp') NOT NULL DEFAULT 'email',
	`status` enum('new','acknowledged','in_progress','awaiting_client','resolved','closed') NOT NULL DEFAULT 'new',
	`due_at` timestamp,
	`resolved_at` timestamp,
	`notes` text,
	`ip_hash` varchar(64),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `maintenance_tickets_id` PRIMARY KEY(`id`),
	CONSTRAINT `tickets_no_uq` UNIQUE(`ticket_no`)
);
--> statement-breakpoint
CREATE TABLE `message_replies` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`message_id` bigint unsigned NOT NULL,
	`user_id` bigint unsigned,
	`body` text NOT NULL,
	`is_note` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `message_replies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(191) NOT NULL,
	`email` varchar(191) NOT NULL,
	`phone` varchar(40),
	`company` varchar(191),
	`inquiry_type` varchar(60) NOT NULL,
	`budget` varchar(60),
	`timeline` varchar(60),
	`message` text NOT NULL,
	`attachment_id` bigint unsigned,
	`status` enum('new','read','replied','archived','spam') NOT NULL DEFAULT 'new',
	`page` varchar(255),
	`referrer` varchar(255),
	`country` varchar(8),
	`ip_hash` varchar(64),
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscribers` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`email` varchar(191) NOT NULL,
	`name` varchar(191),
	`status` enum('pending','confirmed','unsubscribed') NOT NULL DEFAULT 'pending',
	`token_hash` varchar(64) NOT NULL,
	`confirmed_at` timestamp,
	`unsubscribed_at` timestamp,
	`source` varchar(60),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscribers_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscribers_email_uq` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `ticket_attachments` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`ticket_id` bigint unsigned NOT NULL,
	`media_id` bigint unsigned NOT NULL,
	CONSTRAINT `ticket_attachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ticket_updates` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`ticket_id` bigint unsigned NOT NULL,
	`user_id` bigint unsigned,
	`body` text,
	`is_public` boolean NOT NULL DEFAULT false,
	`status_from` varchar(20),
	`status_to` varchar(20),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ticket_updates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `analytics_daily` (
	`day` date NOT NULL,
	`kind` varchar(20) NOT NULL,
	`key` varchar(191) NOT NULL DEFAULT '',
	`value` int NOT NULL DEFAULT 0,
	CONSTRAINT `analytics_daily_day_kind_key_pk` PRIMARY KEY(`day`,`kind`,`key`)
);
--> statement-breakpoint
CREATE TABLE `analytics_events` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`ts` timestamp NOT NULL DEFAULT (now()),
	`name` varchar(60) NOT NULL,
	`path` varchar(255),
	`label` varchar(255),
	`visitor_hash` varchar(64),
	`meta` json,
	CONSTRAINT `analytics_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `analytics_hits` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`ts` timestamp NOT NULL DEFAULT (now()),
	`path` varchar(255) NOT NULL,
	`referrer` varchar(191),
	`utm_source` varchar(100),
	`utm_medium` varchar(100),
	`utm_campaign` varchar(100),
	`device` varchar(16),
	`browser` varchar(32),
	`os` varchar(32),
	`country` varchar(8),
	`visitor_hash` varchar(64) NOT NULL,
	CONSTRAINT `analytics_hits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`type` varchar(40) NOT NULL,
	`payload` json NOT NULL,
	`status` enum('pending','done','failed') NOT NULL DEFAULT 'pending',
	`attempts` int NOT NULL DEFAULT 0,
	`run_at` timestamp NOT NULL DEFAULT (now()),
	`last_error` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` varchar(191) NOT NULL,
	`count` int NOT NULL DEFAULT 0,
	`reset_at` timestamp NOT NULL,
	CONSTRAINT `rate_limits_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `password_resets` ADD CONSTRAINT `password_resets_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recovery_codes` ADD CONSTRAINT `recovery_codes_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `menu_items` ADD CONSTRAINT `menu_items_menu_id_menus_id_fk` FOREIGN KEY (`menu_id`) REFERENCES `menus`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `page_blocks` ADD CONSTRAINT `page_blocks_page_id_pages_id_fk` FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `taggables` ADD CONSTRAINT `taggables_tag_id_tags_id_fk` FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `media_usages` ADD CONSTRAINT `media_usages_media_id_media_id_fk` FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `albums` ADD CONSTRAINT `albums_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `certifications` ADD CONSTRAINT `certifications_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `courses` ADD CONSTRAINT `courses_track_id_categories_id_fk` FOREIGN KEY (`track_id`) REFERENCES `categories`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cv_files` ADD CONSTRAINT `cv_files_media_id_media_id_fk` FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `faqs` ADD CONSTRAINT `faqs_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `posts` ADD CONSTRAINT `posts_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `posts` ADD CONSTRAINT `posts_author_id_users_id_fk` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_images` ADD CONSTRAINT `project_images_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_images` ADD CONSTRAINT `project_images_media_id_media_id_fk` FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_metrics` ADD CONSTRAINT `project_metrics_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_skills` ADD CONSTRAINT `project_skills_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_skills` ADD CONSTRAINT `project_skills_skill_id_skills_id_fk` FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `review_requests` ADD CONSTRAINT `review_requests_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `review_requests` ADD CONSTRAINT `review_requests_training_id_trainings_id_fk` FOREIGN KEY (`training_id`) REFERENCES `trainings`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `review_requests` ADD CONSTRAINT `review_requests_service_type_id_categories_id_fk` FOREIGN KEY (`service_type_id`) REFERENCES `categories`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `review_requests` ADD CONSTRAINT `review_requests_testimonial_id_testimonials_id_fk` FOREIGN KEY (`testimonial_id`) REFERENCES `testimonials`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `review_requests` ADD CONSTRAINT `review_requests_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `service_faqs` ADD CONSTRAINT `service_faqs_service_id_services_id_fk` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `services` ADD CONSTRAINT `services_service_type_id_categories_id_fk` FOREIGN KEY (`service_type_id`) REFERENCES `categories`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `testimonials` ADD CONSTRAINT `testimonials_service_type_id_categories_id_fk` FOREIGN KEY (`service_type_id`) REFERENCES `categories`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `testimonials` ADD CONSTRAINT `testimonials_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `testimonials` ADD CONSTRAINT `testimonials_training_id_trainings_id_fk` FOREIGN KEY (`training_id`) REFERENCES `trainings`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `training_images` ADD CONSTRAINT `training_images_training_id_trainings_id_fk` FOREIGN KEY (`training_id`) REFERENCES `trainings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `training_images` ADD CONSTRAINT `training_images_media_id_media_id_fk` FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `training_modules` ADD CONSTRAINT `training_modules_training_id_trainings_id_fk` FOREIGN KEY (`training_id`) REFERENCES `trainings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trainings` ADD CONSTRAINT `trainings_track_id_categories_id_fk` FOREIGN KEY (`track_id`) REFERENCES `categories`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `course_registrations` ADD CONSTRAINT `course_registrations_course_id_courses_id_fk` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `maintenance_tickets` ADD CONSTRAINT `maintenance_tickets_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `message_replies` ADD CONSTRAINT `message_replies_message_id_messages_id_fk` FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `message_replies` ADD CONSTRAINT `message_replies_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `messages` ADD CONSTRAINT `messages_attachment_id_media_id_fk` FOREIGN KEY (`attachment_id`) REFERENCES `media`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_attachments` ADD CONSTRAINT `ticket_attachments_ticket_id_maintenance_tickets_id_fk` FOREIGN KEY (`ticket_id`) REFERENCES `maintenance_tickets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_attachments` ADD CONSTRAINT `ticket_attachments_media_id_media_id_fk` FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_updates` ADD CONSTRAINT `ticket_updates_ticket_id_maintenance_tickets_id_fk` FOREIGN KEY (`ticket_id`) REFERENCES `maintenance_tickets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_updates` ADD CONSTRAINT `ticket_updates_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `audit_resource_idx` ON `audit_logs` (`resource`,`resource_id`);--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `audit_user_idx` ON `audit_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `login_attempts_email_idx` ON `login_attempts` (`email`,`created_at`);--> statement-breakpoint
CREATE INDEX `recovery_codes_user_idx` ON `recovery_codes` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_expires_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE INDEX `menu_items_menu_idx` ON `menu_items` (`menu_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `page_blocks_page_idx` ON `page_blocks` (`page_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `pages_status_idx` ON `pages` (`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `taggables_target_idx` ON `taggables` (`taggable_type`,`taggable_id`);--> statement-breakpoint
CREATE INDEX `media_album_idx` ON `media` (`album_id`,`album_order`);--> statement-breakpoint
CREATE INDEX `media_folder_idx` ON `media` (`folder`);--> statement-breakpoint
CREATE INDEX `media_usages_media_idx` ON `media_usages` (`media_id`);--> statement-breakpoint
CREATE INDEX `media_usages_res_idx` ON `media_usages` (`resource`,`resource_id`);--> statement-breakpoint
CREATE INDEX `posts_status_idx` ON `posts` (`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `project_images_project_idx` ON `project_images` (`project_id`);--> statement-breakpoint
CREATE INDEX `project_metrics_project_idx` ON `project_metrics` (`project_id`);--> statement-breakpoint
CREATE INDEX `projects_status_idx` ON `projects` (`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `projects_category_idx` ON `projects` (`category_id`);--> statement-breakpoint
CREATE INDEX `service_faqs_service_idx` ON `service_faqs` (`service_id`);--> statement-breakpoint
CREATE INDEX `skills_category_idx` ON `skills` (`category`);--> statement-breakpoint
CREATE INDEX `testimonials_mod_idx` ON `testimonials` (`moderation`,`service_type_id`);--> statement-breakpoint
CREATE INDEX `training_images_training_idx` ON `training_images` (`training_id`);--> statement-breakpoint
CREATE INDEX `training_modules_training_idx` ON `training_modules` (`training_id`);--> statement-breakpoint
CREATE INDEX `trainings_status_idx` ON `trainings` (`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `registrations_course_idx` ON `course_registrations` (`course_id`,`status`);--> statement-breakpoint
CREATE INDEX `tickets_status_idx` ON `maintenance_tickets` (`status`,`priority`);--> statement-breakpoint
CREATE INDEX `message_replies_msg_idx` ON `message_replies` (`message_id`);--> statement-breakpoint
CREATE INDEX `messages_status_idx` ON `messages` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `subscribers_token_idx` ON `subscribers` (`token_hash`);--> statement-breakpoint
CREATE INDEX `ticket_attachments_ticket_idx` ON `ticket_attachments` (`ticket_id`);--> statement-breakpoint
CREATE INDEX `ticket_updates_ticket_idx` ON `ticket_updates` (`ticket_id`);--> statement-breakpoint
CREATE INDEX `events_ts_idx` ON `analytics_events` (`ts`);--> statement-breakpoint
CREATE INDEX `events_name_idx` ON `analytics_events` (`name`,`ts`);--> statement-breakpoint
CREATE INDEX `hits_ts_idx` ON `analytics_hits` (`ts`);--> statement-breakpoint
CREATE INDEX `hits_path_idx` ON `analytics_hits` (`path`,`ts`);--> statement-breakpoint
CREATE INDEX `jobs_status_idx` ON `jobs` (`status`,`run_at`);