// renderer.js
const tabsEl = document.getElementById('tabs');
const bookmarksEl = document.getElementById('bookmarks');
const historyEl = document.getElementById('history');
const addressInput = document.getElementById('address');
const searchInput = document.getElementById('search');
const welcomePanel = document.getElementById('welcome-panel');
let tabCount = 0;
let tabRefs = [];
let currentTabIndex = -1;

function updateWelcomePanel() {
  welcomePanel.style.display = tabRefs.length === 0 ? 'block' : 'none';
}

function newTab() {
  const url = "ghostshell://start";
  const index = tabCount;

  window.ghostshell.newTab(url).then(() => {
    addTabUI(index, url);
    window.ghostshell.switchTab(index);
    setActiveTab(index);
    updateWelcomePanel();
  });
}

function navigateTo(rawInput) {
  const raw = rawInput.trim();
  if (!raw) return;
  const url = raw.startsWith("http") ? raw : `https://${raw}`;

  if (currentTabIndex !== -1 && tabRefs[currentTabIndex]) {
    window.ghostshell.newTab(url); // reuse handler to load in active tab
  } else {
    newTab(); // fallback to a new tab if none is active
  }

  addressInput.value = '';
}

function addTabUI(index, url) {
  const tab = document.createElement('div');
  tab.className = 'tab';
  tab.draggable = true;
  tab.dataset.index = index;
  tab.title = url;

  const favicon = document.createElement('img');
  favicon.src = `https://www.google.com/s2/favicons?domain=${new URL(url, window.location.origin).hostname}`;
  tab.appendChild(favicon);

  const label = document.createElement('span');
  label.textContent = `Tab ${index + 1}`;
  tab.appendChild(label);

  const close = document.createElement('span');
  close.textContent = '❌';
  close.className = 'close-btn';
  close.onclick = (e) => {
    e.stopPropagation();
    window.ghostshell.closeTab(index);
    tab.remove();
    tabRefs = tabRefs.filter(t => t !== tab);
    tabCount--;
    currentTabIndex = tabRefs.length > 0 ? tabRefs.length - 1 : -1;
    updateWelcomePanel();
  };
  tab.appendChild(close);

  tab.onclick = () => {
    window.ghostshell.switchTab(index);
    setActiveTab(index);
    currentTabIndex = index;
  };

  tab.oncontextmenu = (e) => {
    e.preventDefault();
    window.ghostshell.contextMenu(index);
  };

  tab.ondragstart = (e) => {
    e.dataTransfer.setData('text/plain', index);
    tab.classList.add('dragging');
  };

  tab.ondragend = () => tab.classList.remove('dragging');

  tab.ondragover = (e) => e.preventDefault();

  tab.ondrop = (e) => {
    e.preventDefault();
    const from = +e.dataTransfer.getData('text/plain');
    const to = +tab.dataset.index;
    window.ghostshell.reorderTabs(from, to);
    reorderTabElements(from, to);
  };

  tabsEl.appendChild(tab);
  tabRefs.push(tab);
  tabCount++;
  currentTabIndex = index;
}

function reorderTabElements(from, to) {
  const moving = tabRefs.splice(from, 1)[0];
  tabRefs.splice(to, 0, moving);
  tabsEl.innerHTML = '';
  tabRefs.forEach(tab => tabsEl.appendChild(tab));
  tabRefs.forEach((tab, i) => tab.dataset.index = i);
}

function setActiveTab(index) {
  tabRefs.forEach(tab => tab.classList.remove('active'));
  if (tabRefs[index]) {
    tabRefs[index].classList.add('active');
    currentTabIndex = index;
  }
}

function toggleBookmarks() {
  bookmarksEl.style.display = bookmarksEl.style.display === 'none' ? 'block' : 'none';
  if (bookmarksEl.style.display === 'block') loadBookmarks();
}

function toggleHistory() {
  historyEl.style.display = historyEl.style.display === 'none' ? 'block' : 'none';
  if (historyEl.style.display === 'block') loadHistory();
}

function bookmarkCurrent() {
  const raw = addressInput.value.trim();
  if (!raw) return;
  const url = raw.startsWith('http') ? raw : 'https://' + raw;
  const title = url;
  window.ghostshell.addBookmark({ title, url }).then(() => loadBookmarks());
}

async function loadBookmarks() {
  const bookmarks = await window.ghostshell.getBookmarks();
  bookmarksEl.innerHTML = '<h4>Bookmarks</h4>';
  if (bookmarks.length === 0) {
    bookmarksEl.innerHTML += '<p>No bookmarks saved.</p>';
    return;
  }
  bookmarks.forEach(b => {
    const item = document.createElement('div');
    item.innerHTML = `<a href="#" onclick="window.ghostshell.newTab('${b.url}')">${b.title}</a>`;
    bookmarksEl.appendChild(item);
  });
}

async function loadHistory() {
  const history = await window.ghostshell.getHistory();
  console.log("Loaded history:", history);
  historyEl.innerHTML = '<h4>History</h4>';
  if (!history || history.length === 0) {
    historyEl.innerHTML += '<p>No history available.</p>';
    return;
  }
  const query = searchInput.value.trim().toLowerCase();
  const filtered = query
    ? history.filter(h => h.url.toLowerCase().includes(query))
    : history;

  if (filtered.length === 0) {
    historyEl.innerHTML += '<p>No history found.</p>';
    return;
  }

  filtered.forEach(h => {
    const item = document.createElement('div');
    item.innerHTML = `<a href="#" onclick="window.ghostshell.newTab('${h.url}')">${h.url}</a> <small> - ${new Date(h.date).toLocaleString()}</small>`;
    historyEl.appendChild(item);
  });
}

searchInput.addEventListener('input', loadHistory);

window.toggleBookmarks = toggleBookmarks;
window.bookmarkCurrent = bookmarkCurrent;
window.toggleHistory = toggleHistory;
window.newTab = newTab;

window.onload = () => {
  addressInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') navigateTo(addressInput.value);
  });
  updateWelcomePanel();
};