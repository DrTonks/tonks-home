// Runs inline before the public fallback is parsed, without waiting for the app bundle.
// This is a presentation guard, not a separate loading animation or crawler policy.
export function startHomeBootstrap() {
 const root = document.documentElement;
 root.setAttribute('data-home-boot', 'pending');
 const timeout = window.setTimeout(finish, 8000);
 function finish() {
  window.clearTimeout(timeout);
  root.removeAttribute('data-home-boot');
  window.removeEventListener('error', resourceError, true);
  document.removeEventListener('tonks:app-mounted', finish);
 }
 function resourceError(event) {
  if (event.target instanceof HTMLScriptElement && event.target.type === 'module') finish();
 }
 window.addEventListener('error', resourceError, true);
 document.addEventListener('tonks:app-mounted', finish, {once: true});
}

export const homeBootstrapScript = `<script id="home-bootstrap">(${startHomeBootstrap.toString()})();</script>`;
export const homeBootstrapStyle = `<style>
html[data-home-boot] #static-profile{display:none}
html[data-home-boot],html[data-home-boot] body{margin:0;background:hsl(var(--background, 207 30% 97%))}
html.dark[data-home-boot],html.dark[data-home-boot] body{background:hsl(var(--background, 222 47% 5%))}
</style>`;
