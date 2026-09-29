FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/
RUN npm install --workspace=@apex/web --workspace=@apex/shared || npm install
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
WORKDIR /app
CMD ["npm", "run", "dev", "--workspace=@apex/web"]
