# Language Master

App de estudo de japonês (N3 → fim do N2) e alemão (A2 → B2), feito para rodar como
artifact no Claude. Pomodoro de 25 min com revisão espaçada (FSRS-6), aula, prática,
palavras, kanji, escuta, leitura, conversa com o professor (Claude), metas diárias,
níveis e exames para pular o que você já sabe.

## Estrutura

| Pasta/arquivo | O que é |
|---|---|
| `src/head.html` | layout e estilo (celular: abas embaixo; computador: 3 colunas) |
| `src/app.js` | o app inteiro (FSRS, exercícios, pomodoro, metas, abas) |
| `src/data/*.js` | conteúdo: gramática, vocabulário, kanji e textos |
| `build.py` | junta tudo em `dist/` |
| `dist/language-master.html` | arquivo publicado como artifact |
| `dist/standalone.html` | mesma coisa com cabeçalho HTML completo (abre direto no navegador, salva só no navegador) |
| `test/` | testes de ponta a ponta com Playwright e um `window.claude` simulado |

## Conteúdo

- Japonês: 31 blocos, 155 pontos de gramática (revisão N3 + N2 completo), ~570 palavras, ~310 kanji, 6 textos.
- Alemão: 14 blocos, 70 pontos de gramática (A2, B1, B2), ~460 palavras, 6 textos.
- Mais palavras e kanji: botão "Gerar mais" na Trilha (usa o Claude), e palavras tocadas na leitura.

Formato dos pontos de gramática (`src/data/ja-*.js`, `de-*.js`):

```
x: [frase com | entre blocos, leitura em kana, tradução]
q: [frase com ＿＿＿ (ou ___), [correta, distratores...], kana da frase completa, tradução, por quê]
```

## Gerar e testar

```bash
python3 build.py
NODE_PATH=$(npm root -g) PW_PATH=$(npm root -g)/playwright node test/run.js --shots
```

Os testes percorrem o pomodoro inteiro no celular e no computador, a trilha, os testes
para pular (ponto, bloco, nível), escuta, trajeto, leitura, conversa, revisão, backup,
migração de dados antigos e o modo sem professor. Falham com qualquer erro de JavaScript.

## Dados

No Claude, o progresso fica no banco do artifact (`data/users/<id>/app/...`: itens,
erros, sessões, perfil, dias, reportes, vocabExtra). Fora do Claude, fica no
`localStorage` do navegador. Use Progresso > Ajustes > Backup para exportar.
