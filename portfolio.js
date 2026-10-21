const toggleBtn = document.getElementById('toggleBtn');
const burgerBtn = document.getElementById('burgerBtn');
const mobileMenu = document.getElementById('mobileMenu');

let savedTheme = null;
try { savedTheme = localStorage.getItem('theme'); } catch (e) {}

let isDark = savedTheme
  ? savedTheme === 'dark'
  : window.matchMedia('(prefers-color-scheme: dark)').matches;
if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);
toggleBtn.classList.toggle('is-dark', isDark);

toggleBtn.addEventListener('click', () => {
  isDark = !isDark;
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  toggleBtn.classList.toggle('is-dark', isDark);
  try { localStorage.setItem('theme', isDark ? 'dark' : 'light'); } catch (e) {}
});

burgerBtn.addEventListener('click', () => {
  const isOpen = mobileMenu.classList.toggle('open');
  burgerBtn.classList.toggle('open', isOpen);
  burgerBtn.setAttribute('aria-expanded', isOpen);
  burgerBtn.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
});

mobileMenu.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    mobileMenu.classList.remove('open');
    burgerBtn.classList.remove('open');
    burgerBtn.setAttribute('aria-expanded', false);
    burgerBtn.setAttribute('aria-label', 'Open menu');
  });
});

// Scroll-down arrow (home only): hides once the page is scrolled, comes back at the top
const scrollArrow = document.getElementById('scrollArrow');

if (scrollArrow) {
  const updateArrow = () => {
    scrollArrow.classList.toggle('is-hidden', window.scrollY > 40);
  };

  window.addEventListener('scroll', updateArrow, { passive: true });
  updateArrow();

  scrollArrow.addEventListener('click', () => {
    document.querySelector('.work-grid').scrollIntoView({ behavior: 'smooth' });
  });
}