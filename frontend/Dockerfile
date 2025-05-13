# Node.js 18 slim imajını kullan
FROM node:18-slim

# Çalışma dizinini oluştur
WORKDIR /app

# Package dosyalarını kopyala
COPY package*.json ./

# Bağımlılıkları yükle
RUN npm install

# Uygulama kodunu kopyala
COPY . .

# 5173 portunu dışarı aç
EXPOSE 5173

# Development sunucusunu başlat
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"] 