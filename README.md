# QCAcesso — Sistema de Controle de Acesso em Férias

> **Queiroz Cavalcanti Advocacia (QCA)**  
> Plataforma corporativa automatizada para controle, auditoria, agendamento de bloqueio e desbloqueio de acessos de colaboradores em período de férias.

---

## 📌 Sumário

- [Visão Geral](#visão-geral)
- [Principais Funcionalidades](#principais-funcionalidades)
- [Arquitetura e Tecnologias](#arquitetura-e-tecnologias)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Pré-requisitos](#pré-requisitos)
- [Instalação e Configuração](#instalação-e-configuração)
  - [1. Configurando o Backend](#1-configurando-o-backend)
  - [2. Configurando o Frontend](#2-configurando-o-frontend)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Scripts Disponíveis](#scripts-disponíveis)
- [Modelo de Banco de Dados](#modelo-de-banco-de-dados)
- [Segurança e Compliance](#segurança-e-compliance)
- [Licença](#licença)

---

## 👁️ Visão Geral

O **QCAcesso** é uma solução desenvolvida para otimizar e automatizar o ciclo de vida do controle de acessos de colaboradores do **Queiroz Cavalcanti Advocacia** durante suas férias.

O sistema elimina processos manuais e suscetíveis a falhas ao permitir o envio de planilhas de programação de férias, validação em área de staging (*Checklist*), agendamento automático das ações de **bloqueio** (início das férias) e **desbloqueio** (retorno das férias), envio de alertas via e-mail e geração de registros completos de auditoria (*Audit Logs*).

---

## ✨ Principais Funcionalidades

- **Dashboard Analítico (KPIs)**: Indicadores em tempo real sobre bloqueios pendentes, desbloqueios do dia, colaboradores de férias e alertas ativos.
- **Importação de Planilhas (Excel/XLSX)**: Upload de arquivos de férias com parseamento automático e validação de consistência.
- **Checklist de Revisão (Staging Area)**: Interface para conferência, edição, confirmação ou rejeição dos dados importados antes do agendamento definitivo.
- **Controle de Bloqueio & Desbloqueio**: Mapeamento e gestão das revogações e reativações de credenciais nas datas programadas.
- **Notificações Automáticas (Cron Jobs)**: Envio automatizado de e-mails para supervisores e gestores informando sobre bloqueios e desbloqueios iminentes ou atrasados.
- **Logs de Auditoria (Audit Trail)**: Rastreabilidade de cada ação efetuada por usuários (uploads, edições, confirmações, alterações de perfil e envios de alertas).
- **Gestão de Usuários e Perfis (RBAC)**: Níveis de permissão ajustáveis (`ADMIN`, `RH`, `SUPERVISOR`, `AUDITOR`).

---

## 🚀 Arquitetura e Tecnologias

### **Frontend**
- **React 19** + **TypeScript**
- **Vite 8** (Build tool e Dev Server ultra-rápido)
- **React Router v7** (Roteamento declarativo de páginas)
- Arquitetura baseada em **Features/Modules**

### **Backend**
- **Node.js** + **TypeScript** (`Express 4`)
- **Prisma ORM 6** & **Supabase JS Client** (Integração PostgreSQL)
- **Node-cron** (Tarefas agendadas para envio de alertas)
- **Nodemailer** (Disparo de notificações por e-mail)
- **XLSX (SheetJS)** (Processamento de planilhas Excel)
- **Segurança**: `helmet`, `cors`, `express-rate-limit`, `cookie-parser`

### **Banco de Dados**
- **PostgreSQL** hospedado na plataforma **Supabase**
- Tipos personalizáveis (`ENUM`), triggers de timestamp e sincronização de usuários via `auth.users`.

---

## 📂 Estrutura do Projeto

```text
QCAcesso/
├── backend/                  # API REST Express em TypeScript
│   ├── prisma/               # Esquema e migrações do Prisma ORM
│   ├── scripts/              # Scripts utilitários (ex: criação de usuário admin)
│   ├── src/
│   │   ├── config/           # Validação e carregamento das variáveis de ambiente
│   │   ├── jobs/             # Agendadores de tarefas (Cron)
│   │   ├── modules/          # Módulos da aplicação (auth, checklist, funcionarios, etc.)
│   │   ├── shared/           # Utilitários compartilhados, middlewares e erros
│   │   ├── app.ts            # Configuração das rotas e middlewares do Express
│   │   └── server.ts         # Ponto de entrada do servidor backend
│   ├── .env.example          # Modelo de variáveis de ambiente do backend
│   └── package.json
│
├── frontend/                 # Aplicação SPA React em TypeScript
│   ├── src/
│   │   ├── components/       # Componentes visuais genéricos (Layout, Header, Sidebar)
│   │   ├── contexts/         # Contextos globais (Autenticação, Tema)
│   │   ├── features/         # Módulos de telas (auth, checklist, dashboard, logs, etc.)
│   │   ├── lib/              # Cliente API e utilitários de data/formatação
│   │   ├── App.tsx           # Roteador principal da aplicação
│   │   └── main.tsx          # Ponto de entrada do React
│   ├── .env.example          # Modelo de variáveis de ambiente do frontend
│   └── package.json
│
└── schema.sql                # Script SQL idempotente para criação da estrutura no Supabase
```

---

## 🛠️ Pré-requisitos

Certifique-se de ter instalado em seu ambiente de desenvolvimento:
- [Node.js](https://nodejs.org/) (Versão 18 ou superior recomendada)
- [npm](https://www.npmjs.com/) ou [yarn](https://yarnpkg.com/)
- Conta ou instância configurada no [Supabase](https://supabase.com/) (PostgreSQL)

---

## 🔧 Instalação e Configuração

### 1. Clonar o repositório
```bash
git clone https://github.com/qca-automacaoti/QCAcesso.git
cd QCAcesso
```

### 2. Configurando o Backend

1. Navegue até a pasta do backend:
   ```bash
   cd backend
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Crie o arquivo `.env` com base no `.env.example`:
   ```bash
   cp .env.example .env
   ```

4. Preencha as variáveis necessárias no `.env` (URL do Supabase, chaves e credenciais do banco).

5. Aplique a estrutura do banco de dados (no Supabase SQL Editor usando o arquivo `schema.sql` ou via Prisma):
   ```bash
   npm run prisma:generate
   ```

6. Inicie o servidor em modo de desenvolvimento:
   ```bash
   npm run dev
   ```
   O backend iniciará por padrão em `http://localhost:3000`.

---

### 3. Configurando o Frontend

1. Em um novo terminal, navegue até a pasta do frontend:
   ```bash
   cd frontend
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Crie o arquivo `.env` com base no `.env.example`:
   ```bash
   cp .env.example .env
   ```

4. Inicie a aplicação no modo de desenvolvimento:
   ```bash
   npm run dev
   ```
   O aplicativo estará acessível em `http://localhost:5173`.

---

## 🔐 Variáveis de Ambiente

### Backend (`backend/.env`)

| Variável | Descrição | Exemplo |
| :--- | :--- | :--- |
| `PORT` | Porta onde a API rodará | `3000` |
| `NODE_ENV` | Ambiente de execução | `development` / `production` |
| `FRONTEND_ORIGIN` | Origem permitida para requisições CORS | `http://localhost:5173` |
| `SUPABASE_URL` | URL do projeto Supabase | `https://seu-projeto.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Chave pública/anon do Supabase | `sb_publishable_...` |
| `SESSION_TTL_HOURS` | Tempo de expiração da sessão (em horas) | `8` |
| `ALERTS_ENABLED` | Ativa as rotinas diárias de e-mail; exige credencial de serviço e SMTP | `false` |
| `ALERTS_TIMEZONE` | Fuso dos horários dos jobs | `America/Sao_Paulo` |
| `SUPABASE_SERVICE_ROLE_KEY` | Credencial administrativa exclusiva do backend para os jobs | `sb_secret_...` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | Servidor de envio de e-mail | `smtp.exemplo.com`, `587`, `false` |
| `SMTP_USER`, `SMTP_PASS`, `ALERTS_FROM_EMAIL` | Credenciais e remetente dos alertas | `qcacesso@exemplo.com` |
| `DATABASE_URL` | Connection String PostgreSQL (Prisma/Pooler) | `postgresql://user:pass@host:5432/db` |
| `DATABASE_SSL_CA` | Caminho para o certificado SSL do banco | `./certs/supabase-prod-ca.crt` |

### Frontend (`frontend/.env`)

| Variável | Descrição | Exemplo |
| :--- | :--- | :--- |
| `VITE_API_URL` | Prefixo das chamadas da API REST | `/api` |

---

## 📜 Scripts Disponíveis

### **Backend (`/backend`)**

| Script | Descrição |
| :--- | :--- |
| `npm run dev` | Inicia a API em modo desenvolvimento com `ts-node-dev` (hot reload). |
| `npm run build` | Compila o código TypeScript para JavaScript na pasta `dist/`. |
| `npm run start` | Executa o servidor compilado (`dist/server.js`). |
| `npm run prisma:generate` | Gera o cliente do Prisma com base no schema. |
| `npm run prisma:push` | Sincroniza o schema Prisma diretamente com o banco de dados. |
| `npm run prisma:studio` | Abre a interface gráfica do Prisma Studio para visualizar dados. |
| `npm run criar-usuario` | Script auxiliar para criação inicial de usuários no sistema. |
| `npm run test:db` | Executa o script de teste de conexão com o banco de dados. |

### **Frontend (`/frontend`)**

| Script | Descrição |
| :--- | :--- |
| `npm run dev` | Inicia o servidor de desenvolvimento do Vite. |
| `npm run build` | Valida a tipagem TypeScript e gera a build de produção na pasta `dist/`. |
| `npm run lint` | Executa o linter ESLint para verificar a qualidade do código. |
| `npm run preview` | Serve os arquivos da build de produção para testes locais. |

---

## 🗄️ Modelo de Banco de Dados

O projeto utiliza PostgreSQL hospedado no **Supabase**. As tabelas principais da aplicação são:

- `usuarios`: Cadastro de perfis (`ADMIN`, `RH`, `SUPERVISOR`, `AUDITOR`) integrados ao Auth do Supabase.
- `funcionarios`: Cadastro de colaboradores vinculados por empresa e cadastro (matrícula).
- `upload_planilhas`: Registro dos uploads de arquivos Excel processados.
- `checklist_revisao`: Área de staging para dados importados das planilhas aguardando aprovação.
- `periodos_ferias`: Períodos de férias confirmados e ativos.
- `controle_acesso`: Agendamentos de ações de `BLOQUEIO` e `DESBLOQUEIO`.
- `alertas`: Registro dos e-mails e alertas enviados aos supervisores.
- `logs_atividade`: Trilha de auditoria das ações realizadas no sistema.

---

## 🔒 Segurança e Compliance

- **Headers HTTP Seguros**: Proteção contra vulnerabilidades comuns usando `helmet`.
- **CORS Estrito & Origens Protegidas**: Restrição de acessos apenas para origens confiáveis e validadas via cabeçalho `X-QCA-Request`.
- **Cookies Seguros**: Cookies HTTP-Only com SameSite configurado para transporte seguro de credenciais.
- **Rastreabilidade**: Todas as ações administrativas e operacionais geram entradas na tabela de auditoria (`logs_atividade`).
- **Jobs de alertas**: Com `ALERTS_ENABLED=true`, o backend executa uma verificação ao iniciar e diariamente às 08:00 (fuso configurado), envia lembretes na véspera e escala ações vencidas para o supervisor e perfis de Administração/RH. Os envios são idempotentes por ação, destinatário e dia.
- **Credenciais isoladas**: A `SUPABASE_SERVICE_ROLE_KEY` é usada somente pelos jobs backend; login e requests da aplicação continuam usando a chave pública.

---

## 📄 Licença

Uso interno e exclusivo do **Queiroz Cavalcanti Advocacia**. Todos os direitos reservados.
