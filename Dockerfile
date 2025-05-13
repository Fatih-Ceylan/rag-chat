# Node.js 18 slim imajını kullan
FROM node:18-slim

# Çalışma dizinini oluştur
WORKDIR /usr/src/app


# Package dosyalarını kopyala
COPY package*.json ./

# Bağımlılıkları yükle
RUN npm install

# Uygulama kodunu kopyala
COPY . .

# 4000 portunu dışarı aç
EXPOSE 4000


# Uygulamayı başlat
CMD ["node", "server.js"] 