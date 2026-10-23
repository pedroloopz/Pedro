FROM node:22-bookworm-slim

# ffmpeg, fonte japonesa (legendas gravadas), fuso horário e git (coletor de guia, opcional)
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg fonts-noto-cjk tzdata git ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json server.js atualizar.js channels.json fontes.json config.json ./
COPY lib ./lib
COPY public ./public

# tudo que é seu (configuração, mídia, biblioteca, dados) fica no volume /dados
ENV IPTV_RAIZ=/dados PORT=8080 TZ=America/Sao_Paulo
VOLUME /dados
EXPOSE 8080

HEALTHCHECK --interval=60s --timeout=5s --start-period=30s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/saude').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
