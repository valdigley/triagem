# 🚀 Configuração Cloudflare Pages

## ⚠️ PROBLEMA IDENTIFICADO

Seu projeto está sendo deployado como **Cloudflare Workers** em vez de **Cloudflare Pages**.

**URL atual (Workers):** `https://triagem.valdigley2007.workers.dev`
**URL desejada (Pages):** `https://triagem.online`

## 🔧 SOLUÇÃO

### 1. Configurar Cloudflare Pages Corretamente

**Passo 1: Acessar Dashboard**
1. Acesse: https://dash.cloudflare.com
2. **Pages** → **Create a project**
3. **Connect to Git** → Selecione seu repositório

**Passo 2: Configurações de Build**
```
Build command: npm run build
Build output directory: dist
Root directory: / (deixar vazio ou "/")
Environment variables: 
  - VITE_SUPABASE_URL=sua_url
  - VITE_SUPABASE_ANON_KEY=sua_chave
```

**Passo 3: Custom Domain**
1. Após deploy → **Custom domains**
2. **Set up a custom domain** → `triagem.online`
3. Configurar DNS (se necessário)

### 2. Verificar Arquivos de Configuração

**Estrutura correta após build:**
```
dist/
├── index.html
├── assets/
│   ├── index-[hash].js
│   └── index-[hash].css
├── _redirects    ← DEVE ESTAR AQUI
└── _headers      ← DEVE ESTAR AQUI
```

**Conteúdo do _redirects:**
```
/agendar /index.html 200
/album/* /index.html 200
/* /index.html 200
```

### 3. Diferenças Workers vs Pages

| Recurso | Workers | Pages |
|---------|---------|-------|
| `_redirects` | ❌ Não suporta | ✅ Suporta |
| SPA Routing | ❌ Precisa código | ✅ Automático |
| Static Assets | ❌ Limitado | ✅ Otimizado |
| Custom Domains | ⚠️ Complexo | ✅ Simples |

### 4. Migração Recomendada

**Opção A: Recriar no Pages**
1. Delete o projeto Workers atual
2. Crie novo projeto no **Pages**
3. Configure domínio `triagem.online`

**Opção B: Configurar Workers para SPA**
Se quiser manter Workers, precisa configurar roteamento manual no `src/index.js`.

## 🎯 RECOMENDAÇÃO

**Use Cloudflare Pages** para este projeto porque:
- ✅ Suporte nativo a SPA
- ✅ `_redirects` funciona automaticamente  
- ✅ Melhor para sites estáticos
- ✅ Deploy automático via Git
- ✅ Custom domains mais simples

### 5. Teste Local

Antes de fazer deploy, teste localmente:
```bash
npm run build
npm run preview
# Acesse: http://localhost:4173/agendar
```

Se funcionar localmente, o problema é definitivamente a configuração Workers vs Pages.