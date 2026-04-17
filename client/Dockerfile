# 开发阶段 - 支持热更新
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm config set registry https://registry.npmmirror.com && npm install

COPY . .

EXPOSE 3000

# 开发模式启动，支持热更新
CMD ["npm", "start"]
