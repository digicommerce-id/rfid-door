#include <HTTPClient.h>
#include <LiquidCrystal.h>
#include <MFRC522.h>
#include <SPI.h>
#include <WiFi.h>
#include <Adafruit_Fingerprint.h>

// Konfigurasi WiFi
const char *ssid = "GPSKU";
const char *password = "Masuk#2024";

// Konfigurasi Backend Node.js
// IP Laptop Anda saat ini: 192.168.100.174
const char *serverUrl = "https://rfid-door-one.vercel.app/api/rfid/verify";
const char *serverUrlFingerprint = "https://rfid-door-one.vercel.app/api/rfid/fingerprint/verify";

// Konfigurasi Pin RFID & Aktuator
/* 
 * Panduan Wiring RFID RC522 ke ESP32:
 * SDA  -> GPIO 21 (Ini adalah pin SS_PIN)
 * SCK  -> GPIO 18
 * MOSI -> GPIO 23
 * MISO -> GPIO 19
 * IRQ  -> (Tidak usah disambung)
 * GND  -> GND
 * RST  -> GPIO 22
 * 3.3V -> 3.3V (AWAS: Jangan ke 5V atau VIN!)
 */
#define RST_PIN 22
#define SS_PIN 21
#define RELAY_PIN 15
#define BUZZER_PIN 4
#define LED_SUCCESS 2
#define LED_ERROR 5

/*

 * Konfigurasi Pin LCD 16x2 (Tanpa I2C)
 *
 * Panduan Wiring LCD ke ESP32:
 * 1 (VSS)  -> GND
 * 2 (VDD)  -> 5V (atau VIN di ESP32)
 * 3 (V0)   -> Potensiometer (untuk kontras teks)
 * 4 (RS)   -> GPIO 32
 * 5 (RW)   -> GND
 * 6 (E)    -> GPIO 33
 * 11 (D4)  -> GPIO 25
 * 12 (D5)  -> GPIO 26
 * 13 (D6)  -> GPIO 27
 * 14 (D7)  -> GPIO 14
 * 15 (A)   -> 3.3V atau 5V (Backlight)
 * 16 (K)   -> GND
 */
const int rs = 32, en = 33, d4 = 25, d5 = 26, d6 = 27, d7 = 14;
LiquidCrystal lcd(rs, en, d4, d5, d6, d7);

MFRC522 mfrc522(SS_PIN, RST_PIN);

// Inisialisasi Fingerprint menggunakan HardwareSerial 2 (Pin 16 dan 17)
HardwareSerial mySerial(2);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&mySerial);

unsigned long lastReadTime = 0;
const unsigned long DEBOUNCE_DELAY = 3000; // 3 detik

void setup() {
  Serial.begin(9600);

  // Inisialisasi LCD
  lcd.begin(16, 2);
  lcd.clear();
  lcd.print("Memulai Sistem..");

  // Setup Pin Mode
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_SUCCESS, OUTPUT);
  pinMode(LED_ERROR, OUTPUT);

  // Kondisi awal
  digitalWrite(RELAY_PIN, LOW); // Anggap LOW = Terkunci
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_SUCCESS, LOW);
  digitalWrite(LED_ERROR, LOW);

  // Koneksi WiFi
  WiFi.begin(ssid, password);
  Serial.print("Menghubungkan ke WiFi");
  lcd.setCursor(0, 1);
  lcd.print("Koneksi WiFi...");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nTerhubung ke WiFi!");
  lcd.clear();
  lcd.print("WiFi Terhubung!");
  delay(1000);

  // Inisialisasi SPI dan RFID
  SPI.begin(18, 19, 23, 21); // (SCK, MISO, MOSI, SS) Paksa gunakan pin ini
  mfrc522.PCD_Init();
  delay(50); // Beri waktu ekstra untuk MFRC522 bangun
  mfrc522.PCD_DumpVersionToSerial(); // <--- TAMBAHAN UNTUK DIAGNOSA

  // Inisialisasi Sidik Jari
  finger.begin(57600);
  delay(5);
  if (finger.verifyPassword()) {
    Serial.println("Fingerprint sensor ditemukan!");
  } else {
    Serial.println("Fingerprint sensor TIDAK ditemukan :(");
  }

  Serial.println("Sistem Siap. Dekatkan kartu RFID atau Sidik Jari...");
  
  // Bunyi Bip 2x sebagai tanda mesin sudah nyala dan siap dipakai (Tanpa Laptop)
  digitalWrite(BUZZER_PIN, HIGH);
  delay(100);
  digitalWrite(BUZZER_PIN, LOW);
  delay(100);
  digitalWrite(BUZZER_PIN, HIGH);
  delay(100);
  digitalWrite(BUZZER_PIN, LOW);

  displayReady();
}

