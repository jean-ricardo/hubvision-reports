# Remix of HViagem

# Prompt para o Lovable — Hubvision | Prestação de Contas

Cole o bloco **"PROMPT PRINCIPAL"** direto no Lovable para iniciar o projeto. Depois, use os **prompts de refinamento** um de cada vez (o Lovable funciona melhor em passos incrementais do que tudo de uma vez).

---

## Antes de começar

No Lovable, conecte o **Supabase** (Project Settings → Integrations) antes de colar o prompt principal — isso já deixa disponível banco de dados, autenticação e storage de arquivos (para as fotos das notas fiscais), sem precisar de backend próprio.

---

## PROMPT PRINCIPAL

```

Crie um aplicativo web de Prestação de Contas para a empresa Hubvision, mobile-first,

usando React + Tailwind + shadcn/ui, conectado ao Supabase para dados, autenticação e

armazenamento de arquivos.

CONTEXTO DO PRODUTO

Ferramenta interna para colaboradores lançarem despesas corporativas (semelhante ao

Paytrack), com aprovação e fechamento periódico em relatório compartilhável.

IDENTIDADE VISUAL

- Cor de fundo (paper): #EEF1F6

- Cor primária (ink/navy): #12213B

- Cor de destaque (gold): #C9972F / gold suave #F4E3B8

- Status: pendente #B9791C (fundo #FBF0DA), aprovado #2F8F5B (fundo #E4F3EA),

  rejeitado #C1443C (fundo #FBE7E5)

- Tipografia: títulos em "Space Grotesk" (peso 600/700), textos em "Inter",

  valores monetários e datas em "IBM Plex Mono" (para dar cara de recibo/ledger)

- Cards de despesa com cantos arredondados (14px), bordas finas (#DCE1EA) e

  separador tracejado entre cabeçalho e detalhes (estética de recibo)

- Navegação inferior fixa (estilo app mobile) com 3 abas: "Nova despesa",

  "Despesas" e "Fechamento"

MODELO DE DADOS (Supabase)

Tabela colaboradores:

- id (uuid, pk)

- nome (text, not null, unique)

- created_at (timestamptz, default now())

Tabela despesas:

- id (uuid, pk)

- colaborador_id (uuid, fk -> colaboradores.id)

- tipo_despesa (text) — valores possíveis: "Alimentação", "Transporte / Aplicativo",

  "Combustível", "Hospedagem", "Estacionamento / Pedágio", "Material de Escritório",

  "Cliente / Relacionamento", "Outros"

- uf (text, 2 caracteres)

- cidade (text)

- valor (numeric(10,2))

- data_despesa (date)

- descricao (text, opcional)

- foto_url (text, opcional) — URL do arquivo no Supabase Storage

- status (text, default 'pendente') — 'pendente' | 'aprovado' | 'rejeitado'

- relatorio_id (uuid, fk -> relatorios_fechamento.id, nullable)

- created_at (timestamptz, default now())

Tabela relatorios_fechamento:

- id (uuid, pk)

- data_inicio (date)

- data_fim (date)

- colaborador_filtro (text, nullable) — nome do colaborador ou "todos"

- total (numeric(10,2))

- quantidade (int)

- status (text, default 'concluido')

- created_at (timestamptz, default now())

Storage bucket: "notas-fiscais" para as fotos das notas.

AUTENTICAÇÃO

Login simples por e-mail/senha via Supabase Auth. Qualquer usuário autenticado pode

lançar despesas e ver todos os lançamentos (dado compartilhado da equipe).

TELA 1 — Nova Despesa (formulário)

Campos, nesta ordem:

1. Colaborador — select com busca, populado da tabela colaboradores, com opção

   "+ Novo" para cadastrar um colaborador inline sem sair da tela

2. Tipo de despesa — select com a lista fixa acima

3. UF e Cidade lado a lado — UF é select com as 27 siglas de estado do Brasil,

   pré-selecionado como "PE"; Cidade é campo de texto livre, pré-preenchido com

   "Recife" (ambos editáveis)

4. Valor (R$) e Data lado a lado

5. Descrição / Observações — textarea

6. Foto da nota fiscal — botão grande com ícone de câmera que abre a câmera do

   celular diretamente (input capture="environment"), comprime a imagem no

   client antes do upload (máx. 1000px, JPEG qualidade ~0.6) e mostra uma

   miniatura com opções "Refazer" / "Remover"

Botão final "Lançar despesa" (desabilitado até os campos obrigatórios estarem

preenchidos: colaborador, tipo, UF, cidade, valor). Ao salvar, insere na tabela

despesas com status "pendente" e volta para a lista.

TELA 2 — Despesas (lista/dashboard)

- Dois cards de resumo no topo: total pendente e total aprovado (formatados em

  R$, fonte monoespaçada)

- Filtros por status e por colaborador

- Checkbox "Modo aprovação" — quando ativado, mostra botões Aprovar/Rejeitar/

  Excluir em cada card; quando desativado, os cards são só leitura

- Cada despesa é um card expansível (estilo recibo) mostrando tipo, colaborador,

  cidade/UF, data e valor fechados; ao expandir, mostra descrição, foto da nota

  e as ações

- Despesas que já pertencem a um relatório de fechamento concluído mostram um

  ícone de cadeado, texto "Incluída em relatório de fechamento concluído" e NÃO

  podem mais ser aprovadas/rejeitadas/excluídas

TELA 3 — Fechamento (duas sub-abas em formato de pill: "Novo fechamento" e

"Histórico")

Sub-aba "Novo fechamento":

- Campos Data inicial e Data final (padrão: primeiro dia do mês atual até hoje)

- Filtro opcional por colaborador

- Card de destaque (fundo dourado suave) mostrando quantidade de despesas e

  valor total do período (apenas despesas SEM relatorio_id, para não duplicar)

- Lista compacta de prévia das despesas incluídas

- Botão "Concluir fechamento": cria um registro em relatorios_fechamento e

  marca todas as despesas incluídas com o relatorio_id correspondente (elas

  ficam travadas a partir daí)

- Após concluir, mostra uma tela de confirmação com o resumo e os botões de PDF

  (ver seção PDF abaixo), mais um botão "Iniciar novo fechamento"

Sub-aba "Histórico":

- Lista de todos os relatórios já concluídos (mais recente primeiro), cada um

  mostrando período, colaborador filtrado (ou "Todos"), quantidade, total e

  selo "Concluído"

- Cada item tem os mesmos botões de PDF (compartilhar/salvar) da tela de

  confirmação

GERAÇÃO DE PDF E COMPARTILHAMENTO

Ao concluir um fechamento (ou a qualquer momento no Histórico), gerar um PDF

contendo:

- Cabeçalho "Hubvision — Relatório de Fechamento"

- Período, colaborador filtrado (se houver) e data de conclusão

- Tabela com todas as despesas incluídas: Colaborador, Tipo, Cidade/UF, Data,

  Status, Valor (linhas zebradas, cabeçalho em navy com texto branco)

- Total geral e quantidade de despesas no rodapé

Nome do arquivo: fechamento-hubvision-{data_inicio}_a_{data_fim}.pdf

Dois botões de ação:

1. "Compartilhar PDF" — usa a Web Share API (navigator.share com arquivo) para

   abrir o menu nativo de compartilhamento do celular (WhatsApp, e-mail, Drive,

   etc.); se o navegador não suportar compartilhamento de arquivo, faz o

   download automático como alternativa

2. "Salvar" — baixa o PDF diretamente

Pode usar a biblioteca jsPDF no client para montar o PDF, ou uma Supabase Edge

Function caso prefira gerar no servidor.

REGRAS DE NEGÓCIO IMPORTANTES

- Uma despesa só pode pertencer a UM relatório de fechamento

- Despesas de um relatório concluído não podem mais ser editadas, aprovadas,

  rejeitadas ou excluídas

- O contador de despesas pendentes aparece como badge na aba "Despesas" da

  navegação inferior

- Todos os dados são compartilhados entre os usuários autenticados (não há

  separação por usuário — é um caderno único da equipe Hubvision)

```

