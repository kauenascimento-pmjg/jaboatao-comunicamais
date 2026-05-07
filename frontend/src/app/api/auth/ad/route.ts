import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { user, password } = await req.json();
    const apiUrl = process.env.PYTHON_AUTH_API;

    console.log('--- AD Proxy Attempt (Next.js API) ---');
    console.log('User:', user);

    if (!apiUrl) {
      console.error('PYTHON_AUTH_API not configured in environment variables');
      return NextResponse.json(
        { error: 'Servidor de autenticação não configurado.' },
        { status: 500 }
      );
    }

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
      console.error('Python API Error:', response.status, errorText);
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
    console.error('Next.js API Auth Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error during AD auth proxy' },
      { status: 500 }
    );
  }
}
