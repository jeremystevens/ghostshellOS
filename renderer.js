// renderer.js
const tabsEl = document.getElementById('tabs');
const bookmarksEl = document.getElementById('bookmarks');
const historyEl = document.getElementById('history');
const addressInput = document.getElementById('address');
const searchInput = document.getElementById('search');
const welcomePanel = document.getElementById('welcome-panel');
const contentFrame = document.getElementById('content-frame'); // Reference to content window/frame
let tabCount = 0;
let tabRefs = [];
let currentTabIndex = -1;
let tabUrls = []; // Store URLs for each tab

function updateWelcomePanel() {
  welcomePanel.style.display = tabRefs.length === 0 ? 'block' : 'none';
  if (tabRefs.length === 0) {
    // Hide the content frame when no tabs are open
    if (contentFrame) contentFrame.style.display = 'none';
  } else {
    // Show the content frame when tabs are open
    if (contentFrame) contentFrame.style.display = 'block';
  }
}

function newTab() {
  const url = "ghostshell://start";
  const index = tabCount;
  
  window.ghostshell.newTab(url).then(() => {
    addTabUI(index, url);
    window.ghostshell.switchTab(index);
    setActiveTab(index);
    updateWelcomePanel();
    
    // Store the URL for this tab
    tabUrls[index] = url;
    
    // Update address bar
    addressInput.value = url !== "ghostshell://start" ? url : '';
  });
}

function navigateTo(rawInput) {
  const raw = rawInput.trim();
  if (!raw) return;
  const url = raw.startsWith("http") ? raw : `https://${raw}`;

  if (currentTabIndex !== -1 && tabRefs[currentTabIndex]) {
    // Update the URL in our tracking array
    tabUrls[currentTabIndex] = url;
    // Navigate the current tab
    window.ghostshell.navigateCurrentTab(url);
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
  tab.dataset.url = url; // Store URL in the data attribute
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
    tabUrls[index] = null; // Clear the URL for this tab
    
    // If we close the current tab, update the current tab index
    if (currentTabIndex === index) {
      currentTabIndex = tabRefs.length > 0 ? tabRefs.length - 1 : -1;
      if (currentTabIndex >= 0) {
        window.ghostshell.switchTab(currentTabIndex);
        setActiveTab(currentTabIndex);
      }
    }
    
    updateWelcomePanel();
  };
  tab.appendChild(close);

  tab.onclick = () => {
    window.ghostshell.switchTab(index);
    setActiveTab(index);
    
    // Update the address bar to match the selected tab's URL
    if (tabUrls[index]) {
      addressInput.value = tabUrls[index] !== "ghostshell://start" ? tabUrls[index] : '';
    }
    
    // This will tell the main process to update the content window
    window.ghostshell.updateContentWindow(index);
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
  
  // Store the URL for this tab
  tabUrls[index] = url;
}

function reorderTabElements(from, to) {
  // Reorder the tabs array
  const moving = tabRefs.splice(from, 1)[0];
  tabRefs.splice(to, 0, moving);
  
  // Also reorder the URLs array to keep them in sync
  const movingUrl = tabUrls.splice(from, 1)[0];
  tabUrls.splice(to, 0, movingUrl);
  
  tabsEl.innerHTML = '';
  tabRefs.forEach((tab, i) => {
    tab.dataset.index = i;
    tabsEl.appendChild(tab);
  });
}

function setActiveTab(index) {
  tabRefs.forEach(tab => tab.classList.remove('active'));
  if (tabRefs[index]) {
    tabRefs[index].classList.add('active');
    currentTabIndex = index;
    
    // Update the address bar with the current tab's URL
    if (tabUrls[index]) {
      addressInput.value = tabUrls[index] !== "ghostshell://start" ? tabUrls[index] : '';
    }
    
    // Make sure the content frame is visible
    if (contentFrame) contentFrame.style.display = 'block';
  }
}

// Handler for URL updates from the backend
window.ghostshell.onUrlChanged = (index, newUrl) => {
  // Update our stored URL
  tabUrls[index] = newUrl;
  
  // If this is the current tab, update the address bar
  if (index === currentTabIndex) {
    addressInput.value = newUrl !== "ghostshell://start" ? newUrl : '';
  }
  
  // Update the tab title/tooltip
  if (tabRefs[index]) {
    tabRefs[index].title = newUrl;
    tabRefs[index].dataset.url = newUrl;
  }
};

function toggleBookmarks() {
  bookmarksEl.style.display = bookmarksEl.style.display === 'none' ? 'block' : 'none';
  if (bookmarksEl.style.display === 'block') loadBookmarks();
}

function toggleHistory() {
  historyEl.style.display = historyEl.style.display === 'none' ? 'block' : 'none';
  if (historyEl.style.display === 'block') loadHistory();
}

function bookmarkCurrent() {
  // Use the current tab's URL for bookmarking
  if (currentTabIndex !== -1 && tabUrls[currentTabIndex]) {
    const url = tabUrls[currentTabIndex];
    const title = url;
    window.ghostshell.addBookmark({ title, url }).then(() => loadBookmarks());
  }
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
    item.innerHTML = `<a href="#" onclick="navigateTo('${b.url}'); return false;">${b.title}</a>`;
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
    item.innerHTML = `<a href="#" onclick="navigateTo('${h.url}'); return false;">${h.url}</a> <small> - ${new Date(h.date).toLocaleString()}</small>`;
    historyEl.appendChild(item);
  });
}

searchInput.addEventListener('input', loadHistory);

window.toggleBookmarks = toggleBookmarks;
window.bookmarkCurrent = bookmarkCurrent;
window.toggleHistory = toggleHistory;
window.newTab = newTab;
window.navigateTo = navigateTo;

window.onload = () => {
  addressInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') navigateTo(addressInput.value);
  });
  updateWelcomePanel();
};