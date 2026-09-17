# QCAcesso — Sistema de Controle de Acesso em Férias

> **Queiroz Cavalcanti Advocacia (QCA)**
> Plataforma corporativa automatizada para controle, auditoria, agendamento de bloqueio e desbloqueio de acessos de colaboradores em período de férias.

---

## 📌 Sumário

* [Visão Geral](#️-visão-geral)
* [Principais Funcionalidades](#-principais-funcionalidades)
* [Arquitetura e Tecnologias](#-arquitetura-e-tecnologias)
* [Estrutura do Projeto](#-estrutura-do-projeto)
* [Pré-requisitos](#️-pré-requisitos)
* [Instalação e Configuração](#-instalação-e-configuração)

  * [1. Clonar o repositório](#1-clonar-o-repositório)
  * [2. Configurando o Backend](#2-configurando-o-backend)
  * [3. Configurando o Frontend](#3-configurando-o-frontend)
* [Variáveis de Ambiente](#-variáveis-de-ambiente)
* [Scripts Disponíveis](#-scripts-disponíveis)
* [Modelo de Banco de Dados](#️-modelo-de-banco-de-dados)
* [Segurança e Compliance](#-segurança-e-compliance)
* [Licença](#-licença)

---

## 👁️ Visão Geral

O **QCAcesso** é uma solução desenvolvida para otimizar e automatizar o ciclo de vida do controle de acessos de colaboradores do **Queiroz Cavalcanti Advocacia** durante suas férias.

O sistema elimina processos manuais e suscetíveis a falhas ao permitir:

* Envio de planilhas de programação de férias;
* Validação dos dados em uma área de staging (**Checklist**);
* Agendamento automático de ações de **bloqueio** no início das férias;
* Agendamento de **desbloqueio** no retorno das férias;
* Envio de alertas por e-mail;
* Geração de registros completos de auditoria (**Audit Logs**).

---

## ✨ Principais Funcionalidades

* **Dashboard Analítico (KPIs):** indicadores em tempo real sobre bloqueios pendentes, desbloqueios do dia, colaboradores de férias e alertas ativos.

* **Importação de Planilhas (Excel/XLSX):** upload de arquivos de férias com processamento automático e validação de consistência.

* **Checklist de Revisão (Staging Area):** interface para conferência, edição, confirmação ou rejeição dos dados importados antes do agendamento definitivo.

* **Controle de Bloqueio e Desbloqueio:** mapeamento e gestão das revogações e reativações de credenciais nas datas programadas.

* **Notificações Automáticas (Cron Jobs):** envio automatizado de e-mails para supervisores e gestores informando sobre bloqueios e desbloqueios iminentes ou atrasados.

* **Logs de Auditoria (Audit Trail):** rastreabilidade de cada ação efetuada pelos usuários, incluindo uploads, edições, confirmações, alterações de perfil e envio de alertas.

* **Gestão de Usuários e Perfis (RBAC):** níveis de permissão ajustáveis:

  * `ADMIN`
  * `RH`
  * `SUPERVISOR`
  * `AUDITOR`

---

## 🚀 Arquitetura e Tecnologias

### Frontend

* **React 19**
* **TypeScript**
* **Vite 8**
* **React Router v7**
* Arquitetura baseada em **Features/Modules**

### Backend

* **Node.js**
* **TypeScript**
* **Express 4**
* **Prisma ORM 6**
* **Supabase JS Client**
* **Node-cron**
* **Nodemailer**
* **XLSX (SheetJS)**

#### Segurança

* `helmet`
* `cors`
* `express-rate-limit`
* `cookie-parser`

### Banco de Dados

* **PostgreSQL**
* Hospedagem através do **Supabase**
* Tipos personalizados com `ENUM`
* Triggers de timestamp
* Sincronização de usuários através de `auth.users`

---

## 📂 Estrutura do Projeto

```text
QCAcesso/
├── backend/                     # API REST Express em TypeScript
│   ├── prisma/                  # Esquema e migrações do Prisma ORM
│   ├── scripts/                 # Scripts utilitários
│   │                            # Ex: criação de usuário admin
│   ├── src/
│   │   ├── config/              # Variáveis de ambiente e configurações
│   │   ├── jobs/                # Agendadores de tarefas (Cron)
│   │   ├── modules/             # Módulos da aplicação
│   │   │                        # auth, checklist, funcionários etc.
│   │   ├── shared/              # Middlewares, utilitários e erros
│   │   ├── app.ts               # Rotas e middlewares do Express
│   │   └── server.ts            # Entrada do servidor backend
│   ├── .env.example             # Modelo de variáveis de ambiente
│   └── package.json
│
├── frontend/                    # Aplicação SPA React em TypeScript
│   ├── src/
│   │   ├── components/          # Componentes visuais genéricos
│   │   ├── contexts/            # Contextos globais
│   │   ├── features/            # Módulos e telas da aplicação
│   │   ├── lib/                 # API client e utilitários
│   │   ├── App.tsx              # Roteador principal
│   │   └── main.tsx             # Entrada do React
│   ├── .env.example             # Modelo de variáveis de ambiente
│   └── package.json
│
└── schema.sql                   # Estrutura SQL para o Supabase
```

---

## 🛠️ Pré-requisitos

Certifique-se de possuir os seguintes recursos instalados ou configurados:

* [Node.js](https://nodejs.org/) — versão 18 ou superior recomendada;
* [npm](https://www.npmjs.com/) ou [Yarn](https://yarnpkg.com/);
* Conta ou instância configurada no [Supabase](https://supabase.com/);
* PostgreSQL configurado através do Supabase.

---

## 🔧 Instalação e Configuração

### 1. Clonar o repositório

```bash
git clone https://github.com/qca-automacaoti/QCAcesso.git

cd QCAcesso
```

---

### 2. Configurando o Backend

Entre na pasta do backend:

```bash
cd backend
```

Instale as dependências:

```bash
npm install
```

Crie o arquivo `.env` utilizando o `.env.example` como base:

```bash
cp .env.example .env
```

Preencha as variáveis necessárias no `.env`, incluindo:

* URL do Supabase;
* Chaves do Supabase;
* Credenciais do banco PostgreSQL;
* Configurações de CORS;
* Configurações de sessão.

Gere o Prisma Client:

```bash
npm run prisma:generate
```

Caso o projeto utilize sincronização via Prisma:

```bash
npm run prisma:push
```

A estrutura do banco também pode ser aplicada através do **Supabase SQL Editor** utilizando o arquivo:

```text
schema.sql
```

Inicie o servidor em modo de desenvolvimento:

```bash
npm run dev
```

Por padrão, o backend estará disponível em:

```text
http://localhost:3000
```

---

### 3. Configurando o Frontend

Abra um novo terminal e entre na pasta:

```bash
cd frontend
```

Instale as dependências:

```bash
npm install
```

Crie o arquivo `.env`:

```bash
cp .env.example .env
```

Inicie o frontend:

```bash
npm run dev
```

Por padrão, a aplicação estará disponível em:

```text
http://localhost:5173
```

---

## 🔐 Variáveis de Ambiente

### Backend

Arquivo:

```text
backend/.env
```

| Variável                   | Descrição                       | Exemplo                               |
| -------------------------- | ------------------------------- | ------------------------------------- |
| `PORT`                     | Porta onde a API será executada | `3000`                                |
| `NODE_ENV`                 | Ambiente de execução            | `development`                         |
| `FRONTEND_ORIGIN`          | Origem permitida pelo CORS      | `http://localhost:5173`               |
| `SUPABASE_URL`             | URL do projeto Supabase         | `https://seu-projeto.supabase.co`     |
| `SUPABASE_PUBLISHABLE_KEY` | Chave pública do Supabase       | `sb_publishable_...`                  |
| `SESSION_TTL_HOURS`        | Tempo de expiração da sessão    | `8`                                   |
| `DATABASE_URL`             | Connection String PostgreSQL    | `postgresql://user:pass@host:5432/db` |
| `DATABASE_SSL_CA`          | Caminho do certificado SSL      | `./certs/supabase-prod-ca.crt`        |

> **Importante:** nunca adicione o arquivo `.env` real ao repositório Git.

---

### Frontend

Arquivo:

```text
frontend/.env
```

| Variável       | Descrição                        | Exemplo |
| -------------- | -------------------------------- | ------- |
| `VITE_API_URL` | Prefixo das chamadas da API REST | `/api`  |

---

## 📜 Scripts Disponíveis

### Backend

Execute os comandos dentro de:

```text
/backend
```

| Script                    | Descrição                                           |
| ------------------------- | --------------------------------------------------- |
| `npm run dev`             | Inicia a API em desenvolvimento com hot reload      |
| `npm run build`           | Compila TypeScript para JavaScript na pasta `dist/` |
| `npm run start`           | Executa o servidor compilado em `dist/server.js`    |
| `npm run prisma:generate` | Gera o Prisma Client                                |
| `npm run prisma:push`     | Sincroniza o schema Prisma com o banco              |
| `npm run prisma:studio`   | Abre a interface gráfica Prisma Studio              |
| `npm run criar-usuario`   | Executa o script de criação de usuário              |
| `npm run test:db`         | Testa a conexão com o banco de dados                |

---

### Frontend

Execute os comandos dentro de:

```text
/frontend
```

| Script            | Descrição                                      |
| ----------------- | ---------------------------------------------- |
| `npm run dev`     | Inicia o servidor de desenvolvimento Vite      |
| `npm run build`   | Valida o TypeScript e gera a build de produção |
| `npm run lint`    | Executa o ESLint                               |
| `npm run preview` | Executa localmente a build de produção         |

---

## 🗄️ Modelo de Banco de Dados

O projeto utiliza **PostgreSQL** hospedado no **Supabase**.

As principais tabelas da aplicação são:

### `usuarios`

Cadastro dos usuários do sistema e respectivos perfis:

* `ADMIN`
* `RH`
* `SUPERVISOR`
* `AUDITOR`

Integrado ao sistema de autenticação do Supabase.

### `funcionarios`

Cadastro dos colaboradores vinculados à empresa e identificados por matrícula.

### `upload_planilhas`

Armazena informações referentes aos uploads de arquivos Excel processados pelo sistema.

### `checklist_revisao`

Área temporária de staging responsável por armazenar os dados importados das planilhas enquanto aguardam revisão e aprovação.

### `periodos_ferias`

Armazena os períodos de férias confirmados dos colaboradores.

### `controle_acesso`

Responsável pelos agendamentos das ações:

```text
BLOQUEIO
DESBLOQUEIO
```

### `alertas`

Registra os alertas e e-mails enviados aos supervisores e gestores.

### `logs_atividade`

Mantém a trilha de auditoria das ações realizadas no sistema.

---

## 🔒 Segurança e Compliance

### Headers HTTP Seguros

O sistema utiliza `helmet` para configurar cabeçalhos HTTP e reduzir a exposição a vulnerabilidades comuns.

### CORS

O backend restringe as origens autorizadas através das configurações de CORS.

A origem permitida pode ser definida através de:

```env
FRONTEND_ORIGIN=http://localhost:5173
```

### Cookies Seguros

As sessões utilizam cookies configurados com mecanismos de proteção, incluindo:

* `HttpOnly`
* `SameSite`
* Configuração de transporte seguro em produção

### Rate Limit

O backend utiliza:

```text
express-rate-limit
```

para limitar requisições excessivas e reduzir riscos de abuso da API.

### Controle de Permissões

O sistema utiliza **RBAC — Role-Based Access Control**, permitindo separar as permissões por perfil:

| Perfil       | Responsabilidade                                       |
| ------------ | ------------------------------------------------------ |
| `ADMIN`      | Administração geral do sistema                         |
| `RH`         | Gestão dos dados de férias e colaboradores             |
| `SUPERVISOR` | Acompanhamento e confirmação de bloqueios/desbloqueios |
| `AUDITOR`    | Consulta de registros e logs de auditoria              |

### Rastreabilidade

Todas as ações administrativas e operacionais relevantes geram registros na tabela:

```text
logs_atividade
```

Isso permite identificar:

* Usuário responsável;
* Ação executada;
* Data e horário;
* Registro afetado;
* Origem da operação;
* Alterações realizadas.

---

## 📄 Licença

Este projeto é destinado ao uso interno e exclusivo da **Queiroz Cavalcanti Advocacia**.

Todos os direitos reservados.
