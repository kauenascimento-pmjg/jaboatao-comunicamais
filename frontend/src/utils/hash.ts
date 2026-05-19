import bcrypt from 'bcryptjs';

/**
 * Gera um hash seguro usando bcrypt (gera automaticamente o salt).
 * @param password A senha em texto puro.
 * @returns A promessa com o hash resultante.
 */
export async function generateHash(password: string): Promise<string> {
  const saltRounds = 10;
  return new Promise((resolve, reject) => {
    bcrypt.hash(password, saltRounds, (err, hash) => {
      if (err) reject(err);
      else if (hash) resolve(hash);
      else reject(new Error('Falha ao gerar hash'));
    });
  });
}

/**
 * Compara uma senha em texto puro com o hash salvo.
 * @param password A senha em texto puro.
 * @param hash O hash salvo no Firestore.
 * @returns true se as senhas coincidirem.
 */
export async function compareHash(password: string, hash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    bcrypt.compare(password, hash, (err, res) => {
      if (err) reject(err);
      else resolve(res === true);
    });
  });
}
