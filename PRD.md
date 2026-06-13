Product Requirements Document (PRD)
**Nama Proyek:** Smart Access Node – RFID Door System with Telegram API Integration
**Versi:** 1.0 (MVP)
**Status:** Approved / Ready for Development
**Bahasa Pemrograman Backend:** Node.js (Express / Hono)
**Database ORM:** Prisma ORM

---

## 1. Ringkasan Eksekutif (Executive Summary)
Sistem *Smart Access Node* adalah solusi kontrol akses pintu fisik berbasis IoT (Internet of Things) menggunakan mikrokontroler ESP32 dan RFID *Reader* (MFRC522). Berbeda dengan sistem konvensional yang menyimpan data akses secara lokal di perangkat, sistem ini menggunakan arsitektur terpusat di mana validasi kartu diproses melalui *backend* Node.js. Selain membuka pintu otomatis via *relay*, sistem menyediakan fitur pemantauan langsung (*real-time monitoring*) menggunakan Bot Telegram untuk memberikan laporan instan mengenai setiap aktivitas akses ruangan (baik akses berhasil maupun percobaan ilegal).

## 2. Tujuan & Sasaran (Objectives)
* **Keamanan Terpusat:** Mengeliminasi kebutuhan *hardcoding* UID kartu pada mikrokontroler. Manajemen hak akses dikelola sepenuhnya melalui *database server*.
* **Visibilitas Real-Time:** Memberikan notifikasi instan kepada pengelola atau pemilik ruangan melalui Telegram setiap kali pintu diakses.
* **Skalabilitas & Audit Trail:** Mencatat setiap riwayat pemindaian kartu secara kronologis untuk keperluan audit keamanan, yang nantinya siap diintegrasikan dengan *dashboard* berbasis web (React/Next.js).

## 3. Persiapan Perangkat & Komponen (Preparation Components)

### 3.1. Hardware (Perangkat Keras)
1.  **Mikrokontroler:** ESP32 (Disarankan karena memiliki modul WiFi bawaan dan RAM yang cukup untuk komunikasi HTTP/HTTPS).
2.  **RFID Reader:** Modul RC522 (13.56 MHz) + Kartu/Tag RFID.
3.  **Kunci Elektrik:** Solenoid Door Lock 12V.
4.  **Saklar Digital:** Module Relay 1-Channel (5V atau 3.3V kompatibel).
5.  **Catu Daya:** Adaptor 12V DC (Minimal 2A) untuk menyuplai daya ke Solenoid, dan modul *Step-Down* (LM2596 atau sejenisnya) untuk menurunkan tegangan ke 5V bagi ESP32.
6.  **Aksesoris:** Kabel jumper (Female-to-Female, Male-to-Female), Breadboard, dan Box Enclosure untuk melindungi sirkuit.

### 3.2. Software & Layanan Cloud
1.  **Firmware Development:** Arduino IDE atau PlatformIO untuk menulis kode C++ pada ESP32.
2.  **Runtime Environment:** Node.js (Versi 18 LTS ke atas).
3.  **Database:** PostgreSQL / MySQL / Supabase (untuk deployment cloud).
4.  **Layanan Pesan:** Telegram Bot API (Token Bot diperoleh melalui `@BotFather` dan Chat ID target).

---

## 4. Arsitektur Sistem & Aliran Data (System Architecture)
---

## 5. Kebutuhan Fitur (Feature Requirements)

### 5.1. Modul Hardware (Edge Node)
* **F-HW-01 (Card Scanning):** Perangkat harus stand-by dan mampu mendeteksi kartu RFID ketika didekatkan ke sensor RC522 dalam jarak < 3 cm.
* **F-HW-02 (Data Transmission):** Perangkat harus mengirimkan data UID kartu dalam format JSON melalui protokol HTTP POST ke server backend setelah kartu terdeteksi.
* **F-HW-03 (Actuator Control):** Perangkat harus mengaktifkan Relay (mengubah status ke *HIGH/LOW* tergantung jenis relay) selama tepat 5 detik jika mendapatkan respon *HTTP 200 OK* dari server, lalu mengunci kembali pintu.
* **F-HW-04 (Indicator):** Perangkat disarankan memiliki indikator visual (LED) atau audio (Buzzer) untuk membedakan respon sukses dan gagal (misal: bip 1x untuk sukses, bip 3x untuk gagal).

### 5.2. Modul Backend API
* **F-BE-01 (Authentication Endpoint):** Menyediakan REST API endpoint secure untuk menerima data *payload* dari ESP32.
* **F-BE-02 (Database Verification):** Memvalidasi UID yang dikirim dengan tabel kartu terdaftar menggunakan Prisma ORM. Memastikan kartu berstatus `ACTIVE` dan terikat pada pengguna yang sah.
* **F-BE-03 (Audit Logs):** Menyimpan setiap aktivitas *scanning* ke dalam database, merekam: ID Kartu, Waktu (*Timestamp*), dan Status Akses (`SUCCESS` / `FAILED_UNKNOWN_CARD` / `FAILED_INACTIVE_CARD`).

### 5.3. Modul Integrasi Telegram
* **F-TG-01 (Authorized Notification):** Mengirimkan pesan format terstruktur ke Chat ID target ketika akses diberikan.
* **F-TG-02 (Alert Notification):** Mengirimkan pesan peringatan berwujud tanda bahaya/alert jika ada kartu tidak dikenal atau kartu non-aktif yang mencoba mengakses pintu.

