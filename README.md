# Meu mundo — site pessoal

Página única com quatro seções: sobre mim, estante de livros, publicações e
"agora" (dados ao vivo do Chess.com, Last.fm e YouTube).

## Arquivos que você edita

- **`config.js`** — seu nome, bio curta, texto completo de "Sobre mim", e usuários/chaves das APIs
- **`books-data.js`** — sua lista de livros
- **`publicacoes-data.js`** — seus artigos, TCC, etc.
- **`galeria-data.js`** — suas fotos

Os outros arquivos (`index.html`, `style.css`, `site.js`) não precisam de
edição — eles só leem os três arquivos acima.

## Passo a passo pra deixar tudo funcionando

### 1. Sobre mim
Abra `config.js` e preencha `nome`, `titulo` e `bio`.

### 2. Last.fm
1. Acesse [last.fm/api/account/create](https://www.last.fm/api/account/create) (logado na sua conta)
2. Crie uma "aplicação" com qualquer nome — isso gera uma API key grátis
3. Cole seu usuário do Last.fm e a chave em `lastfmUsername` e `lastfmApiKey`

### 3. YouTube
1. Acesse [console.cloud.google.com](https://console.cloud.google.com), crie um projeto
2. No menu, vá em "APIs e serviços" → "Biblioteca", busque **YouTube Data API v3** e ative
3. Vá em "Credenciais" → "Criar credenciais" → "Chave de API" — copie a chave gerada
4. Pegue seu Channel ID: no seu canal → "Personalizar canal" → "Configurações básicas" (ou o link do canal, que costuma vir com o ID)
5. Cole os dois em `youtubeChannelId` e `youtubeApiKey`

> A cota gratuita da API do YouTube é generosa (10 mil unidades/dia; cada
> visita ao site gasta ~100) — de sobra pra um site pessoal.

### 4. Publicações
Abra `publicacoes-data.js` e preencha seus trabalhos. Se tiver PDF, crie
uma pasta `assets/` no repositório, coloque o PDF lá, e aponte o campo
`arquivo` pra ele (ex: `"assets/meu-tcc.pdf"`).

### 5. Livros
Seus 78 livros do Goodreads já estão em `books-data.js`, com nota, tags,
data de leitura e capa (buscada automaticamente pela Open Library a
partir do ISBN — sem precisar de chave). Livros sem ISBN cadastrado no
Goodreads aparecem com um quadrado com a inicial do título no lugar da
capa. Pra adicionar um livro novo, copie um bloco inteiro e preencha.

### 6. Galeria
Crie uma pasta `assets/galeria/` no repositório e coloque suas fotos lá.
Abra `galeria-data.js` e, pra cada foto, aponte o caminho (ex:
`"assets/galeria/praia.jpg"`) e escreva uma legenda curta. Clicar numa
foto no site abre ela em tamanho maior.

> Dica: fotos muito grandes deixam o site lento pra carregar. Se puder,
> redimensione as fotos pra no máximo ~1500px de largura antes de subir
> (qualquer app de galeria do celular tem opção de "redimensionar" ou
> "compactar" ao compartilhar).

## Testar localmente

Abrir o `index.html` direto no navegador já funciona — inclusive as
chamadas de API, já que elas rodam no navegador mesmo (não precisam de
servidor).

## Publicar de graça (GitHub Pages)

1. Crie um repositório público no GitHub
2. Suba todos os arquivos desta pasta (arrastando, sem precisar de terminal)
3. Vá em **Settings → Pages**, selecione branch `main` e pasta `/ (root)`, salve
4. Em alguns minutos o site estará em `https://seu-usuario.github.io/nome-do-repo/`

## Sobre as chaves de API ficarem "públicas"

Como o site é estático (sem servidor), as chaves do Last.fm e YouTube
ficam visíveis pra quem inspecionar o código da página — é assim que
qualquer site estático com API funciona. Não tem problema nesse caso,
porque:
- São chaves de **leitura pública** (não dão acesso à sua conta, só a dados públicos)
- Ambos os serviços têm limite de requisições por dia, então o pior que
  alguém mal-intencionado faria é esgotar sua cota diária, não acessar
  dados privados

Se um dia isso te incomodar, a solução é mover as chamadas de API pra
uma função de backend (ex: Cloudflare Workers, grátis) — mas pra um site
pessoal isso costuma ser desnecessário.
