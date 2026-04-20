process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/imanager_test";
process.env.ENABLE_TEST_AUTH_BYPASS = process.env.ENABLE_TEST_AUTH_BYPASS || "true";
process.env.FRONTEND_URL = process.env.FRONTEND_URL || "http://127.0.0.1:3000";
process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "demo-project";
process.env.FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL || "demo@example.com";
process.env.FIREBASE_PRIVATE_KEY =
  process.env.FIREBASE_PRIVATE_KEY || "-----BEGIN PRIVATE KEY-----\\nkey\\n-----END PRIVATE KEY-----";
process.env.FIRESTORE_DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || "demo-database";
process.env.SMTP_HOST = process.env.SMTP_HOST || "smtp.example.com";
process.env.SMTP_USER = process.env.SMTP_USER || "mailer@example.com";
process.env.SMTP_PASS = process.env.SMTP_PASS || "secret";
