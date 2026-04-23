import { Request, Response } from 'express';
import { getAuth } from '../services/firebase';

/**
 * Autenticação via AD + geração de custom token Firebase
 * POST /api/auth/ad
 *
 * Body: { email, password }
 * Response: { firebaseCustomToken, uid }
 */
export async function authenticateWithAD(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
      return;
    }

    console.log('[Auth] Login attempt for:', email);

    const PYTHON_AUTH_API = process.env.PYTHON_AUTH_API;

    if (!PYTHON_AUTH_API) {
      console.error('[Auth] PYTHON_AUTH_API não configurado no backend');
      res.status(500).json({ error: 'Configuração de autenticação indisponível.' });
      return;
    }

    console.log('[Auth] Calling Python AD API:', PYTHON_AUTH_API);

    // Tentativa 1: JSON POST
    let adResponse = await fetch(PYTHON_AUTH_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        username: email,
      }),
    }).catch((err) => {
      console.error('[Auth] JSON request failed:', err);
      return null;
    });

    // Tentativa 2: HTTP Basic Auth
    if (!adResponse?.ok) {
      const basicAuth = Buffer.from(`${email}:${password}`).toString('base64');
      adResponse = await fetch(PYTHON_AUTH_API, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          Accept: 'application/json',
        },
      }).catch((err) => {
        console.error('[Auth] Basic auth request failed:', err);
        return null;
      });
    }

    if (!adResponse) {
      console.error('[Auth] Both requests failed');
      res.status(503).json({ error: 'Falha ao conectar com o servidor de autenticação.' });
      return;
    }

    const adResponseText = await adResponse.text();
    console.log('[Auth] Python AD API status:', adResponse.status);

    let adPayload: Record<string, unknown> = {};
    try {
      adPayload = adResponseText ? (JSON.parse(adResponseText) as Record<string, unknown>) : {};
    } catch (parseErr) {
      console.error('[Auth] Failed to parse AD response:', parseErr);
      adPayload = { message: adResponseText };
    }

    if (!adResponse.ok) {
      const message =
        (typeof adPayload.error === 'string' && adPayload.error) ||
        (typeof adPayload.message === 'string' && adPayload.message) ||
        'Credenciais inválidas.';

      console.error('[Auth] AD authentication failed:', message);
      res.status(401).json({ error: message });
      return;
    }

    // Extrair UID do response da API AD
    const candidates = [
      adPayload.uid,
      adPayload.user_id,
      adPayload.userId,
      adPayload.id,
      adPayload.email,
      adPayload.username,
    ];

    let userId: string | null = null;
    for (const value of candidates) {
      if (typeof value === 'string' && value.trim().length > 0) {
        userId = value;
        break;
      }
    }

    userId = userId || email;
    console.log('[Auth] AD authentication successful, UID:', userId);

    // Gerar custom token do Firebase
    const { canSignTokens } = require('../services/firebase');

    if (canSignTokens()) {
      try {
        const auth = getAuth();
        const customToken = await auth.createCustomToken(userId);
        console.log('[Auth] Custom Firebase token generated successfully');

        res.status(200).json({
          firebaseCustomToken: customToken,
          uid: userId,
          profile: {
            email,
            uid: userId,
            ...((adPayload.profile as Record<string, unknown>) || (adPayload.user as Record<string, unknown>) || {}),
          },
        });
      } catch (tokenErr) {
        console.error('[Auth] Failed to generate custom token:', tokenErr);
        res.status(500).json({ error: 'Falha ao gerar token de autenticação.' });
      }
    } else {
      console.warn('[Auth] Skipping Custom Token generation: Missing Service Account credentials.');
      res.status(200).json({
        firebaseCustomToken: '',
        uid: userId,
        profile: {
          email,
          uid: userId,
          ...((adPayload.profile as Record<string, unknown>) || (adPayload.user as Record<string, unknown>) || {}),
        },
      });
    }
  } catch (error) {
    console.error('[Auth] Erro na rota de autenticação:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    res.status(500).json({ error: `Falha ao autenticar: ${message}` });
  }
}
