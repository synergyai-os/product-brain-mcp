/**
 * SynergyOS Marketing — Shared Animations
 *
 * Usage:
 *   <script src="/shared/animations.js" defer></script>
 *
 * Automatically observes all elements with class "fade-in"
 * and adds "visible" when they scroll into view.
 */
(function () {
  'use strict';

  var observer = new IntersectionObserver(
    function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          entries[i].target.classList.add('visible');
        }
      }
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
  );

  document.querySelectorAll('.fade-in').forEach(function (el) {
    observer.observe(el);
  });
})();
