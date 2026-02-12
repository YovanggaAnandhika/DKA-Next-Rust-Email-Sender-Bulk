# Email Sender App (Tauri)

Aplikasi desktop untuk mengirim email dengan attachment ke multiple recipients (tanpa CC).

## Setup

### Install Dependencies
```bash
npm install
```

### Development Mode
```bash
npm run tauri:dev
```

### Build Production
```bash
npm run tauri:build
```

File executable akan ada di `src-tauri/target/release/`

## Cara Pakai

1. Jalankan aplikasi
2. Isi form:
   - Title/Subject email
   - Email list (pisahkan dengan koma)
   - Gmail SMTP username (email Gmail Anda)
   - Gmail App Password (bukan password biasa!)
   - Pilih file attachment (opsional)
3. Klik "Kirim Email"

## Gmail App Password

Untuk menggunakan Gmail SMTP, Anda perlu App Password:

1. Buka Google Account → Security
2. Aktifkan 2-Step Verification
3. Buka App passwords
4. Generate password baru untuk "Mail"
5. Gunakan password 16 karakter tersebut di aplikasi

## Fitur

- Desktop app (Windows, macOS, Linux)
- Kirim email ke multiple recipients
- Setiap email dikirim terpisah (bukan CC)
- Support attachment
- Penerima tidak saling tahu siapa yang menerima email

## Tech Stack

- Tauri (Rust backend)
- Next.js (React frontend)
- Lettre (Rust email library)
