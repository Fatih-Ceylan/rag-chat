# RAG Chat - Türkçe Üniversite Doküman Soru-Cevap Sistemi

Bu proje, üniversite PDF dokümanlarını kullanarak Türkçe soru-cevap sistemi sağlayan bir RAG (Retrieval-Augmented Generation) uygulamasıdır.

## 🚀 Özellikler

- **Türkçe Optimizasyonu**: Çok dilli embedding modeli ile Türkçe dokümanlar için optimize edilmiş
- **Üniversite Bazlı Chat**: Her üniversite için ayrı chat geçmişi
- **PDF Görüntüleme**: PDF dosyalarını browser'da açma
- **Akıllı Arama**: Semantic search ile bağlamsal doküman bulma
- **Modern UI**: React + TypeScript ile geliştirilmiş kullanıcı arayüzü

## 📁 Proje Yapısı

```
rag-chat/
├── backend/src/           # Backend API servisleri
│   ├── server.js         # Ana server (RAG API + PDF Server)
│   └── services/         # RAG ve Ingest servisleri
├── frontend/             # React frontend
│   ├── src/             # React bileşenleri
│   └── public/          # Statik dosyalar
├── documents/           # PDF dokümanları (üniversite bazlı)
├── node_modules/        # Tüm dependencies (tek klasör)
└── package.json         # Tek package.json dosyası
```

## 🛠️ Kurulum

### Gereksinimler
- Node.js >= 18
- Docker (Qdrant için)
- Ollama (LLM için)

### 1. Bağımlılıkları Yükle
```bash
cd rag-chat
npm install
```

### 2. Qdrant Vector Database'i Başlat
```bash
docker run -p 6333:6333 qdrant/qdrant
```

### 3. Ollama'yı Başlat ve Model İndir
```bash
ollama serve
ollama pull gemma3:12b
```

## 🚀 Kullanım

### Backend'i Başlat (RAG API + PDF Server)
```bash
npm start
```
- RAG API: http://localhost:4000
- PDF Server: http://localhost:4002

### Frontend'i Başlat
```bash
npm run dev
```
- Frontend: http://localhost:5174

### PDF Dokümanlarını Yükle
```bash
npm run ingest
```

## 📚 API Endpoints

### RAG API (Port 4000)
- `GET /api/documents/list?university=<id>` - PDF listesi
- `POST /api/documents/upload` - PDF yükleme
- `POST /api/ask` - Soru-cevap

### PDF Server (Port 4002)
- `GET /api/documents/pdf/:university/:filename` - PDF görüntüleme

## 🎯 Kullanım Adımları

1. **Üniversite Seç**: Frontend'te üniversite seçin
2. **PDF Yükle**: "Upload Documents" ile PDF'leri yükleyin
3. **Soru Sor**: Chat alanında Türkçe sorular sorun
4. **PDF Aç**: Yüklü PDF'lere tıklayarak açın

## 🔧 Teknik Detaylar

### Embedding Modeli
- **Model**: `Xenova/paraphrase-multilingual-MiniLM-L12-v2`
- **Özellik**: Türkçe destekli çok dilli model

### Text Chunking
- **Chunk Size**: 800 karakter
- **Overlap**: 100 karakter
- **Separators**: Türkçe noktalama işaretleri

### Search Parametreleri
- **Limit**: 8 sonuç
- **Score Threshold**: 0.5 (Türkçe için optimize)

## 📦 Scripts

```bash
npm start          # Backend'i başlat
npm run dev        # Frontend'i başlat
npm run build      # Frontend'i build et
npm run ingest     # PDF'leri yükle
npm run preview    # Build preview
```

## 🏗️ Geliştirme

Proje tek workspace olarak yapılandırılmıştır:
- Tek `package.json` ve `node_modules`
- Backend ve frontend aynı dependency pool'u kullanır
- Vite config ana dizinde
- ESLint kaldırıldı (basitlik için)

## 📄 Lisans

MIT License
