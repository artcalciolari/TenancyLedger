# Estágio 1: Builder - Instala dependências e compila o código
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Estágio 2: Production - Copia os artefatos para uma imagem limpa
FROM node:20-alpine
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
CMD ["node", "dist/main"]