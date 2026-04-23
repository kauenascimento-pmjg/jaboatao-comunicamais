# Login com Active Directory (AD)

## Configuração do Login com AD

O sistema agora está configurado para autenticar via Active Directory através da API Python em `http://10.224.0.65:80/auth/basic`.

### Fluxo de Autenticação

```
1. Usuário digita e-mail e senha no frontend
2. Frontend chama POST /api/auth/basic com as credenciais
3. Rota Next.js chama a API Python AD 
4. API Python valida as credenciais no AD
5. API Python retorna um token (JWT ou custom)
6. Rota Next.js gera um custom token Firebase a partir do UID
7. Frontend recebe o custom token e faz login no Firebase
8. Usuário é autenticado no Firestore via custom token
```

### Pré-requisitos

Para que o login funcione completamente, configure as credenciais do Firebase Admin SDK no `frontend/.env.local`:

```bash
# Obtenha em: Firebase Console → Project Settings → Service Accounts → Generate new private key
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@pmjg-apps-hmol.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nXXXXXX...\nXXXXXX\n-----END PRIVATE KEY-----\n"
```

**Importante:** A chave privada deve estar em uma única linha com `\n` em vez de quebras reais.

### Como Obter as Credenciais do Firebase

1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Selecione o projeto `pmjg-apps-hmol`
3. Vá para **Project Settings** (ícone de engrenagem)
4. Abra a aba **Service Accounts**
5. Clique em **Generate new private key**
6. Salve o arquivo JSON e copie `client_email` e `private_key`

### Estrutura do Response da API AD

A API Python (`PYTHON_AUTH_API`) deve retornar um JSON com um dos seguintes formatos:

**Opção 1 (com custom token Firebase):**
```json
{
  "firebaseCustomToken": "eyJhbGciOiJSUzI1NiI...",
  "uid": "user@jaboatao.pe.gov.br",
  "email": "user@jaboatao.pe.gov.br"
}
```

**Opção 2 (com JWT padrão):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiI...",
  "uid": "user@jaboatao.pe.gov.br",
  "email": "user@jaboatao.pe.gov.br"
}
```

**Opção 3 (resposta mínima):**
```json
{
  "uid": "user@jaboatao.pe.gov.br",
  "email": "user@jaboatao.pe.gov.br"
}
```

Nesse caso, o rota Next.js gerará automaticamente um custom token usando o Firebase Admin SDK.

### Testando o Login

1. **Instale dependências:**
   ```bash
   cd frontend
   npm install
   ```

2. **Inicie o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```

3. **Acesse a tela de login:**
   - Abra http://localhost:3000/
   - Digite seu e-mail e senha de AD

4. **Monitore os logs:**
   - Verifique o console do navegador (DevTools)
   - Verifique os logs do servidor Next.js (terminal com `npm run dev`)
   - Procure por linhas com `[Auth]` para debugar

### Tratamento de Erros

- **"Configuração de autenticação indisponível"**: `PYTHON_AUTH_API` não está configurado
- **"Falha ao conectar com o servidor de autenticação"**: API AD está offline ou indisponível
- **"Credenciais inválidas"**: E-mail ou senha incorretos
- **"Token de autenticação inválido"**: Configuração do Firebase Admin SDK incorreta

### Firestore Rules

As rules do Firestore já estão configuradas para aceitar usuários autenticados via custom token:

```
function isAuthenticated() {
  return request.auth != null;
}
```

Qualquer usuário autenticado (via Firebase Auth ou custom token) pode:
- Ver canais e usuários
- Enviar mensagens em canais e DMs
- Ver/criar seu perfil de usuário

### Próximas Steps

- [ ] Testar login com credenciais válidas de AD
- [ ] Configurar Firebase Admin SDK com chave privada
- [ ] Verificar logs de autenticação em caso de erro
- [ ] Ajustar structure do response da API AD se necessário
- [ ] Implementar recuperação de senha (opcional)
