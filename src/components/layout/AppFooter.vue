<template>
  <footer class="app-footer" aria-label="网站备案信息">
    <div class="app-footer__content">
      <span>© 2026 Dr.Tonks. All Rights Reserved.</span>
      <span class="app-footer__divider" aria-hidden="true">·</span>
      <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">
        闽ICP备2024074456号-1
      </a>
    </div>
  </footer>
</template>

<style scoped>
.app-footer {
  position: fixed;
  z-index: 35;
  right: 0;
  bottom: max(6px, env(safe-area-inset-bottom));
  left: 0;
  display: flex;
  justify-content: center;
  padding: 0 3.5rem;
  pointer-events: none;
}

.app-footer__content {
  display: inline-flex;
  max-width: 100%;
  min-height: 24px;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  border: 1px solid transparent;
  border-radius: 999px;
  padding: 0.25rem 0.7rem;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--background) / 0);
  font-size: 9px;
  letter-spacing: 0.035em;
  line-height: 1.3;
  opacity: 0.2;
  pointer-events: auto;
  transition:
    opacity 220ms ease,
    border-color 220ms ease,
    background-color 220ms ease,
    box-shadow 220ms ease,
    backdrop-filter 220ms ease;
}

.app-footer__content:hover,
.app-footer__content:focus-within {
  border-color: hsl(var(--border) / 0.75);
  background: hsl(var(--background) / 0.72);
  box-shadow: 0 6px 22px hsl(var(--foreground) / 0.08);
  backdrop-filter: blur(12px);
  opacity: 0.86;
}

.app-footer a {
  color: inherit;
  transition: color 160ms ease;
}

.app-footer a:hover,
.app-footer a:focus-visible {
  color: hsl(var(--primary));
  outline: none;
}

@media (max-width: 520px) {
  .app-footer {
    padding: 0 2.75rem;
  }

  .app-footer__content {
    flex-wrap: wrap;
    gap: 0.15rem 0.35rem;
    text-align: center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-footer__content,
  .app-footer a {
    transition: none;
  }
}
</style>
