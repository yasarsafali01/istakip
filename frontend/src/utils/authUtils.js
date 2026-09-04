/**
 * Kullanıcı listesinde email ile kullanıcı arar.
 * @param {Array} users
 * @param {string} email
 * @returns {Object|undefined}
 */
export function getUserByEmail(users, email) {
  return users.find(u => u.email.toLowerCase() === email.toLowerCase());
}

/**
 * Email ve şifre kombinasyonunu doğrular.
 * @param {Array} users
 * @param {string} email
 * @param {string} password
 * @returns {{ success: boolean, user?: Object, error?: string }}
 */
export function validateCredentials(users, email, password) {
  if (!email || !password) {
    return { success: false, error: 'Email ve şifre zorunludur.' };
  }
  const user = getUserByEmail(users, email);
  if (!user) {
    return { success: false, error: 'Kullanıcı adı veya şifre hatalı.' };
  }
  if (user.password !== password) {
    return { success: false, error: 'Kullanıcı adı veya şifre hatalı.' };
  }
  return { success: true, user };
}

/**
 * Kullanıcı nesnesinden güvenli (şifresiz) profil bilgisi döner.
 * @param {Object} user
 * @returns {Object}
 */
export function getSafeUserProfile(user) {
  if (!user) return null;
  const { password, ...safeUser } = user;
  return safeUser;
}
