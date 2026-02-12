# Release Guide

## Cara Release Versi Baru

### 1. Update Versi

Edit `src-tauri/tauri.conf.json`:
```json
"version": "0.2.0"
```

Edit `package.json`:
```json
"version": "0.2.0"
```

### 2. Commit dan Push ke Production Branch

```bash
# Commit perubahan
git add .
git commit -m "chore: bump version to 0.2.0"

# Push ke branch production
git push origin production
```

### 3. Otomatis Build & Release

GitHub Actions akan otomatis:
- Detect push ke branch `production`
- Baca versi dari `src-tauri/tauri.conf.json`
- Buat tag otomatis (contoh: `v0.2.0`)
- Build aplikasi untuk Windows
- Buat release di GitHub dengan tag
- Upload installer (.msi) dan portable (.exe) ke release

### 4. Download Release

Setelah build selesai (sekitar 5-10 menit), file installer akan tersedia di:
- GitHub Releases: `https://github.com/USERNAME/REPO/releases`

File yang tersedia:
- `DKA-Email-Sender-AI-Automatically-Tools_VERSION_x64_en-US.msi` - Windows Installer
- `DKA-Email-Sender-AI-Automatically-Tools_VERSION_x64.exe` - Portable executable

## Workflow

```
main/master branch → Development & Testing
       ↓
   (merge to)
       ↓
production branch → Auto Build & Release
```

## Build Manual

Untuk build manual di local:

```bash
# Install dependencies
npm install

# Build untuk production
npm run tauri:build
```

File hasil build ada di: `src-tauri/target/release/bundle/`

## Platform Support

Saat ini hanya support Windows. Untuk menambah platform lain (macOS, Linux), 
edit `.github/workflows/build.yml` dan tambahkan platform di matrix:

```yaml
matrix:
  platform: [windows-latest, ubuntu-latest, macos-latest]
```

## Catatan

- Jika tag sudah ada, workflow akan skip release dan memberi peringatan
- Pastikan update versi sebelum push ke production
- Versi harus mengikuti format semantic versioning (contoh: 0.1.0, 1.0.0, 1.2.3)

