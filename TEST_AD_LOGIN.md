# Guide: teste do login com Active Directory (AD)

## Pré-requisitos

1. **Backend rodando:**
   ```bash
   cd backend
   npm install
   npm run dev
   ```
   Deve aparecer: `🚀 Server running on http://localhost:4000`

2. **Frontend rodando:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Deve aparecer: `ready - started server on 0.0.0.0:3000`

3. **Firebase Admin SDK configurado no backend:**
   - Adicione as credenciais no `backend/.env`:
     ```
     FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@pmjg-apps-hmol.iam.gserviceaccount.com
     FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nXXXXX...\n-----END PRIVATE KEY-----\n"
     ```
   - Obtenha em: Firebase Console → Project Settings → Service Accounts → Generate new private key

## Teste do Fluxo de Login

### 1. Acesse a tela de login
- Abra http://localhost:3000/
- Você verá a tela de login do Comunica+

### 2. Faça login com suas credenciais de AD
- **E-mail:** `usuario@jaboatao.pe.gov.br` (seu e-mail do AD)
- **Senha:** `sua_senha_do_AD`

### 3. Monitore os logs

**Backend (terminal onde rodar `npm run dev`):**
```
[Auth] Login attempt for: usuario@jaboatao.pe.gov.br
[Auth] Calling Python AD API: http://10.224.0.65:80/auth/basic
[Auth] Python AD API status: 200
[Auth] AD authentication successful, UID: usuario@jaboatao.pe.gov.br
[Auth] Custom Firebase token generated successfully
```

**Frontend (navegador - DevTools → Console):**
```
[Console]: Autenticação bem-sucedida, redirecionando para /dashboard
```

### 4. Esperado depois do login
- Redirecionamento automático para http://localhost:3000/dashboard
- Dashboard do chat carregando com canais e usuários

## Troubleshooting

### Erro: "Configuração de autenticação indisponível"
- **Solução:** Verifique se `PYTHON_AUTH_API` está configurado no `backend/.env`

### Erro: "Falha ao conectar com o servidor de autenticação"
- **Possíveis causas:**
  - API Python AD em `http://10.224.0.65:80/auth/basic` está offline
  - Firewall bloqueando a conexão
  - URL incorreta
- **Solução:** Teste a conexão: `curl http://10.224.0.65:80/auth/basic`

### Erro: "Token de autenticação inválido"
- **Possível causa:** Firebase Admin SDK não configurado corretamente
- **Solução:**
  1. Verifique se `FIREBASE_CLIENT_EMAIL` e `FIREBASE_PRIVATE_KEY` estão no `backend/.env`
  2. Certifique-se de que a chave começa com `-----BEGIN PRIVATE KEY-----`
  3. Reinicie o backend com `npm run dev`

### Erro: "Credenciais inválidas"
- **Possível causa:** E-mail ou senha incorretos
- **Solução:**
  1. Verifique se o e-mail está correto
  2. Confirme a senha com o seu gestor de AD
  3. Teste o acesso direto na API Python AD se possível

## Próximas Steps Após Sucesso

1. [ ] Testar criação de canais
2. [ ] Testar envio de mensagens em canais
3. [ ] Testar mensagens diretas (DM) entre usuários
4. [ ] Configurar Firebase Rules para produção
5. [ ] Deployer no ambiente de produção

## Contato

Se encontrar problemas, verifique:
- Logs do backend em `npm run dev`
- DevTools Console do navegador (F12)
- Configuração das chaves do Firebase Admin SDK
