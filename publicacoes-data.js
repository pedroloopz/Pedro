// PUBLICAÇÕES — artigos, TCC, textos publicados
// Para adicionar uma publicação nova, copie um bloco inteiro,
// cole antes do ] final e preencha.
//
// tipo: "artigo" | "tcc" | "ensaio" | "publicacao"
// arquivo: caminho do PDF dentro da pasta /assets (ou deixe "" se não tiver PDF)
// link: URL externa, se o texto estiver publicado em outro lugar (ou "")

const PUBLICACOES = [
  {
    titulo: "Título do seu TCC ou artigo",
    tipo: "tcc",
    ano: 2024,
    instituicao: "Nome da instituição",
    resumo: "Um resumo curto de duas ou três linhas sobre do que se trata o trabalho.",
    arquivo: "assets/meu-tcc.pdf",
    link: ""
  },
  {
    titulo: "Nome de um artigo publicado",
    tipo: "artigo",
    ano: 2025,
    instituicao: "Nome do veículo ou revista",
    resumo: "Resumo curto do artigo.",
    arquivo: "",
    link: "https://exemplo.com/artigo"
  }
];
