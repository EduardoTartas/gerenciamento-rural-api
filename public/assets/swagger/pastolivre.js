(function () {
    var root = document.documentElement;
    var KEY = 'pl-docs-theme';

    function stored() {
        try { return localStorage.getItem(KEY); } catch (e) { return null; }
    }

    function isDark() {
        var t = root.getAttribute('data-theme');
        if (t) return t === 'dark';
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    // o Swagger UI 5.30+ liga um tema escuro próprio (html.dark-mode) que briga com este
    function dropNativeDark() {
        // contains() evita laço infinito: remove() sempre regrava o atributo, mesmo sem a classe
        if (root.classList.contains('dark-mode')) root.classList.remove('dark-mode');
    }
    dropNativeDark();
    new MutationObserver(dropNativeDark).observe(root, { attributes: true, attributeFilter: ['class'] });

    var saved = stored();
    if (saved === 'light' || saved === 'dark') root.setAttribute('data-theme', saved);

    var btn = document.createElement('button');
    btn.id = 'pl-theme-toggle';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Alternar tema claro/escuro');
    btn.innerHTML =
        '<svg class="pl-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>' +
        '<svg class="pl-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

    btn.addEventListener('click', function () {
        var next = isDark() ? 'light' : 'dark';
        root.setAttribute('data-theme', next);
        try { localStorage.setItem(KEY, next); } catch (e) { /* modo privado */ }
    });

    document.body.appendChild(btn);
})();
