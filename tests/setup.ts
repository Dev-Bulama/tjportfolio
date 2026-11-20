process.env.NODE_ENV = "test";
process.env.SESSION_SECRET ??= "test-secret-test-secret-test-secret-test-secret-test-secret-xx";
process.env.DATABASE_NAME = process.env.TEST_DATABASE_NAME ?? "tjportfolio_test";
process.env.DATABASE_USER ??= "tj";
process.env.DATABASE_PASSWORD ??= "tjdevpass";
process.env.ANALYTICS_SALT ??= "test-analytics-salt";
