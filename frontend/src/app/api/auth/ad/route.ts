import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { user, password } = await request.json();
    
    // URL da API do AD (deve ser configurada nas variáveis de ambiente do App Hosting)
    // Usamos a variável definida no .env.local ou a padrão
    const apiUrl = process.env.PYTHON_AUTH_API || 'http://10.224.0.65:80/auth/basic';

    console.log('--- AD Auth Attempt (Next.js API) ---');
    console.log('User:', user);

    // Codificação Basic Auth
    const basicAuth = Buffer.from(`${user}:${password}`).toString('base64');

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        user, 
        usuario: user,
        username: user,
        senha: password, 
        password: password 
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AD API Error:', errorText);
      return NextResponse.json(
        { error: 'Falha na autenticação AD', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json() as any;
    console.log('Login Success for:', user);

    // Extrair dados do usuário da resposta da API AD
    const apiUser = data.user || {};
    const uid = apiUser.username || apiUser.user || user;

    return NextResponse.json({ success: true, user: apiUser, uid });
  } catch (error) {
    console.error('Next.js AD Auth Error:', error);
    return NextResponse.json(
      { error: 'Erro interno no servidor durante a autenticação AD' },
      { status: 500 }
    );
  }
}
