const themeBtn = document.getElementById('theme-btn');
const themeLabel = document.getElementById('theme-label');

function change_theme_label() {
    const isDark = document.documentElement.dataset.theme === 'dark';
    themeLabel.textContent = isDark ? 'light': 'dark';
}

themeBtn.addEventListener('click', function() {
    const isDark = document.documentElement.dataset.theme === 'dark';
    const next = isDark ? 'light': 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('theme', next)
    change_theme_label();
})
change_theme_label();