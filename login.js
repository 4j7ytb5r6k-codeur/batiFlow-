// Page de connexion
const form = document.getElementById('loginForm');
const msg = document.getElementById('formMsg');
const say = (t, ok) => { msg.textContent = t; msg.className = 'form__msg ' + (ok ? 'is-ok' : 'is-error'); };

if (!window.bfClient) document.getElementById('demoNote').hidden = false;
else window.bfClient.auth.getSession().then(({ data }) => { if (data.session) location.replace('app.html'); });

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!window.bfClient) { location.href = 'app.html'; return; }
  const email = form.email.value.trim(), password = form.password.value;
  if (!email || !password) return say('Saisissez votre email et votre mot de passe.');
  const { error } = await window.bfClient.auth.signInWithPassword({ email, password });
  if (error) return say(/confirm/i.test(error.message) ? 'Confirmez d\'abord votre adresse email (lien reçu par mail).' : 'Email ou mot de passe incorrect.');
  location.href = 'app.html';
});

document.getElementById('forgot').addEventListener('click', async (e) => {
  e.preventDefault();
  const email = form.email.value.trim();
  if (!window.bfClient) return say('Disponible une fois Supabase configuré.');
  if (!email) return say('Saisissez d\'abord votre email ci-dessus.');
  const { error } = await window.bfClient.auth.resetPasswordForEmail(email, { redirectTo: new URL('app.html', location.href).href });
  error ? say('Impossible d\'envoyer le mail, réessayez.') : say('Si un compte existe, un lien de réinitialisation vient d\'être envoyé.', true);
});
