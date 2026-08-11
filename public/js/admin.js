/* TechPortables - admin client script */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    // Theme toggle
    document.querySelectorAll('#themeToggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        var next = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        try { localStorage.setItem('theme', next); } catch (e) {}
      });
    });

    // Sidebar toggle (mobile)
    var menuBtn = document.getElementById('adminMenuBtn');
    var sidebar = document.getElementById('adminSidebar');
    if (menuBtn && sidebar) {
      menuBtn.addEventListener('click', function () { sidebar.classList.toggle('open'); });
      document.addEventListener('click', function (e) {
        if (window.innerWidth <= 760 && sidebar.classList.contains('open') &&
            !sidebar.contains(e.target) && e.target !== menuBtn && !menuBtn.contains(e.target)) {
          sidebar.classList.remove('open');
        }
      });
    }

    // Confirm before destructive submit
    document.querySelectorAll('form.js-confirm').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        if (!window.confirm(form.dataset.confirm || 'Confirmer ?')) e.preventDefault();
      });
    });
  });
})();
