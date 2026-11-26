# Estudio Manager

Sistema de gestão para um estúdio de tatuagem, piercing e procedimentos estéticos.

Projeto final da disciplina **DAD — Desenvolvimento de Aplicações Desktop**. O sistema foi
levantado a partir da entrevista com o cliente fictício (transcrição em
[`projetofinal.txt`](projetofinal.txt)) e atende aos requisitos de
[`requisitos-projeto-final.pdf`](requisitos-projeto-final.pdf).

---

## O problema do cliente

O dono do estúdio gerencia tudo no papel. Na entrevista ele apontou seis dores concretas:

| O que ele disse | Como o sistema resolve |
|---|---|
| "quero cadastrar todos os meus clientes" | Cadastro de clientes com contato, endereço e dados de saúde |
| "cadastrar os procedimentos que cada profissional faz" | Relação N:N entre profissional e procedimento — a agenda só deixa marcar com quem é habilitado |
| "tem que ter uma agenda com todos os horários" | Agenda por dia e por profissional, com cálculo automático de horários livres |
| "preciso guardar o histórico de cada cliente... o que fez, quando foi a última vez" | Ficha do cliente com linha do tempo e data de retorno sugerida por procedimento |
| "controlar todos os materiais... muita coisa é importada, preciso saber quanto está o dólar" | Estoque com baixa automática e cotação USD-BRL congelada na compra |
| "um dia antes eles têm que receber um e-mail avisando" | Agendador diário que envia o lembrete de 24h automaticamente |
| "quero o mais automatizado possível" | CEP preenche o endereço, atendimento baixa o estoque, retorno é calculado sozinho |

---

## Requisitos técnicos obrigatórios

