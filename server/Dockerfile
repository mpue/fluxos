FROM node:20-alpine

# OpenSSL für Prisma installieren
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Package files kopieren
COPY package*.json ./
COPY prisma ./prisma/

# Dependencies installieren
RUN npm install

# Prisma Client generieren
RUN npx prisma generate

# Source code kopieren
COPY . .

# TypeScript kompilieren
RUN npm run build

# Port exponieren
EXPOSE 5000

# Server starten
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
