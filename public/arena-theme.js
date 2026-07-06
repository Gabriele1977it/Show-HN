        // Apply the saved theme before first paint to avoid a light-mode flash.
        (function () {
            try {
                var saved = localStorage.getItem('arena-theme');
                if (!saved && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) saved = 'dark';
                if (saved) document.documentElement.setAttribute('data-theme', saved);
            } catch (e) { /* localStorage unavailable */ }
        })();