---

## Prompts de refinamento (use depois, um de cada vez)

**1) Ajuste fino de design**

```

Revise a tela de Nova Despesa e os cards de despesa para reforçar a estética de

"recibo": bordas com leve efeito serrilhado/tracejado, tipografia monoespaçada

para valores e datas, e uma paleta consistente com navy #12213B e dourado

#C9972F. Evite qualquer aparência de template genérico.

```

**2) Regras de acesso**

```

Adicione Row Level Security no Supabase: qualquer usuário autenticado pode ler

e criar despesas e colaboradores; apenas um papel "gestor" (coluna is_gestor em

uma tabela de perfis) pode aprovar, rejeitar, excluir despesas e concluir

fechamentos.

```

**3) Exportação adicional**

```

Adicione um botão "Exportar Excel" na tela de Histórico de fechamentos,

gerando um .xlsx com as mesmas colunas do PDF, usando a biblioteca SheetJS.

```

---

### Notas

- O Lovable já resolve hospedagem, autenticação e o banco via Supabase — não é

  necessário reescrever a lógica de storage local que usamos no protótipo em

  React (aquela era só para rodar dentro do chat).

- Se quiser, posso gerar também o dump SQL (`CREATE TABLE` completo com RLS)

  para colar direto no editor SQL do Supabase antes do primeiro prompt.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c399396f-788a-42d0-a636-d38a079540d5).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
