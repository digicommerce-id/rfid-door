#include <Adafruit_Fingerprint.h>

HardwareSerial mySerial(2);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&mySerial);

uint8_t id;

void setup() {
  Serial.begin(9600);
  while (!Serial);  // For Yun/Leo/Micro/Zero/...
  delay(100);
  Serial.println("\n\nSistem Pendaftaran Sidik Jari (Enrollment)");

  // set the data rate for the sensor serial port
  finger.begin(57600);

  if (finger.verifyPassword()) {
    Serial.println("Sensor sidik jari ditemukan!");
  } else {
    Serial.println("Sensor tidak ditemukan. Periksa kabel TX/RX!");
    while (1) { delay(1); }
  }

  Serial.println(F("Membaca parameter sensor..."));
  finger.getParameters();
  Serial.print(F("Status: 0x")); Serial.println(finger.status_reg, HEX);
  Serial.print(F("Sys ID: 0x")); Serial.println(finger.system_id, HEX);
  Serial.print(F("Capacity: ")); Serial.println(finger.capacity);
  Serial.print(F("Security level: ")); Serial.println(finger.security_level);
  Serial.print(F("Device address: ")); Serial.println(finger.device_addr, HEX);
  Serial.print(F("Packet len: ")); Serial.println(finger.packet_len);
  Serial.print(F("Baud rate: ")); Serial.println(finger.baud_rate);
}

uint8_t readnumber(void) {
  uint8_t num = 0;
  while (num == 0) {
    while (! Serial.available());
    num = Serial.parseInt();
  }
  return num;
}

void loop() {
  Serial.println("Siap mendaftar sidik jari!");
  Serial.println("Ketikkan ID (angka 1 sampai 127) yang ingin Anda daftarkan di Serial Monitor, lalu tekan Enter...");
  id = readnumber();
  if (id == 0) {// ID #0 not allowed, try again!
     return;
  }
  Serial.print("Mendaftar untuk ID #");
  Serial.println(id);

  while (!  getFingerprintEnroll() );
}

uint8_t getFingerprintEnroll() {

  int p = -1;
  Serial.print("Tunggu... Tempelkan jari Anda ke sensor untuk ID #"); Serial.println(id);
  while (p != FINGERPRINT_OK) {
    p = finger.getImage();
    switch (p) {
    case FINGERPRINT_OK:
      Serial.println("Sidik jari berhasil diambil!");
      break;
    case FINGERPRINT_NOFINGER:
      Serial.print(".");
      delay(200);
      break;
    case FINGERPRINT_PACKETRECIEVEERR:
      Serial.println("Error komunikasi");
      break;
    case FINGERPRINT_IMAGEFAIL:
      Serial.println("Error membaca gambar");
      break;
    default:
      Serial.println("Unknown error");
      break;
    }
  }

  // OK success!

  p = finger.image2Tz(1);
  switch (p) {
    case FINGERPRINT_OK:
      Serial.println("Gambar diubah ke model");
      break;
    case FINGERPRINT_IMAGEMESS:
      Serial.println("Gambar terlalu berantakan");
      return p;
    case FINGERPRINT_PACKETRECIEVEERR:
      Serial.println("Error komunikasi");
      return p;
    case FINGERPRINT_FEATUREFAIL:
      Serial.println("Tidak bisa menemukan fitur sidik jari");
      return p;
    case FINGERPRINT_INVALIDIMAGE:
      Serial.println("Tidak bisa menemukan fitur sidik jari");
      return p;
    default:
      Serial.println("Unknown error");
      return p;
  }

  Serial.println("Silakan ANGKAT JARI Anda dari sensor.");
  delay(2000);
  p = 0;
  while (p != FINGERPRINT_NOFINGER) {
    p = finger.getImage();
  }
  Serial.print("ID "); Serial.println(id);
  p = -1;
  Serial.println("Sekarang, TEMPELKAN LAGI jari yang SAMA ke sensor...");
  while (p != FINGERPRINT_OK) {
    p = finger.getImage();
    switch (p) {
    case FINGERPRINT_OK:
      Serial.println("Sidik jari berhasil diambil!");
      break;
    case FINGERPRINT_NOFINGER:
      Serial.print(".");
      delay(200);
      break;
    case FINGERPRINT_PACKETRECIEVEERR:
      Serial.println("Error komunikasi");
      break;
    case FINGERPRINT_IMAGEFAIL:
      Serial.println("Error membaca gambar");
      break;
    default:
      Serial.println("Unknown error");
      break;
    }
  }

  // OK success!

  p = finger.image2Tz(2);
  switch (p) {
    case FINGERPRINT_OK:
      Serial.println("Gambar diubah ke model");
      break;
    case FINGERPRINT_IMAGEMESS:
      Serial.println("Gambar terlalu berantakan");
      return p;
    case FINGERPRINT_PACKETRECIEVEERR:
      Serial.println("Error komunikasi");
      return p;
    case FINGERPRINT_FEATUREFAIL:
      Serial.println("Tidak bisa menemukan fitur sidik jari");
      return p;
    case FINGERPRINT_INVALIDIMAGE:
      Serial.println("Tidak bisa menemukan fitur sidik jari");
      return p;
    default:
      Serial.println("Unknown error");
      return p;
  }

  // OK converted!
  Serial.print("Mencocokkan kedua gambar untuk ID #");  Serial.println(id);
  p = finger.createModel();
  if (p == FINGERPRINT_OK) {
    Serial.println("Kedua sidik jari COCOK!");
  } else if (p == FINGERPRINT_PACKETRECIEVEERR) {
    Serial.println("Error komunikasi");
    return p;
  } else if (p == FINGERPRINT_ENROLLMISMATCH) {
    Serial.println("Sidik jari TIDAK COCOK. Ulangi lagi.");
    return p;
  } else {
    Serial.println("Unknown error");
    return p;
  }

  Serial.print("Menyimpan model ke slot #");  Serial.println(id);
  p = finger.storeModel(id);
  if (p == FINGERPRINT_OK) {
    Serial.println("BERHASIL DISIMPAN!");
  } else if (p == FINGERPRINT_PACKETRECIEVEERR) {
    Serial.println("Error komunikasi");
    return p;
  } else if (p == FINGERPRINT_BADLOCATION) {
    Serial.println("Tidak bisa menyimpan di lokasi tersebut");
    return p;
  } else if (p == FINGERPRINT_FLASHERR) {
    Serial.println("Error menulis ke flash");
    return p;
  } else {
    Serial.println("Unknown error");
    return p;
  }

  return true;
}
