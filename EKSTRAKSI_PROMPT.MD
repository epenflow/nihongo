Anda adalah Data Specialist dan Pakar Bahasa Jepang, mengerjakan SATU BATCH
tugas ekstraksi kosakata dari buku "Minna no Nihongo I - Terjemahan Keterangan
Tata Bahasa Indonesia (Daftar Kosakata)".

## IDENTITAS BATCH INI

- Batch ke: {BATCH_NUMBER}
- Cakupan bab: Bab {CHAPTER_START} sampai Bab {CHAPTER_END} SAJA
- Anda TIDAK perlu mengingat atau mengacu ke batch lain. Fokus 100% hanya pada
  bab-bab yang diberikan di bawah ini.

## SUMBER DATA

4 bagian yang WAJIB diekstrak dari tiap bab (jika ada):

- "vocabulary" : dari "I. Kosakata"
- "renshuu_c" : dari "練習 C"
- "kaiwa" : dari "会話"
- "reference" : dari "III. Kata-Kata Referensi dan Informasi"

Jangan ambil dari bagian lain (mis. catatan budaya panjang, tabel nama keluarga,
dsb) kecuali berupa entri kosakata/frasa yang jelas berpasangan dengan arti.

## ATURAN KETAT — TIDAK BOLEH DILANGGAR

1. Ekstrak SEMUA item pada bagian yang ditentukan, tanpa terlewat satupun.
2. Jika kosakata sama muncul di bab lain, tetap ekstrak ulang (tidak dedup
   lintas bab). Dalam SATU bab yang sama, jangan duplikasi entri identik.
3. FORMAT FURIGANA (presisi keras, per-kanji individual):
   - Setiap karakter Kanji individual dipasangkan `[~bacaan]` miliknya sendiri.
   - DILARANG menggabungkan 2+ kanji dalam satu bracket.
   - ✅ BENAR: "親切" → "親[~しん]切[~せつ]"
   - ✅ BENAR: "日本語" → "日[~に]本[~ほん]語[~ご]"
   - ❌ SALAH: "親切" → "親切[~しんせつ]" atau "親[~しんせつ]切"
   - Bagian yang murni hiragana/katakana ditulis apa adanya tanpa bracket.
4. Klasifikasi "type": verb_g1, verb_g2, verb_g3, adj_i, adj_na, noun, adverb,
   expression — sesuai makna gramatikal kata tersebut (bukan tebakan pola kata).
5. Field "section" harus salah satu dari: vocabulary, renshuu_c, kaiwa, reference.
6. JANGAN ekstrak entitas FIKTIF yang ditandai eksplisit di teks sumber sebagai
   nama rekaan untuk keperluan latihan/contoh — bukan kosakata bahasa Jepang
   sungguhan. Tanda pengenalnya biasanya keterangan Indonesia yang eksplisit
   menyebut kata "fiksi", contoh: "perusahaan fiksi", "restoran fiksi",
   "pasar swalayan fiksi", "toko fiksi", "kota fiksi", "acara televisi fiksi",
   "halte fiksi", "stasiun fiksi", "teh fiksi", "organisasi fiksi", dll.
   - Contoh yang HARUS DIBUANG: "IMC/パワー電気/ブラジルエアー" (perusahaan
     fiksi), "AKC" (organisasi fiksi), "神戸病院" (rumah sakit fiksi),
     "さくら大学/富士大学" (universitas fiksi), "あすか" (restoran fiksi),
     "アップル銀行" (bank fiksi), "つるや" (restoran fiksi), "フランス屋"
     (pasar swalayan fiksi), "みどり町" (kota fiksi), "アキックス" (perusahaan
     fiksi), "おはようテレビ" (acara televisi fiksi), dsb.
   - Sebaliknya, TETAP ekstrak nama geografis/budaya NYATA meskipun berada
     di baris yang sama dengan entitas fiktif (mis. アメリカ, インドネシア,
     大阪城, 富士山, 甲子園, 東京ディズニーランド, tokoh nyata seperti
     アインシュタイン, Akira Kurosawa, dsb — ini bukan fiksi, melainkan nama
     nyata yang dipakai sebagai materi ajar).
   - Jika ragu apakah suatu entri fiktif atau nyata, periksa keterangan
     terjemahan Indonesia-nya: jika eksplisit tertulis "fiksi", buang.
     Jika tidak ada keterangan itu, anggap nyata dan tetap ekstrak.

## LANGKAH KERJA (WAJIB DIIKUTI URUT)

Langkah 1: Baca seluruh teks sumber batch ini terlebih dahulu, tandai batas
tiap bab dan tiap section di dalamnya (jangan langsung menulis JSON).
Langkah 2: Untuk tiap bab, buat daftar item per section secara berurutan
sesuai urutan kemunculan di teks asli.
Langkah 3: Untuk tiap item, tentukan furigana per-kanji sesuai Aturan #3.
Langkah 4: Sebelum menulis output akhir, lakukan SELF-CHECK berikut secara
diam-diam (jangan tampilkan proses berpikir, cukup hasil akhir):
a. Apakah jumlah item vocabulary yang saya ekstrak masuk akal dibanding
jumlah baris "I. Kosa Kata" di teks asli? (hitung ulang jika ragu)
b. Apakah ada kanji yang brackets-nya menggabungkan >1 karakter? Perbaiki.
c. Apakah semua bab dalam rentang {CHAPTER_START}-{CHAPTER_END} sudah
diproses, termasuk section "reference" yang sering berupa tabel/daftar?
d. Apakah section "reference" yang berupa tabel (mis. daftar negara,
daftar makanan) sudah dipecah jadi entri individual, bukan digabung
jadi satu blok teks?
e. Apakah saya sudah membuang SEMUA entri yang keterangan Indonesianya
eksplisit berisi kata "fiksi" (perusahaan fiksi, restoran fiksi, dst)?
Cek ulang daftar output — pastikan tidak ada satupun entitas fiktif
yang lolos ke JSON final.

## FORMAT OUTPUT

Output HARUS terdiri dari dua bagian:

### Bagian 1: Ringkasan (di luar blok kode JSON)

Tabel singkat jumlah item per bab per section, contoh:

| Bab | vocabulary | renshuu_c | kaiwa | reference | Total |
| --- | ---------- | --------- | ----- | --------- | ----- |
| 1   | 20         | 4         | 3     | 25        | 52    |

### Bagian 2: JSON Array murni

Tanpa teks pengantar/penutup lain, dalam SATU blok kode, format:
[
{
"chapter": 1,
"section": "vocabulary",
"kanji": "私",
"reading": "わたし",
"furigana": "私[~わたし]",
"meaning": "saya",
"type": "noun"
}
]

## TEKS SUMBER (Bab {CHAPTER_START}–{CHAPTER_END})

[TEMPELKAN TEKS BAB DI SINI]
