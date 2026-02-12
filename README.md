# DKA Email Sender AI Automatically Tools

Aplikasi desktop untuk mengirim email dengan attachment ke multiple recipients (tanpa CC).

![Windows](https://img.shields.io/badge/Windows-0078D6?style=flat&logo=windows&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-000000?style=flat&logo=rust&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat&logo=next.js&logoColor=white)
![Tauri](https://img.shields.io/badge/Tauri-FFC131?style=flat&logo=tauri&logoColor=white)

## Download

Download versi terbaru di [Releases](https://github.com/USERNAME/REPO/releases)

## Fitur

- ✉️ Kirim email ke multiple recipients
- 📎 Support attachment
- 🔒 Setiap email dikirim terpisah (bukan CC)
- 👥 Multiple account management
- ✅ Validasi SMTP credentials
- 💾 Simpan account untuk digunakan kembali
- 🖥️ Desktop app (Windows)

## Setup Development

### Prerequisites

- Node.js 20+
- Rust (latest stable)
- Bun atau npm

### Install Dependencies

```bash
npm install
# atau
bun install
```

### Development Mode

```bash
npm run tauri:dev
```

### Build Production

```bash
npm run tauri:build
```

File executable akan ada di `src-tauri/target/release/bundle/`

## Cara Pakai

1. Buka aplikasi
2. Pergi ke tab "Settings Account"
3. Tambah account Gmail dengan App Password
4. Klik "Validasi & Tambah Account"
5. Pergi ke tab "Kirim Email"
6. Pilih account pengirim
7. Isi subject, pesan, dan email penerima
8. (Opsional) Pilih file attachment
9. Klik "Kirim Email"

## Gmail App Password

Untuk menggunakan Gmail SMTP, Anda perlu App Password:

1. Buka [Google Account Security](https://myaccount.google.com/security)
2. Aktifkan 2-Step Verification
3. Buka App passwords
4. Generate password baru untuk "Mail"
5. Gunakan password 16 karakter tersebut di aplikasi

## Tech Stack

- **Frontend**: Next.js 14 + React 18
- **Backend**: Rust + Tauri
- **Email**: Lettre (Rust email library)
- **SMTP**: Gmail SMTP

## Release

Push ke branch `production` untuk otomatis build dan release. Lihat [RELEASE.md](RELEASE.md) untuk panduan lengkap.

```bash
# Update versi di src-tauri/tauri.conf.json dan package.json
# Commit dan push ke production
git add .
git commit -m "chore: bump version to 0.2.0"
git push origin production
```

GitHub Actions akan otomatis buat tag dan release dengan installer Windows.

## License

MIT
