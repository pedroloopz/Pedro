# IPTV caseiro

Servidor IPTV feito do zero: transforma vídeos seus, links de transmissão e
sinais de teste em **canais ao vivo** (HLS), com playlist `.m3u`, guia de
programação (EPG/XMLTV) e um player web. Zero dependências npm.

> Use só conteúdo que você tem direito de transmitir (seus vídeos, domínio
> público, streams abertos/licenciados). Retransmitir canais pagos é pirataria
> (Lei 9.610/98).

## Como funciona

```
channels.json ─► server.js ─► ffmpeg (1 por canal, sob demanda) ─► hls/<canal>/index.m3u8 + seg_*.ts
                    │
                    ├─ /                → player web (public/index.html)
                    ├─ /playlist.m3u    → lista para VLC, TiviMate, IPTV Smarters, Kodi
                    ├─ /epg.xml         → guia de programação (XMLTV)
                    ├─ /api/canais      → JSON com os canais
                    └─ /hls/<id>/...    → o vídeo em si
```

- O ffmpeg de um canal só liga quando alguém abre o canal e desliga após
  60 s sem ninguém assistindo (economiza CPU).
- Arquivos tocam em loop infinito, em tempo real — parece TV de verdade.

## Rodar

Pré-requisitos: **Node 18+** e **ffmpeg**.

```bash
# Ubuntu/Debian
sudo apt install ffmpeg nodejs
# macOS
brew install ffmpeg node
# Windows
winget install Gyan.FFmpeg OpenJS.NodeJS.LTS
```

```bash
cd iptv
node server.js
```

Abra `http://localhost:8080` e clique em **Canal Teste** — funciona sem
nenhum vídeo seu.

## Adicionar canais

Edite `channels.json`. Três tipos:

| `tipo`    | `origem`                              | Exemplo de uso                     |
|-----------|---------------------------------------|------------------------------------|
| `teste`   | —                                     | barras coloridas + bipe            |
| `arquivo` | caminho de um vídeo (ex.: `midia/x.mp4`) | seus filmes/vídeos em loop      |
| `url`     | link `http(s)`, `rtmp`, `rtsp`, `.m3u8` | câmera IP, live, outro stream    |

Campos opcionais: `grupo`, `logo` (URL de imagem), `bitrate` (padrão
`2500k`), `copiar: true` (não recodifica — use quando a fonte já é
H.264/AAC; quase zero CPU) e `programacao` (repete todo dia no EPG):

```json
"programacao": [
  { "inicio": "20:00", "fim": "22:00", "titulo": "Sessão da noite", "descricao": "Filme" }
]
```

O `id` aceita só letras minúsculas, números, `-` e `_`. Reinicie o servidor
após editar.

## Assistir na TV / celular

1. Descubra o IP do computador: `ip a` (Linux), `ipconfig` (Windows) ou
   `ipconfig getifaddr en0` (macOS).
2. No app IPTV (TiviMate, IPTV Smarters, VLC → *Mídia → Abrir fluxo de rede*),
   cole: `http://SEU_IP:8080/playlist.m3u`
3. EPG (se o app pedir separado): `http://SEU_IP:8080/epg.xml`

## Senha (token)

```bash
IPTV_TOKEN=minhasenha123 node server.js
```

Aí todo acesso precisa de `?token=minhasenha123`, inclusive a playlist e o
player (`http://SEU_IP:8080/?token=minhasenha123`). A playlist gerada já
inclui o token nos links.

## Acessar fora de casa

Mais simples e seguro: [Tailscale](https://tailscale.com/download) no
servidor e no celular — use o IP `100.x.x.x` do Tailscale no lugar do IP local.
Evite abrir a porta no roteador sem token + HTTPS.

## Próximos passos possíveis

- Várias qualidades (ABR: 1080p/720p/480p) com `-var_stream_map`
- Grade de programação real (vários arquivos por horário, em vez de 1 em loop)
- Gravação (DVR) e catch-up
- HTTPS com Caddy na frente: `caddy reverse-proxy --from tv.seudominio.com --to :8080`
