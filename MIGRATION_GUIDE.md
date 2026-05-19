# 📚 Guia de Migração - Autenticação Simplificada

## O que mudou?

### ❌ REMOVIDO

1. **Sincronização de dados de autenticação ao Firestore**
   - Antes: `syncUserToFirestore()` salvava email/displayName no Firestore
   - Agora: Firebase Auth é a única fonte de verdade

2. **Armazenamento de senhas customizado**
   - Antes: bcrypt manual com hash salvo em Firestore
   - Agora: Firebase Auth cuida automaticamente

3. **Interface ADUser**
   - Antes: Mistura de usuários Firebase e Active Directory
   - Agora: Apenas `AuthUser` do Firebase Auth

4. **Dependência do Firestore para autenticação**
   - Antes: Verificava `users` collection para `passwordCreated`
   - Agora: Usa `fetchSignInMethodsForEmail()` do Firebase Auth

### ✅ ADICIONADO

1. **Hook `useAuth()` simplificado**
   ```tsx
   const { user, isAuthenticated, isLoading, logout } = useAuth();
   ```

2. **Persistência automática de sessão**
   - `browserLocalPersistence` ativado no AuthProvider
   - Sessão restaurada automaticamente entre abas

3. **Documentação completa**
   - AUTHENTICATION.md
   - Exemplos de uso
   - Debugging guide

4. **Melhor tratamento de erros**
   - Códigos de erro específicos do Firebase
   - Mensagens amigáveis ao usuário

---

## 🔄 Migrando seu código

### 1. Substituir importações

**ANTES:**
```tsx
import { ADUser } from '@/lib/authStore';
import { syncUserToFirestore } from '@/lib/chatService';
```

**DEPOIS:**
```tsx
import { AuthUser } from '@/lib/authStore';
// syncUserToFirestore foi removido - não é mais necessário
```

### 2. Atualizar tipo de usuário

**ANTES:**
```tsx
const user: ADUser = {
  uid: '...',
  email: '...',
  isAD: true,
  department: 'TI',
  // ... mais campos
};
```

**DEPOIS:**
```tsx
const user: AuthUser = {
  uid: '...',
  email: '...',
  displayName: '...',
  emailVerified: true,
  createdAt: new Date(),
};
```

### 3. Remover calls a `syncUserToFirestore`

**ANTES:**
```tsx
await syncUserToFirestore(user);
```

**DEPOIS:**
```tsx
// Não precisa fazer nada!
// AuthProvider já cuida disso automaticamente
```

### 4. Usar novo hook de autenticação

**ANTES:**
```tsx
const { user, loading, setUser } = useAuthStore();
```

**DEPOIS:**
```tsx
const { user, isLoading, isAuthenticated, logout } = useAuth();
```

### 5. Usar novo AuthGuard

**ANTES:**
```tsx
// AuthGuard não tinha suporte adequado
```

**DEPOIS:**
```tsx
<AuthGuard>
  <MeuComponenteProtegido />
</AuthGuard>
```

---

## 📝 Exemplos de Migração

### Exemplo 1: Componente de Profile

**ANTES:**
```tsx
'use client';

import { useAuthStore, ADUser } from '@/lib/authStore';

export function Profile() {
  const { user } = useAuthStore();
  const adUser = user as ADUser;

  return (
    <div>
      <h1>{adUser.nome_completo}</h1>
      <p>{adUser.department}</p>
    </div>
  );
}
```

**DEPOIS:**
```tsx
'use client';

import { useCurrentUser } from '@/hooks/useAuth';

export function Profile() {
  const user = useCurrentUser();

  if (!user) return null;

  return (
    <div>
      <h1>{user.displayName}</h1>
      <p>{user.email}</p>
    </div>
  );
}
```

### Exemplo 2: Componente de Login

**ANTES:**
```tsx
// Código complexo com syncUserToFirestore
const adUser: ADUser = { ... };
await syncUserToFirestore(adUser);
setUser(adUser);
```

**DEPOIS:**
```tsx
// Código simplificado - AuthProvider cuida de tudo
const userCredential = await signInWithEmailAndPassword(auth, email, password);
// AuthProvider detecta mudança e atualiza automaticamente
// Nada mais a fazer!
```

### Exemplo 3: Verificar Autenticação

**ANTES:**
```tsx
const { user, loading } = useAuthStore();

if (loading) return <Spinner />;
if (!user) return <NotAuthenticated />;

return <Dashboard />;
```

**DEPOIS:**
```tsx
const { isLoading, isAuthenticated } = useAuth();

if (isLoading) return <Spinner />;
if (!isAuthenticated) return <NotAuthenticated />;

return <Dashboard />;
```

---

## 🔍 Validar Migração

### Checklist

- [ ] Remover `syncUserToFirestore` de todos os componentes
- [ ] Remover `import { ADUser }` (substituir por `AuthUser`)
- [ ] Remover `generateHash` (não mais necessário)
- [ ] Atualizar tipos de usuário em componentes
- [ ] Usar novo `useAuth()` hook onde apropriado
- [ ] Testar login completo
- [ ] Testar recuperação de senha
- [ ] Testar logout
- [ ] Testar persistência (abrir em nova aba, deve estar logado)

### Testes

```tsx
// Testar em browser console
localStorage.getItem('comunica-plus-auth-v2')
// Deve conter dados do usuário autenticado

// Testar logout
localStorage.removeItem('comunica-plus-auth-v2')
// Deve redirecionar para login
```

---

## ⚠️ Problemas Comuns

### 1. "user is null" error

**Problema:** Tentando acessar `user` antes de estar autenticado

**Solução:**
```tsx
if (!user) return <Loading />;
return <Component />;
```

### 2. "syncUserToFirestore is not a function"

**Problema:** Ainda tentando chamar função removida

**Solução:** Remover a call - não é mais necessária

### 3. "AuthUser não tem campo X"

**Problema:** Esperando campos de `ADUser` em `AuthUser`

**Solução:** Usar apenas campos que existem em `AuthUser`

### 4. Sessão não persiste

**Problema:** Recarregar página e precisa fazer login novamente

**Solução:** Verificar se `initAuthPersistence()` foi chamado no AuthProvider

---

## 📚 Recursos

- Novo arquivo: `/AUTHENTICATION.md`
- Hook: `/frontend/src/hooks/useAuth.ts`
- Store: `/frontend/src/lib/authStore.ts` (atualizado)
- Serviços: `/frontend/src/services/auth.ts` (atualizado)
- Login Page: `/frontend/src/app/login/page.tsx` (refatorado)

---

## ❓ Dúvidas?

Verificar documentação em `AUTHENTICATION.md` ou consultar implementação nos arquivos acima.