| # | Requisito | Onde está |
|---|---|---|
| 1 | Banco relacional com no mínimo 6 tabelas relacionadas | **13 tabelas e 16 chaves estrangeiras** — [`db/migrations/`](db/migrations/) |
| 2 | CRUD completo em todas as entidades | Telas em `src/renderer/src/paginas/` — detalhado em [CRUD por entidade](#crud-por-entidade) |
| 3 | Consumo de API em 4 situações distintas | ViaCEP, cotação USD-BRL, SMTP e a API própria — detalhado abaixo |
| 4 | Segurança justificada | Seção [Decisões de segurança](#decisões-de-segurança) |
| 5 | Código modularizado em classes (POO) | 10 repositórios (sobre um `BaseRepository`), 10 serviços e 4 integrações (sobre um `HttpClient`) em `src/core/` |
| 6 | Electron com TypeScript, sem `.js` de lógica | Todo o código-fonte é `.ts`/`.tsx` |

### CRUD por entidade

| Entidade | Criar | Ler | Editar | Excluir | Onde |
|---|---|---|---|---|---|
| Usuário | ✅ | ✅ | ✅ | ✅ | Usuários (só DONO) |
| Cliente | ✅ | ✅ | ✅ | ✅ \* | Clientes / ficha do cliente |
| Endereço | ✅ | ✅ | ✅ | ✅ | Junto do cliente (preenchido pelo CEP; sai junto quando o cliente é excluído) |
| Profissional | ✅ | ✅ | ✅ | ✅ \* | Profissionais |
| Procedimento | ✅ | ✅ | ✅ | ✅ \* | Procedimentos |
| Profissional × procedimento | ✅ | ✅ | — | ✅ | Profissionais (habilitar / desabilitar) |
| Agendamento | ✅ | ✅ | ✅ | ✅ | Agenda (agendar, remarcar, confirmar, cancelar, excluir) |
| Atendimento | ✅ | ✅ | ✅ | ✅ | Agenda (registrar) e ficha do cliente (editar, estornar) |
| Material | ✅ | ✅ | ✅ | ✅ \* | Estoque |
| Procedimento × material | ✅ | ✅ | — | ✅ | Procedimentos (ficha técnica) |
| Aviso ao profissional | ✅ | ✅ | ✅ | — | Painel (enviar, marcar como lido, reenviar atualiza) |
| Movimentação de estoque | ✅ | ✅ | ❌ | ❌ | Estoque (compra, ajuste e baixa automática) |
| Cotação do dólar | ✅ | ✅ | ❌ | ❌ | Estoque e Painel (consultar, histórico) |

\* Quando o registro já tem histórico (cliente que fez procedimento, profissional com agenda,
material já movimentado), a exclusão vira **desativação**: ele some das listas, mas o histórico
continua. Apagar de verdade destruiria o histórico de saúde e o registro financeiro.

**Por que movimentação e cotação não têm editar nem excluir.** As duas são **registros de
histórico**, como um extrato bancário:

- **Movimentação de estoque** é o extrato do estoque: o saldo atual de cada material é a soma
  dessas linhas. Editar ou apagar uma delas deixaria o saldo sem explicação. Um erro é corrigido
  com um **novo lançamento** de ajuste, e o estorno de um atendimento lança a devolução dos
  materiais em vez de apagar a saída.
- **Cotação do dólar** fica ligada às compras de material importado e **congela o câmbio**
  daquela compra. Alterar ou apagar uma cotação mudaria o custo de compras já feitas.

Os dois casos são decisões de domínio, não CRUD esquecido.

---

## As 4 situações de consumo de API

Cada uma tem fonte e finalidade diferentes, e um propósito real no fluxo do sistema.

**1. ViaCEP — autopreenchimento de endereço**
`src/core/integrations/ViaCepClient.ts`
Pedido explícito do cliente ("você digita o CEP e o endereço se preenche"). Usada no cadastro
de cliente. Tem cache em memória, porque o mesmo CEP costuma ser digitado várias vezes.

**2. AwesomeAPI — cotação do dólar**
`src/core/integrations/CambioClient.ts`
O estúdio compra material importado e o dono decide a compra pelo câmbio do dia. A cotação é
gravada na tabela `cotacao_dolar` e **referenciada pela movimentação de estoque**, congelando o
câmbio praticado naquela compra. Se a variação do dia passar do limite configurado, o sistema
avisa antes de comprar.

**3. SMTP (nodemailer) — lembrete por e-mail**
`src/core/integrations/EmailClient.ts`
Substitui o WhatsApp manual que o dono manda hoje. Sem SMTP configurado, o cliente entra em modo
simulado e registra no console em vez de falhar — o app continua utilizável em desenvolvimento.
Um envio simulado **não** marca o lembrete como enviado: ele continua pendente e sai de verdade
assim que o SMTP for configurado. O Painel mostra se o e-mail está configurado, e erros comuns
(login recusado, servidor inacessível) aparecem com uma explicação do que corrigir.

**Configurar o envio real (Gmail):** ative a verificação em duas etapas na conta remetente, gere
uma senha de app em myaccount.google.com/apppasswords e preencha no `.env`:
`SMTP_USER` (o e-mail), `SMTP_PASSWORD` (a senha de app de 16 letras) e `SMTP_FROM`. Depois
reinicie a API (`npm run api:dev`).

**4. API própria em Express — agendador e envios**
`api/ApiServer.ts`
Esta precisa existir fora do Electron por um motivo real: **o lembrete de 24h tem que disparar
mesmo com o aplicativo fechado**, e o processo do desktop só roda quando alguém o abre. O serviço
fica de pé, executa o agendador diário (09:00) e é o único responsável pelos envios. Reaproveita
as mesmas classes de domínio do desktop, sem duplicar regra de negócio.

| Rota | Proteção | Quem chama |
|---|---|---|
| `GET /saude` | pública | Painel (status do serviço) |
| `GET /lembretes/pendentes` | chave | Painel (clientes de amanhã aguardando lembrete) |
| `POST /lembretes/executar` | chave | Botão "Enviar lembretes de amanhã agora" |
| `POST /avisos/executar` | chave | Botão "Avisar profissionais sobre amanhã" |

A API só tem rotas que o desktop realmente usa. Relatórios e cotação o app lê direto pelas
próprias classes de serviço, sem passar pela API, porque passar por ela não traria nenhum ganho.

**Como o desktop consome a API** — `src/core/integrations/ApiPropriaClient.ts`
O app não envia lembretes por conta própria: tudo passa pela API, que é a dona do envio. Assim o
agendador e o botão manual nunca mandam o mesmo lembrete duas vezes. No fluxo do app:

- o **Painel** consulta `GET /saude` e `GET /lembretes/pendentes` (a cada minuto) e mostra se o
  serviço está no ar, se o envio das 09:00 está ativo e quantos clientes de amanhã aguardam aviso;
  se a API cair, o painel alerta que os clientes **não estão recebendo** o lembrete;
- o botão **"Enviar lembretes de amanhã agora"** chama `POST /lembretes/executar`;
- o botão **"Avisar profissionais sobre amanhã"** chama `POST /avisos/executar`, informando quem
  da recepção disparou (validado com zod na API).

Às 09:00 o agendador da API faz as duas coisas sozinho: manda o lembrete aos **clientes** e gera,
para cada **profissional**, o aviso com os atendimentos de amanhã, que aparece no painel dele
(remetente "sistema"). A recepção só usa os botões se a agenda mudar depois disso. As duas tarefas
rodam separadas: se o e-mail falhar, os profissionais continuam sendo avisados.

As rotas são protegidas por chave (`x-api-key`, comparada em tempo constante) e a chamada sai do
processo principal do Electron — a chave nunca chega ao renderer.

---

## Arquitetura

```
src/
  main/        processo principal do Electron: janela, IPC, controle de acesso por canal
  preload/     ponte segura (contextBridge) com allowlist de canais
  renderer/    interface React + TypeScript
  core/        REGRA DE NEGÓCIO — classes usadas pelo desktop E pela API
    config/        leitura de variáveis de ambiente
    database/      pool MySQL, transações
    repositories/  acesso a dados (BaseRepository + 9 concretos)
    services/      serviços de domínio
    integrations/  clientes das APIs externas
  shared/      tipos e schemas Zod compartilhados entre processos
api/           API própria (Express + node-cron)
db/            migrations SQL, runner e seed
testes/        suíte de testes de fluxo
```

A regra de negócio mora em `src/core/` e não no processo do Electron porque **o app desktop e a
API consomem as mesmas classes**. É isso que torna a modularização em classes uma necessidade da
arquitetura, e não um enfeite para cumprir requisito.

### Modelo de dados

```
usuario ──1:1── profissional ──N:N── procedimento ──N:N── material
                     │                    │                  │
                     └──────┐    ┌────────┘                  │
                            ▼    ▼                           │
cliente ──────────────▶ agendamento ──1:1── atendimento      │
   │                                              │          │
   └── endereco                                   ▼          ▼
                                        movimentacao_estoque ─┘
                                                   │
                                                   └──▶ cotacao_dolar
```

| Tabela | Papel |
|---|---|
| `usuario` | Login, hash da senha e perfil de acesso |
| `endereco` | Preenchido pela ViaCEP |
| `cliente` | Contato, endereço e dados de saúde |
| `profissional` | Vinculado a um usuário; comissão e registro |
| `procedimento` | Catálogo: duração, preço e dias de retorno sugerido |
| `profissional_procedimento` | **N:N** — quem está habilitado a executar o quê |
| `agendamento` | Horário marcado, status e controle de lembrete enviado |
| `atendimento` | O que foi realizado — o histórico do cliente |
| `material` | Insumos, com marcação de importado e estoque mínimo |
| `procedimento_material` | **N:N** — ficha técnica: o que cada procedimento consome |
| `movimentacao_estoque` | Entradas, saídas, perdas e ajustes |
| `cotacao_dolar` | Histórico de cotações consultadas |
| `aviso_profissional` | Aviso da recepção a cada profissional sobre os atendimentos do dia seguinte, com controle de leitura |

### Automações

- CEP preenche logradouro, bairro, cidade e UF
- Fechar um atendimento **baixa o estoque** pela ficha técnica, em transação única
- Fechar um atendimento **calcula a data de retorno** do cliente
- Material que atinge o mínimo gera alerta no painel
- Compra de material importado **busca e congela a cotação** do dólar
- Agendador envia o **lembrete de 24h** uma única vez por agendamento
- Recepção avisa cada profissional dos **atendimentos de amanhã**; o aviso aparece no painel dele e a recepção vê quem já leu

---

## Decisões de segurança

O requisito 4 pede que o grupo justifique as decisões tomadas para o **seu** sistema. O domínio
aqui tem duas características que guiaram as escolhas: há **dados de saúde** (alergias, uso de
anticoagulante, condições relevantes ao procedimento) e há **informação financeira** que só
interessa ao dono.

**Senhas.** Gravadas apenas como hash **bcrypt com custo 12**. A coluna `senha_hash` fica fora do
`SELECT` padrão do repositório, então o hash não trafega por acidente até a interface. No login, a
comparação bcrypt roda **mesmo quando o e-mail não existe**, contra um hash descartável, para que o
tempo de resposta não revele quais e-mails estão cadastrados.

**Força bruta.** Depois de **5 senhas erradas** para o mesmo e-mail, o login fica bloqueado por
**5 minutos** — mesmo com a senha certa. O bloqueio vale também para e-mails que não existem, para
não revelar quais estão cadastrados, e não afeta os outros usuários.

**Sessão.** Token aleatório de 32 bytes assinado com **HMAC-SHA256** usando `APP_SECRET`, validade
de 8 horas. A verificação da assinatura usa `timingSafeEqual`. Trocar a senha invalida todas as
sessões abertas daquele usuário.

**Controle de acesso por domínio.** Três perfis, desenhados a partir de como o estúdio funciona:

| Perfil | Pode |
|---|---|
| `DONO` | Tudo: faturamento, estoque, custos, cotação do dólar, usuários |
| `RECEPCAO` | Agenda (criar, remarcar, cancelar), cadastros e lembretes — **sem** estoque, custos, cotação nem faturamento; não edita valores de atendimento |
| `PROFISSIONAL` | **Apenas a própria agenda** e a ficha dos **clientes que atende**; confirma os próprios horários e corrige as próprias anotações técnicas |

A restrição não é só esconder botão: cada canal do processo principal confere o perfil
(`src/main/ipc.ts`), então mesmo uma chamada IPC forjada é recusada. O Painel recebe faturamento,
estoque e cotação **só quando o perfil é DONO** — para os outros esses dados nem saem do servidor.

**Dados de saúde.** A ficha do cliente tem alergias e condições de saúde. O profissional precisa
delas antes do procedimento, mas **só dos clientes que já atendeu ou vai atender** (tem agendamento
com ele). Tentar abrir a ficha ou o histórico de outro cliente é recusado
(`ClienteService.garantirAcessoDoProfissional`). Nomes e e-mails da lista de lembretes também só
chegam a quem opera a agenda.

**Validação de entrada.** Todo dado que entra passa por um schema **Zod** antes de chegar ao banco
— inclusive validação real de CPF por dígito verificador, e não só por tamanho. A edição de
atendimento usa schema `strict`: qualquer campo fora dos permitidos é recusado.

**SQL.** Todas as queries usam placeholders `?`. Nenhum valor é concatenado em string SQL.

**Isolamento do Electron.** `contextIsolation: true`, `nodeIntegration: false` e **`sandbox: true`**
(o preload é gerado em CommonJS justamente para poder rodar dentro do sandbox do Chromium). O
preload **não expõe o `ipcRenderer`**: expõe só uma função `invocar()` restrita a uma allowlist fixa
de canais.
O renderer roda sob Content-Security-Policy restritiva e não tem acesso a Node nem ao banco.
Links externos abrem no navegador do sistema, nunca dentro do app.

**Erros.** Exceções nunca atravessam a ponte IPC: viram `{ ok: false, erro, codigo }`, sem stack
trace e sem detalhe interno do banco.

**Segredos.** Ficam no `.env`, que está fora do versionamento. O repositório traz apenas o
`.env.example` com placeholders.

**Exclusão.** Registros com histórico (cliente que já fez procedimento, profissional com agenda)
são **desativados, não apagados** — apagar destruiria o histórico de saúde e o registro fiscal.

---

## Como rodar

### Pré-requisitos

- **Node.js** 20 ou superior
- **MySQL Server** 8.0 ou superior
- **Git**

### Passo a passo

```bash
git clone <url-do-repositorio>
cd ProjetoWill

npm install

# Windows:
copy .env.example .env
# Linux/Mac:
cp .env.example .env
```

Abra o `.env` e preencha `DB_PASSWORD` com a senha do MySQL **da sua máquina**. Depois:

```bash
npm run db:migrate   # cria o banco e as 13 tabelas
npm run db:seed      # popula com dados de exemplo
npm run dev          # abre o aplicativo
```

Para o agendador de lembretes, em outro terminal:

```bash
npm run api:dev
```

### Usuários de demonstração

Senha de todos: `Estudio@2026`

| E-mail | Perfil |
|---|---|
| `dono@estudio.com` | DONO — acesso total |
| `recepcao@estudio.com` | RECEPCAO — agenda e cadastros |
| `marina@estudio.com` | PROFISSIONAL — só a própria agenda |

### Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Aplicação desktop em modo desenvolvimento |
| `npm run build` | Typecheck completo e build de produção |
| `npm run typecheck` | Só a verificação de tipos |
| `npm test` | Suíte de testes de fluxo (23 verificações) |
| `npm run api:dev` | API própria com recarga automática |
| `npm run db:migrate` | Aplica as migrations pendentes |
| `npm run db:seed` | Repopula o banco com os dados de exemplo |

### Observação para o grupo

Cada integrante tem o **próprio MySQL local**, então o `.env` de cada um é diferente — por isso ele
não vai para o Git. O `migrate` + `seed` são a receita que reproduz o banco idêntico em qualquer
máquina. Quando alguém criar uma migration nova, os outros rodam `git pull` e `npm run db:migrate`
(o runner só aplica o que ainda falta, é seguro rodar quantas vezes quiser).

---

## Testes

```bash
npm test
```

Exercita as regras que não dá para verificar só olhando a tela: controle de acesso por perfil,
rejeição de CPF e senha inválidos, as duas APIs externas respondendo, bloqueio de horário
sobreposto, bloqueio de profissional não habilitado, baixa de estoque ao fechar o atendimento e
devolução correta no estorno.

---

## Stack

Electron · TypeScript · React · Vite · MySQL · Express · Zod · bcrypt · nodemailer · node-cron
