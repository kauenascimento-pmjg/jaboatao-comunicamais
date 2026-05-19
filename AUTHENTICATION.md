# 🔐 Sistema de Autenticação - Documentação Completa

## Visão Geral

O sistema de autenticação foi refatorado para usar **apenas Firebase Authentication**, sem depender do Firestore para dados de autenticação.

### Principais Mudanças:

✅ **Remover Firestore da autenticação**  
✅ **Usar Firebase Auth nativa para todo o fluxo**  
✅ **Persistência automática de sessão**  
✅ **Senhas criptografadas automaticamente**  
✅ **Sem armazenamento de senhas em texto puro**  

---

## 🔄 Fluxo de Autenticação

### 1️⃣ PRIMEIRO ACESSO (Novo Usuário)

```
Email → Validação de Domínio → Link Enviado → Define Senha → Conta Criada
```

**Passo a passo:**

1. Usuário acessa `/login`
2. Informa e-mail institucional (@jaboatao.pe.gov.br)
3. Sistema valida domínio e verifica se usuário existe
4. Se novo: envia link mágico por e-mail
5. Usuário clica link e é redirecionado para `/login`
6. Define senha (requisitos: 8 chars, maiúscula, minúscula, número, caractere especial)
7. Firebase Auth cria conta com email + senha
8. Sessão iniciada automaticamente
9. Redireciona para `/chat`

### 2️⃣ LOGIN NORMAL (Usuário Existente)

```
Email → Validação → Login com Senha → Sessão Persistida
```

**Passo a passo:**

1. Usuário acessa `/login`
2. Informa e-mail institucional
3. Sistema verifica se usuário existe no Firebase Auth
4. Se existe: mostra tela de login com senha
5. Digita senha
6. `signInWithEmailAndPassword()` autentica
7. AuthProvider detecta e atualiza estado
8. Redireciona para `/chat`

### 3️⃣ RECUPERAÇÃO DE SENHA

```
Email → Link de Reset → Nova Senha → Conta Atualizada
```

**Passo a passo:**

1. Usuário clica em "Esqueci minha senha"
2. Informa e-mail
3. Sistema envia link de redefinição
4. Usuário clica link e é redirecionado para `/login?mode=resetPassword&oobCode=...`
5. Define nova senha
6. Firebase Auth atualiza a senha
7. Pode fazer login com nova senha

---

## 📁 Arquitetura de Arquivos

```
frontend/
├── src/
│   ├── app/
│   │   └── login/
│   │       └── page.tsx          ← Página principal de autenticação
│   │
│   ├── components/
│   │   └── providers/
│   │       ├── AuthProvider.tsx   ← Gerencia estado auth global
│   │       ├── AuthGuard.tsx      ← Protege rotas
│   │       └── ThemeProvider.tsx
│   │
│   ├── hooks/
│   │   └── useAuth.ts            ← Hook para acessar auth
│   │
│   ├── lib/
│   │   ├── firebase.ts           ← Inicialização Firebase
│   │   ├── authStore.ts          ← Zustand store (auth state)
│   │   └── chatService.ts        ← Serviços de chat/firestore
│   │
│   └── services/
│       └── auth.ts               ← Serviços de autenticação
```

---

## 🔑 Chave de Acessos

### Componentes

#### 1. AuthProvider
**Onde:** `frontend/src/components/providers/AuthProvider.tsx`

```tsx
'use client';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Monitora onAuthStateChanged do Firebase
  // Atualiza Zustand store automaticamente
  return <>{children}</>;
}
```

**O que faz:**
- Escuta mudanças de autenticação do Firebase
- Atualiza store global
- Persiste sessão entre abas/navegadores

#### 2. AuthGuard
**Onde:** `frontend/src/components/providers/AuthGuard.tsx`

```tsx
'use client';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  // Verifica se usuário está autenticado
  // Redireciona para /login se não estiver
  return <>{children}</>;
}
```

**Uso:**
```tsx
// app/chat/layout.tsx
<AuthGuard>
  <ChatLayout>{children}</ChatLayout>
</AuthGuard>
```

### Hooks

#### useAuth()
**Onde:** `frontend/src/hooks/useAuth.ts`

```tsx
const { user, isAuthenticated, isLoading, logout } = useAuth();
```

**Retorna:**
- `user`: Dados do usuário autenticado
- `isAuthenticated`: Boolean
- `isLoading`: Carregando?
- `logout()`: Função para fazer logout

#### useIsAuthenticated()
```tsx
const isAuth = useIsAuthenticated();
if (!isAuth) return <NotAuthenticated />;
```

#### useCurrentUser()
```tsx
const user = useCurrentUser();
console.log(user.email, user.displayName);
```

### Store (Zustand)

**Onde:** `frontend/src/lib/authStore.ts`

```tsx
import { useAuthStore } from '@/lib/authStore';

// Dentro de um componente 'use client'
const { user, loading, setUser, setLoading, logout } = useAuthStore();
```

