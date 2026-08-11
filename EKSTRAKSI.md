Bertindaklah sebagai Data Specialist dan Pakar Bahasa Jepang. Saya akan memberikan teks hasil ekstraksi/copy-paste dari dokumen PDF "Minna no Nihongo I - Terjemahan Keterangan Tata Bahasa Indonesia (Daftar Kosakata)"

## "Minna no Nihongo I - Terjemahan Keterangan Tata Bahasa Indonesia (Daftar Kosakata)" (Bab 1 sampai Bab 25).

Tugas Anda adalah membaca teks yang saya berikan, mengekstrak seluruh kosakata, ungkapan, dan frasa tanpa ada yang terlewat pada setiap babnya, lalu mengonversinya menjadi format JSON array sesuai skema di bawah ini.

### TARGET EKSTRAKSI KETAT & KELENGKAPAN DATA:

1. Anda **TIDAK BOLEH** menghilangkan atau melewatkan satu pun kosakata, ungkapan, atau frasa yang terdapat di dalam target bab yang diberikan.
2. Ekstraksi harus dilakukan secara komprehensif per bab. Jika sebuah kosakata muncul kembali di bab yang berbeda (duplikasi antar bab, misalnya kata "Belajar" muncul di Bab 4 dan muncul lagi di Bab 10), **kosakata tersebut WAJIB diekstrak kembali** sesuai bab tempatnya muncul. Jangan melakukan deduplikasi atau menghapus data yang sama jika muncul di bab yang berbeda, karena struktur website membutuhkan data yang lengkap di setiap babnya.
3. Anda HANYA boleh mengekstrak data yang berasal dari 4 bagian berikut dari setiap bab:

- I. Kosakata (I. 単語)
- 練習 C (Renshuu C)
- 会話 (Kaiwa)
- III. Kata-Kata Referensi dan Informasi (III. 参考言葉と情報)

4. Teks akan diberikan secara bertahap (5 Bab per respons/proses).

---

### ATURAN EKSTRAKSI:

1. TIPE BAGIAN (section):
   Tandai dari bagian mana item tersebut berasal menggunakan kode berikut:

- "vocabulary" : Dari bagian "I. Kosakata"
- "renshuu_c" : Dari bagian "練習 C"
- "kaiwa" : Dari bagian "会話"
- "reference" : Dari bagian "III. Kata-Kata Referensi dan Informasi"

2. KATEGORI KATA (type):
   Klasifikasikan setiap kata ke dalam salah satu kode berikut:

- "verb_g1" : Kata Kerja Golongan 1 (Kelompok I / 五段)
- "verb_g2" : Kata Kerja Golongan 2 (Kelompok II / 一段)
- "verb_g3" : Kata Kerja Golongan 3 (Kelompok III / 不規則: きます & します)
- "adj_i" : Kata Sifat -i (い形容詞)
- "adj_na" : Kata Sifat -na (な形容詞)
- "noun" : Kata Benda (名詞)
- "adverb" : Kata Keterangan (副詞)
- "expression" : Ungkapan / Frasa Sehari-hari / Salam / Kalimat Percakapan

3. FORMAT FURIGANA (PRESISI KERAS - PER KANJI):

- Pasangkan cara baca Hiragana/Katakana `[~ ]` tepat di belakang **MASING-MASING KARAKTER KANJI** secara individual (satu per satu Kanji).
- ATURAN PENTING: Jangan menggabungkan dua atau lebih Kanji dalam satu tanda kurung siku `[~ ]`.
- ❌ SALAH: "親切" -> "親切[~しんせつ]" ATAU "親[~しんせつ]切"
- ❌ SALAH: "日本語" -> "日本[~にほん]語[~ご]" ATAU "日本語[~にほんご]"
- ✅ BENAR: "親切" -> "親[~しん]切[~せつ]"
- ✅ BENAR: "日本語" -> "日[~に]本[ほん]語[~ご]"
- ✅ BENAR: "行きます" -> "行[~い]きます"
- ✅ BENAR: "初めまして" -> "初[~はじめ]まして"

- Jika bagian kata berupa Hiragana/Katakana asli tanpa Kanji, tulis apa adanya tanpa tanda `[~ ]`.

4. STRUKTUR JSON:
   Hasilkan output MURNI dalam bentuk JSON Array tanpa teks pengantar, penutup, atau deskripsi di luar blok kode JSON. Format objeknya:
   [
   {
   "chapter": 1,
   "section": "vocabulary",
   "kanji": "私",
   "reading": "わたし",
   "furigana": "私[~わたし]",
   "meaning": "saya",
   "type": "noun"
   },
   {
   "chapter": 1,
   "section": "renshuu_c",
   "kanji": "お名前は？",
   "reading": "おなまえは？",
   "furigana": "お名[~な]前[~まえ]は？",
   "meaning": "Siapa nama Anda?",
   "type": "expression"
   },
   {
   "chapter": 1,
   "section": "kaiwa",
   "kanji": "初めまして",
   "reading": "はじめまして",
   "furigana": "初[~はじめ]まして",
   "meaning": "salam kenal / perkenalkan",
   "type": "expression"
   },
   {
   "chapter": 1,
   "section": "reference",
   "kanji": "自動車",
   "reading": "じどうしゃ",
   "furigana": "自[~じ]動[~どう]車[~しゃ]",
   "meaning": "mobil",
   "type": "noun"
   }
   ]
