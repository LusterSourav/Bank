process.env.TOTP_ENCRYPTION_KEY = 'a'.repeat(64)
process.env.TOTP_SESSION_SECRET = 'b'.repeat(40)
process.env.FIREBASE_PROJECT_ID = 'test'
process.env.FIREBASE_CLIENT_EMAIL = 'test@test.iam.gserviceaccount.com'
process.env.FIREBASE_PRIVATE_KEY = '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA\n-----END RSA PRIVATE KEY-----'