**Estado:**
```typescript
interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  createdAt: Date | null;
}
```

### Serviços de Autenticação

**Onde:** `frontend/src/services/auth.ts`

#### `initAuthPersistence()`
```tsx
await initAuthPersistence();
```
Ativa persistência local (browserLocalPersistence)

#### `isInstitutionalEmail(email: string)`
```tsx
const valid = isInstitutionalEmail('kaue@jaboatao.pe.gov.br');
// true
```

#### `checkUserHasPassword(email: string)`
```tsx
const exists = await checkUserHasPassword('kaue@jaboatao.pe.gov.br');
if (exists) {
  // Usuário já criou senha, ir para login
} else {
  // Novo usuário, enviar link
}
```

#### `sendFirstAccessLink(email: string, redirectUrl: string)`
```tsx
await sendFirstAccessLink('kaue@jaboatao.pe.gov.br', 'http://localhost:3000/login');
// Envia link mágico para criar conta
```

#### `sendRecoveryLink(email: string)`
```tsx
await sendRecoveryLink('kaue@jaboatao.pe.gov.br');
// Envia link de redefinição de senha
```

---

## 🛠️ Como Usar em Componentes

### Exemplo 1: Verificar se usuário está logado

```tsx
'use client';

import { useAuth } from '@/hooks/useAuth';

export function MyComponent() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <div>Carregando...</div>;
  if (!isAuthenticated) return <div>Faça login</div>;

  return (
    <div>
      Bem-vindo, {user?.displayName}!
    </div>
  );
}
```

### Exemplo 2: Fazer logout

```tsx
'use client';

import { useAuth } from '@/hooks/useAuth';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export function LogoutButton() {
  const { logout } = useAuth();

  const handleLogout = async () => {
    await signOut(auth);
    logout();
  };

  return (
    <button onClick={handleLogout}>
      Sair
    </button>
  );
}
```

### Exemplo 3: Proteger uma página

```tsx
// app/chat/page.tsx
'use client';

import { AuthGuard } from '@/components/providers/AuthGuard';
import { ChatPage } from '@/components/ChatPage';

export default function Page() {
  return (
    <AuthGuard>
      <ChatPage />
    </AuthGuard>
  );
}
```

### Exemplo 4: Obter dados do usuário

```tsx
'use client';

import { useCurrentUser } from '@/hooks/useAuth';

export function UserProfile() {
  const user = useCurrentUser();

  if (!user) return null;

  return (
    <div>
      <h1>{user.displayName}</h1>
      <p>{user.email}</p>
      <p>Verificado: {user.emailVerified ? 'Sim' : 'Não'}</p>
    </div>
  );
}
```

---

## 🔒 Segurança

### Boas Práticas Implementadas:

1. **Senhas Criptografadas**
   - Firebase Auth usa bcrypt internamente
   - Nunca salva senhas em texto puro
   - Salt aleatório por usuário

2. **Persistência Segura**
   - `browserLocalPersistence` apenas em cliente
   - ID tokens assinados e verificáveis
   - Expiração automática

3. **Validação de Domínio**
   - Apenas @jaboatao.pe.gov.br permitido
   - Validação no frontend e backend

4. **Proteção de Rotas**
   - AuthGuard verifica autenticação antes de renderizar
   - Redirecionamento para /login automático

5. **Tratamento de Erros**
   - Códigos de erro específicos
   - Mensagens amigáveis (não revelam se usuário existe)
   - Rate limiting do Firebase Auth

---

## 🐛 Debugging

### Ver estado de autenticação no console

```tsx
// Dentro de um componente 'use client'
import { useAuthStore } from '@/lib/authStore';

const store = useAuthStore();
console.log('Auth Store:', store);
```

### Logs do Firebase Auth

O Firebase Auth já loga eventos automaticamente:

```
[Auth] Processing password reset link
[Auth] User exists, going to login step
[Auth] Attempting login for: kaue@jaboatao.pe.gov.br
[Auth] Login successful: abc123xyz
```

### Forçar logout

```tsx
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

await signOut(auth);
```

---

## 📋 Checklist de Implementação

- ✅ AuthProvider configurado
- ✅ AuthGuard protegendo rotas
- ✅ Página de login com fluxo completo
- ✅ Hooks de autenticação
- ✅ Zustand store
- ✅ Serviços de auth
- ✅ Persistência de sessão
- ✅ Validação de domínio
- ✅ Recuperação de senha
- ✅ Tratamento de erros

---

## 🔗 Referências

- [Firebase Auth Docs](https://firebase.google.com/docs/auth)
- [Firebase Auth JavaScript SDK](https://firebase.google.com/docs/auth/web/start)
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [Next.js App Router](https://nextjs.org/docs/app)

---

## 📞 Suporte

Para dúvidas ou problemas:

1. Verificar logs do Firebase Auth console
2. Consultar [Firebase Documentation](https://firebase.google.com/docs)
3. Verificar [console.firebase.google.com](https://console.firebase.google.com)