void loop() {
  // 1. Cek Sidik Jari
  int fingerId = getFingerprintIDez();
  if (fingerId != -1) {
    if (millis() - lastReadTime < DEBOUNCE_DELAY) return;
    lastReadTime = millis();
    
    Serial.println("Sidik Jari Terbaca ID: " + String(fingerId));
    lcd.clear();
    lcd.print("Memproses Jari..");
    lcd.setCursor(0, 1);
    lcd.print("ID: " + String(fingerId));
    
    verifyFingerprint(fingerId);
    displayReady();
    return;
  }

  // 2. Cek apakah ada kartu baru
  if (!mfrc522.PICC_IsNewCardPresent() || !mfrc522.PICC_ReadCardSerial()) {
    delay(50);
    return;
  }

  // Debounce (hindari spamming)
  if (millis() - lastReadTime < DEBOUNCE_DELAY) {
    mfrc522.PICC_HaltA();
    return;
  }
  lastReadTime = millis();

  // Dapatkan UID kartu
  String uidString = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    uidString += String(mfrc522.uid.uidByte[i] < 0x10 ? "0" : "");
    uidString += String(mfrc522.uid.uidByte[i], HEX);
  }
  uidString.toUpperCase();

  Serial.println("UID Kartu: " + uidString);

  lcd.clear();
  lcd.print("Memproses Kartu.");
  lcd.setCursor(0, 1);
  lcd.print("UID: " + uidString);

  // Kirim data ke server
  verifyCard(uidString);

  // Halt PICC
  mfrc522.PICC_HaltA();

  // Kembali ke status siap
  displayReady();
}

void verifyCard(String uid) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    String jsonPayload = "{\"uid\":\"" + uid + "\"}";
    int httpResponseCode = http.POST(jsonPayload);

    if (httpResponseCode == 200) {
      Serial.println("Akses Diberikan!");
      openDoor();
    } else {
      Serial.print("Akses Ditolak! Kode HTTP: ");
      Serial.println(httpResponseCode);
      accessDenied(httpResponseCode);
    }

    http.end();
  } else {
    Serial.println("Error: Tidak ada koneksi WiFi!");
    lcd.clear();
    lcd.print("Error:");
    lcd.setCursor(0, 1);
    lcd.print("WiFi Terputus!");

    digitalWrite(LED_ERROR, HIGH);
    delay(2000);
    digitalWrite(LED_ERROR, LOW);
  }
}

void openDoor() {
  lcd.clear();
  lcd.print("Akses Diberikan");
  lcd.setCursor(0, 1);
  lcd.print("Pintu Terbuka!");

  digitalWrite(LED_SUCCESS, HIGH);

  // Bip 1x panjang
  digitalWrite(BUZZER_PIN, HIGH);
  delay(500);
  digitalWrite(BUZZER_PIN, LOW);

  // Aktifkan relay untuk membuka pintu
  digitalWrite(RELAY_PIN, HIGH);

  // Tunggu 5 detik sesuai PRD
  delay(5000);

  // Kunci kembali pintu
  digitalWrite(RELAY_PIN, LOW);
  digitalWrite(LED_SUCCESS, LOW);
  Serial.println("Pintu Terkunci kembali.");
}

void accessDenied(int errorCode) {
  lcd.clear();
  lcd.print("Akses Ditolak!");
  lcd.setCursor(0, 1);
  if (errorCode == 401) {
    lcd.print("Kartu Invalid");
  } else {
    lcd.print("Error DB/Server");
  }

  digitalWrite(LED_ERROR, HIGH);

  // Bip 3x cepat
  for (int i = 0; i < 3; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(150);
    digitalWrite(BUZZER_PIN, LOW);
    delay(150);
  }

  delay(2000);
  digitalWrite(LED_ERROR, LOW);
}

void displayReady() {
  lcd.clear();
  lcd.print("Sistem Siap");
  lcd.setCursor(0, 1);
  lcd.print("Kartu / Jari   ");
}

int getFingerprintIDez() {
  uint8_t p = finger.getImage();
  if (p != FINGERPRINT_OK)  return -1;

  p = finger.image2Tz();
  if (p != FINGERPRINT_OK)  return -1;

  p = finger.fingerFastSearch();
  if (p != FINGERPRINT_OK)  return -1;

  // found a match!
  return finger.fingerID;
}

void verifyFingerprint(int fingerId) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrlFingerprint);
    http.addHeader("Content-Type", "application/json");

    String jsonPayload = "{\"fingerId\":" + String(fingerId) + "}";

    Serial.println("Mengirim data ke: " + String(serverUrlFingerprint));
    Serial.println("Payload: " + jsonPayload);

    int httpResponseCode = http.POST(jsonPayload);

    if (httpResponseCode == 200) {
      Serial.println("Akses Diberikan!");
      openDoor();
    } else {
      Serial.print("Akses Ditolak! Kode HTTP: ");
      Serial.println(httpResponseCode);
      accessDenied(httpResponseCode);
    }

    http.end();
  } else {
    Serial.println("Error: Tidak ada koneksi WiFi!");
    lcd.clear();
    lcd.print("Error:");
    lcd.setCursor(0, 1);
    lcd.print("WiFi Terputus!");

    digitalWrite(LED_ERROR, HIGH);
    delay(2000);
    digitalWrite(LED_ERROR, LOW);
  }
}
