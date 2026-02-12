# Release Guide

## Cara Release Versi Baru

1. Update versi di `src-tauri/tauri.conf.json`:
```json
"version": "0.2.0"
```

2. Update versi di `package.json`:
```json
"version": "0.2.0"
```

3. Commit perubahan:
```bash
git add .
git commit -m "chore: bump version to 0.2.0"
```

4. Buat tag dan push:
```bash
git tag v0.2.0
git push origin main
git push origin v0.2.0
```

5. GitHub Actions akan otomatis:
   - Build aplikasi untuk Windows
   - Buat release di GitHub
   - Upload installer (.msi) dan portable (.exe) ke release

## Download Release

Setelah build selesai, file installer akan tersedia di:
- GitHub Releases: `https://github.com/USERNAME/REPO/releases`

File yang tersedia:
- `DKA-Email-Sender-AI-Automatically-Tools_VERSION_x64_en-US.msi` - Windows Installer
- `DKA-Email-Sender-AI-Automatically-Tools_VERSION_x64.exe` - Portable executable

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
edit `.github/workflows/release.yml` dan tambahkan platform di matrix:

```yaml
matrix:
  platform: [windows-latest, ubuntu-latest, macos-latest]
```
