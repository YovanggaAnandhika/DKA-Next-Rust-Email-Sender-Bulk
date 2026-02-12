# Setup Google OAuth2 untuk Email Sender

Aplikasi ini menggunakan Google OAuth2 untuk login dan mengirim email. Ikuti langkah berikut untuk setup:

## 1. Buat Google Cloud Project

1. Buka [Google Cloud Console](https://console.cloud.google.com/)
2. Klik "Select a project" → "New Project"
3. Nama project: "DKA Email Sender"
4. Klik "Create"

## 2. Enable APIs

1. Di sidebar, pilih "APIs & Services" → "Library"
2. Cari dan enable:
   - **Gmail API**
   - **Google Drive API**

## 3. Configure OAuth Consent Screen

1. Di sidebar, pilih "APIs & Services" → "OAuth consent screen"
2. Pilih "External" → "Create"
3. Isi form:
   - App name: `DKA Email Sender`
   - User support email: (email Anda)
   - Developer contact: (email Anda)
4. Klik "Save and Continue"
5. Di "Scopes", klik "Add or Remove Scopes"
6. Tambahkan scopes:
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/drive.file`
7. Klik "Update" → "Save and Continue"
8. Di "Test users", tambahkan email yang akan digunakan untuk testing
9. Klik "Save and Continue"

## 4. Create OAuth Client ID

1. Di sidebar, pilih "APIs & Services" → "Credentials"
2. Klik "Create Credentials" → "OAuth client ID"
3. Application type: "Desktop app"
4. Name: "DKA Email Sender Desktop"
5. Klik "Create"
6. Copy **Client ID** dan **Client Secret**

## 5. Update Aplikasi

Edit file `src-tauri/src/main.rs`:

```rust
const GOOGLE_CLIENT_ID: &str = "YOUR_CLIENT_ID_HERE.apps.googleusercontent.com";
const GOOGLE_CLIENT_SECRET: &str = "YOUR_CLIENT_SECRET_HERE";
```

Ganti dengan Client ID dan Client Secret yang Anda dapatkan.

## 6. Build Aplikasi

```bash
bun install
bun run tauri:build
```

## 7. Cara Pakai

1. Buka aplikasi
2. Pergi ke tab "Settings Account"
3. Klik "Login with Google"
4. Browser akan terbuka, login dengan Google
5. Copy authorization code dari URL
6. Paste di aplikasi
7. Selesai! Account sudah terhubung

## Troubleshooting

### Error: redirect_uri_mismatch

Tambahkan redirect URI di Google Cloud Console:
1. Buka "Credentials" → Edit OAuth client
2. Di "Authorized redirect URIs", tambahkan:
   - `http://localhost:8888/callback`
3. Save

### Error: Access blocked

Pastikan email Anda sudah ditambahkan di "Test users" di OAuth consent screen.

### Token expired

Token akan expire setelah 1 jam. Aplikasi akan otomatis refresh token jika ada refresh_token.

## Security Notes

- Jangan commit Client ID dan Client Secret ke Git
- Gunakan environment variables untuk production
- Revoke access dari [Google Account](https://myaccount.google.com/permissions) jika tidak digunakan
