# Türkçe RAG Sistemi Optimizasyonları

Bu dokümanda Türkçe PDF dokümanlarla daha iyi bağlam kurabilmek için yapılan optimizasyonlar açıklanmaktadır.

## 🔧 Yapılan Değişiklikler

### 1. Embedding Modeli Değişikliği ⭐ (EN KRİTİK)
**Önceki:** `Xenova/all-MiniLM-L6-v2` (İngilizce odaklı)
**Yeni:** `Xenova/paraphrase-multilingual-MiniLM-L12-v2` (Çok dilli, Türkçe destekli)

**Etkilenen dosyalar:**
- `backend/src/services/rag.service.js`
- `backend/src/services/ingest.service.js`

### 2. Search Parametreleri Optimizasyonu
**Önceki:**
- `limit: 5`
- `score_threshold: 0.9`

**Yeni:**
- `limit: 8` (Daha fazla sonuç)
- `score_threshold: 0.5` (Türkçe için daha düşük eşik)

**Etkilenen dosyalar:**
- `backend/src/services/rag.service.js`

### 3. Text Chunking Optimizasyonu
**Önceki:**
- `chunkSize: 1000`
- `chunkOverlap: 50`
- Varsayılan separators

**Yeni:**
- `chunkSize: 800` (Türkçe için daha küçük chunk)
- `chunkOverlap: 100` (Daha fazla overlap)
- `separators: ["\n\n", "\n", ". ", "! ", "? ", " "]` (Türkçe noktalama)

**Etkilenen dosyalar:**
- `backend/src/services/ingest.service.js`

## 🧪 Test Etme

### Test Scripti Çalıştırma
```bash
cd rag-chat
npm run test-turkish
```

### Manuel Test
1. Mevcut dokümanları yeniden yükleyin (yeni chunking parametreleri için):
```bash
npm run ingest
```

2. Frontend'i başlatın ve Türkçe sorular sorun:
- "Öğrenci işleri nerede?"
- "Kayıt yenileme nasıl yapılır?"
- "Burs başvurusu için gerekli belgeler nelerdir?"

## 📊 Beklenen İyileştirmeler

1. **Daha İyi Anlamsal Eşleştirme:** Çok dilli model Türkçe kelimelerin anlamını daha iyi anlayacak
2. **Daha Fazla Sonuç:** Düşük threshold ve yüksek limit ile daha fazla alakalı sonuç
3. **Daha İyi Bağlam:** Küçük chunk'lar ve fazla overlap ile daha tutarlı bilgi

## 🔍 Performans İzleme

Test sonuçlarında şunlara dikkat edin:
- **Skor değerleri:** 0.3-0.7 arası skorlar normal
- **Yanıt süresi:** Yeni model biraz daha yavaş olabilir
- **Kaynak sayısı:** Daha fazla alakalı kaynak bulunmalı
- **Yanıt kalitesi:** Daha doğru ve bağlamsal yanıtlar

## 🚀 Sonraki Adımlar (İsteğe Bağlı)

Eğer bu değişiklikler yeterli değilse:

1. **Query Preprocessing:** Türkçe karakterleri normalize etme
2. **Hibrit Arama:** Semantic + keyword search kombinasyonu  
3. **Re-ranking:** Sonuçları yeniden sıralama
4. **Custom Embeddings:** Türkçe için özel eğitilmiş model

## 📝 Notlar

- Yeni embedding modeli daha büyük (L12 vs L6), ilk yükleme daha uzun sürebilir
- Model cache'i `.models` klasöründe saklanır
- Mevcut dokümanları yeniden yüklemek gerekebilir
