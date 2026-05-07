import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[${requestId}] --- AD Auth Attempt Started ---`);
  
  try {
    const body = await request.json();
    const { user } = body;
    
    // URL da API do AD
    const apiUrl = process.env.PYTHON_AUTH_API || 'http://10.224.0.65:80/auth/basic';

    console.log(`[${requestId}] User:`, user);
    console.log(`[${requestId}] Target API URL:`, apiUrl);

    // Verificação de loop (se a API URL for igual ao próprio frontend)
    if (apiUrl.includes('hosted.app')) {
      console.error(`[${requestId}] CRITICAL ERROR: Loop detected! apiUrl points to the frontend itself.`);
      return NextResponse.json(
        { error: 'Configuração incorreta do servidor (Loop de API)', details: 'PYTHON_AUTH_API está apontando para o próprio frontend.' },
        { status: 500 }
      );
    }

    // Codificação Basic Auth
    const basicAuth = Buffer.from(`${user}:${body.password}`).toString('base64');

    console.log(`[${requestId}] Sending fetch request...`);
    
    // Adicionando timeout de 10 segundos
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
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
          senha: body.password, 
          password: body.password 
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[${requestId}] AD API Error (Status ${response.status}):`, errorText);
        return NextResponse.json(
          { error: 'Falha na autenticação AD', details: errorText },
          { status: response.status }
        );
      }

      interface ADResponse {
        user?: {
          username?: string;
          user?: string;
          [key: string]: unknown;
        };
        [key: string]: unknown;
      }

      const data = (await response.json()) as ADResponse;
      console.log(`[${requestId}] Login Success for:`, user);

      const apiUser = data.user || {};
      const uid = apiUser.username || apiUser.user || user;

      return NextResponse.json({ success: true, user: apiUser, uid });

    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error(`[${requestId}] Fetch Timeout after 10s`);
        return NextResponse.json(
          { error: 'Timeout na conexão com o AD', details: 'O servidor AD demorou muito para responder ou está inacessível.' },
          { status: 504 }
        );
      }
      throw fetchError;
    }

  } catch (error: any) {
    console.error(`[${requestId}] Next.js AD Auth Exception:`, error);
    return NextResponse.json(
      { 
        error: 'Erro interno no servidor durante a autenticação AD', 
        details: error instanceof Error ? error.message : String(error),
        env_check: process.env.PYTHON_AUTH_API ? 'Variable present' : 'Variable MISSING'
      },
      { status: 500 }
    );
  }
}
