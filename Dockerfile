FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm config set registry https://registry.npmmirror.com && \
    npm install && \
    npm install -g nodemon

RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories && \
    apk add --no-cache \
    docker-cli \
    tesseract-ocr \
    tesseract-ocr-data-chi_sim \
    tesseract-ocr-data-eng \
    poppler-utils \
    python3 \
    py3-pip && \
    pip3 install edge-tts --break-system-packages

COPY . .

RUN mkdir -p uploads public/audio public/tts

EXPOSE 3001

CMD ["nodemon", "server.js"]
