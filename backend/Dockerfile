FROM node:20-bookworm
WORKDIR /app

# Copia arquivos de dependência
COPY package*.json ./

# Instalação limpa das dependências
RUN npm ci

# Copia o código fonte
COPY . .

# Roda o build e mostra se deu erro
RUN npm run build

# Porta
EXPOSE 4000
ENV PORT=4000

CMD ["node", "dist/index.js"]