---

## 6. Alur Pengguna & Logika Sistem (User Flow)

### Skenario A: Akses Diterima (Authorized Access)
1.  Pengguna menempelkan kartu RFID terdaftar pada *reader*.
2.  ESP32 membaca UID (contoh: `D3FA82C1`) dan mengirimkan request `POST /api/rfid/verify` dengan body `{"uid": "D3FA82C1"}`.
3.  Server Node.js menerima request, lalu Prisma mengecek database.
4.  Kartu ditemukan terikat pada User "Ahmad Fauzi" dengan status `ACTIVE`.
5.  Server membuat data log baru di database dengan status `SUCCESS`.
6.  Server memanggil Telegram API untuk mengirim notifikasi:
    `✅ AKSES DIBERIKAN: Pintu Utama dibuka oleh Ahmad Fauzi [Staff] pada 13/06/2026 21:00 WIB.`
7.  Server mengirimkan respon HTTP status `200 OK` ke ESP32.
8.  ESP32 menerima respon sukses, mengaktifkan relay selama 5 detik, pintu terbuka, lalu mengunci kembali.

### Skenario B: Akses Ditolak (Unauthorized Access)
1.  Seseorang menempelkan kartu asing/tidak terdaftar pada *reader*.
2.  ESP32 mengirimkan request `POST /api/rfid/verify` berisi UID kartu tersebut.
3.  Server Node.js memeriksa database melalui Prisma, dan hasil pencarian menghasilkan `null` (tidak ditemukan).
4.  Server membuat data log baru di database dengan status `FAILED_UNKNOWN_CARD`.
5.  Server memanggil Telegram API untuk mengirim notifikasi peringatan:
    `⚠️ PERINGATAN KEAMANAN: Percobaan masuk ilegal terdeteksi! Kartu Tidak Dikenal (UID: 99B1A2C3) mencoba membuka pintu pada 13/06/2026 21:02 WIB.`
6.  Server mengirimkan respon HTTP status `401 Unauthorized` ke ESP32.
7.  ESP32 menerima respon gagal, mempertahankan kondisi relay tetap mati (pintu tetap terkunci), dan membunyikan buzzer peringatan.

---

## 7. Desain Database & API Endpoints

### 7.1. Skema Database (Prisma Model Concept)
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id        String   @id @default(uuid())
  name      String
  role      String   // Contoh: Admin, Staff, Guest
  cards     Card[]
  createdAt DateTime @default(now())
}

model Card {
  id        String      @id @default(uuid())
  uid       String      @unique // ID Unik dari Kartu fisik RFID
  status    CardStatus  @default(ACTIVE)
  user      User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String
  logs      AccessLog[]
  createdAt DateTime    @default(now())
}

model AccessLog {
  id        String    @id @default(uuid())
  cardUid   String
  card      Card?     @relation(fields: [cardUid], references: [uid], onDelete: SetNull)
  status    LogStatus
  timestamp DateTime  @default(now())
}

enum CardStatus {
  ACTIVE
  INACTIVE
  BLOCKED
}

enum LogStatus {
  SUCCESS
  FAILED_UNKNOWN_CARD
  FAILED_INACTIVE_CARD
}

###7.2. Spesifikasi API Endpoint Utama
URL: /api/rfid/verify

Method: POST

Content-Type: application/json

Request Body:
{
  "uid": "A1B2C3D4"
}

Response Sukses (200 OK):

JSON
{
  "authorized": true,
  "message": "Access granted",
  "user": "Ahmad Fauzi"
}
Response Gagal (401 Unauthorized):

JSON
{
  "authorized": false,
  "message": "Access denied. Card not recognized or inactive."
}
8. Penanganan Kegagalan (Error Handling & Edge Cases)
Koneksi WiFi Terputus: Jika ESP32 tidak dapat terhubung ke internet, ia harus mendeteksi kegagalan jaringan dan memberikan indikator (misal: LED Merah berkedip cepat). Pintu tetap dalam kondisi terkunci demi keamanan fisik.

Server Backend Down: Jika server tidak mengembalikan respon (Timeout), ESP32 harus menganggap akses ditolak (Timeout handling) dan menjaga pintu tetap terkunci.

Spamming Kartu: Sistem harus memiliki delay pembacaan (debounce) sekitar 2-3 detik setelah kartu ditempelkan agar tidak mengirimkan request berulang-ulang ke server untuk kartu yang sama dalam satu waktu dekat.
"""

file_name = "prd_sistem_rfid_door.md"
with open(file_name, "w", encoding="utf-8") as f:
f.write(prd_content.strip())

print(f"File {file_name} berhasil dibuat.")

File Markdown (.md) untuk PRD Sistem RFID Door Anda telah siap. 
[file-tag: code-generated-file-0-1781359135085265787]

Dokumen ini berisi arsitektur sistem berbasis Node.js yang kita sepakati, skema database Prisma untuk mencatat log, *flow* pengguna, serta spesifikasi *endpoint* API untuk perangkat ESP32 Anda. Silakan unduh dan gunakan file ini sebagai panduan teknis pengembangan sistem akses pintar Anda.