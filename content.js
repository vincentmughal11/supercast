// Main state for the extension
let state = {
  isOverlayVisible: false,
  isMaximized: false,
  pinnedSites: [],
  readingList: [],
  currentMode: 'command', // 'command', 'summarize', 'askPage', 'search', 'changeTheme'
  currentWebsite: window.location.hostname,
  activeCommand: null,
  searchWebsite: null,
  lastContent: null, // Cache for extracted content
  pendingRequest: false, // Flag to prevent multiple simultaneous requests
  theme: 'light' // 'light' or 'dark'
};

// Load saved data from Chrome storage
function loadStoredData() {
  chrome.storage.local.get(['pinnedSites', 'readingList', 'theme'], (result) => {
    if (result.pinnedSites) state.pinnedSites = result.pinnedSites;
    if (result.readingList) state.readingList = result.readingList;
    if (result.theme) state.theme = result.theme;
  });
}

// Initialize storage on first load
function initializeStorage() {
  chrome.storage.sync.get(['pinnedSites', 'readingList'], function(result) {
    if (!result.pinnedSites) {
      chrome.storage.sync.set({ pinnedSites: [] });
    }
    if (!result.readingList) {
      chrome.storage.sync.set({ readingList: [] });
    }
  });
}

// Create and inject the overlay into the page
function createOverlay() {
  // Create the main overlay container
  const overlay = document.createElement('div');
  overlay.id = 'supercast-overlay';
  overlay.className = 'supercast-overlay supercast-hidden';
  
  // Create the container for all content
  const container = document.createElement('div');
  container.className = 'supercast-container';
  
  // Create the input container (top section with input and buttons)
  const inputContainer = document.createElement('div');
  inputContainer.className = 'supercast-input-container';
  
  // Create the input field
  const input = document.createElement('input');
  input.id = 'supercast-input';
  input.type = 'text';
  input.placeholder = 'Enter your command...';
  input.addEventListener('keydown', handleInputKeyDown);
  
  // Create the button container for the right side
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'supercast-buttons';
  
  // Create document button (left icon in reference)
  const docButton = document.createElement('button');
  docButton.className = 'supercast-button supercast-doc-button';
  docButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="none" d="M0 0h24v24H0z"/><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z"/></svg>`;
  docButton.title = 'Add to Reading List';
  docButton.addEventListener('click', handleDocumentView);
  
  // Create pin button (middle icon in reference)
  const pinButton = document.createElement('button');
  pinButton.className = 'supercast-pin-button';
  pinButton.title = 'Pin this site';
  pinButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M14 4v5c0 1.12.37 2.16 1 3H9c.65-.86 1-1.9 1-3V4h4zm3-2H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3V4h1c.55 0 1-.45 1-1s-.45-1-1-1z"></path></svg>`;
  pinButton.addEventListener('click', handlePinSite);
  
  // Create maximize button (right icon in reference)
  const maxButton = document.createElement('button');
  maxButton.className = 'supercast-max-button';
  maxButton.title = 'Maximize';
  maxButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 16H5V5h14v14zM7 10h10v2H7z"></path></svg>`;
  maxButton.addEventListener('click', toggleMaximize);
  
  // Add buttons to container
  buttonContainer.appendChild(docButton);
  buttonContainer.appendChild(pinButton);
  buttonContainer.appendChild(maxButton);
  
  // Add input and buttons to input container
  inputContainer.appendChild(input);
  inputContainer.appendChild(buttonContainer);
  
  // Create expanded content (shown when maximized)
  const expandedContent = document.createElement('div');
  expandedContent.id = 'supercast-expanded-content';
  expandedContent.className = 'supercast-expanded-content supercast-hidden';
  
  // Create quick actions section
  const quickActions = document.createElement('div');
  quickActions.className = 'supercast-quick-actions';
  
  // Add quick action buttons
  const actions = ['Quick actions', 'Summarize', 'Search', 'Ask'];
  actions.forEach(action => {
    const actionButton = document.createElement('button');
    actionButton.textContent = action;
    actionButton.addEventListener('click', () => handleQuickAction(action));
    quickActions.appendChild(actionButton);
  });
  
  // Create pinned tabs section
  const pinnedTabs = document.createElement('div');
  pinnedTabs.className = 'supercast-pinned-tabs';
  
  // Add 3 example pinned tabs with placeholder favicons
  for (let i = 0; i < 3; i++) {
    const tab = document.createElement('div');
    tab.className = 'supercast-tab';
    const img = document.createElement('img');
    img.src = 'https://www.google.com/s2/favicons?domain=google.com&sz=32';
    img.alt = 'Example Tab';
    img.onerror = () => img.style.display = 'none';
    tab.appendChild(img);
    pinnedTabs.appendChild(tab);
  }
  
  // Create reading list section
  const readingList = document.createElement('div');
  readingList.className = 'supercast-reading-list';
  
  // Create reading list header
  const readingListHeader = document.createElement('div');
  readingListHeader.className = 'supercast-reading-list-header';
  
  const readingListTitle = document.createElement('h3');
  readingListTitle.textContent = 'Reading List';
  
  const viewAllButton = document.createElement('button');
  viewAllButton.textContent = 'View All';
  viewAllButton.addEventListener('click', handleViewAllReadingList);
  
  readingListHeader.appendChild(readingListTitle);
  readingListHeader.appendChild(viewAllButton);
  
  // Create reading list items
  const readingListItems = document.createElement('div');
  readingListItems.className = 'supercast-reading-list-items';
  
  // Add example reading list items
  const exampleItems = ['Example website', 'Example website', 'Example website'];
  exampleItems.forEach((item) => {
    const readingItem = document.createElement('div');
    readingItem.className = 'supercast-reading-item';
    const favicon = document.createElement('img');
    favicon.src = 'https://www.google.com/s2/favicons?domain=google.com&sz=16';
    favicon.className = 'supercast-reading-item-favicon';
    favicon.onerror = () => favicon.style.display = 'none';
    readingItem.appendChild(favicon);
    const text = document.createElement('span');
    text.textContent = 'Example website';
    readingItem.appendChild(text);
    readingListItems.appendChild(readingItem);
  });
  
  // Assemble the reading list
  readingList.appendChild(readingListHeader);
  readingList.appendChild(readingListItems);
  
  // Add all sections to expanded content
  expandedContent.appendChild(quickActions);
  expandedContent.appendChild(pinnedTabs);
  expandedContent.appendChild(readingList);
  
  // Add all elements to the container
  container.appendChild(inputContainer);
  container.appendChild(expandedContent);
  
  // Add container to overlay
  overlay.appendChild(container);
  
  // Add overlay to body
  document.body.appendChild(overlay);
  
  return overlay;
}

// Handle keyboard input in the overlay
function handleInputKeyDown(e) {
  if (e.key === 'Enter') {
    const input = document.getElementById('supercast-input');
    const command = input.value.trim();
    
    if (command) {
      processCommand(command);
      input.value = '';
    }
  } else if (e.key === 'Escape') {
    hideOverlay();
  }
}

// Handler functions for the UI elements
function handleDocumentView() {
  // Change function to add to reading list instead
  handleAddToReadingList();
}

function handlePinSite() {
  const currentUrl = window.location.href;
  const currentTitle = document.title || 'Unnamed Site';
  
  chrome.storage.sync.get(['pinnedSites'], function(result) {
    let pinnedSites = result.pinnedSites || [];
    const favicon = `https://www.google.com/s2/favicons?domain=${window.location.hostname}&sz=32`;
    
    // Check if already pinned
    const existingPinIndex = pinnedSites.findIndex(site => site.url === currentUrl);
    
    if (existingPinIndex >= 0) {
      // If already pinned, remove it (toggle functionality)
      pinnedSites.splice(existingPinIndex, 1);
      showMessage(`Unpinned: ${currentTitle}`);
    } else {
      // Add new pin
      pinnedSites.push({
        url: currentUrl,
        title: currentTitle,
        favicon: favicon,
        addedAt: new Date().toISOString()
      });
      showMessage(`Pinned: ${currentTitle}`);
      
      // Limit to most recent 10 pins
      if (pinnedSites.length > 10) {
        // Remove the oldest pin
        pinnedSites.shift();
        showMessage('Removed oldest pin to stay within 10 pin limit');
      }
    }
    
    // Store back to storage
    chrome.storage.sync.set({ pinnedSites }, function() {
      // Update the UI if expanded
      if (state.isMaximized) {
        updatePinnedTabs();
      }
    });
  });
}

function updatePinnedTabs() {
  const pinnedTabsContainer = document.querySelector('.supercast-pinned-tabs');
  if (!pinnedTabsContainer) return;
  
  // Clear existing tabs
  pinnedTabsContainer.innerHTML = '';
  
  chrome.storage.sync.get(['pinnedSites'], function(result) {
    const pinnedSites = result.pinnedSites || [];
    
    // If we have pinned sites, display them
    if (pinnedSites.length > 0) {
      // Show all pinned sites (up to 10)
      const sitesToShow = [...pinnedSites].reverse();
      
      sitesToShow.forEach((site) => {
        const tab = document.createElement('div');
        tab.className = 'supercast-tab';
        
        // Use the favicon if available
        const favicon = site.favicon || `https://www.google.com/s2/favicons?domain=${new URL(site.url).hostname}&sz=32`;
        const img = document.createElement('img');
        img.src = favicon;
        img.alt = site.title || 'Pinned site';
        img.onerror = () => img.style.display = 'none';
        tab.appendChild(img);
        
        tab.title = site.title || 'Pinned site';
        
        // Make the tab clickable
        tab.addEventListener('click', () => {
          window.open(site.url, '_blank');
          hideOverlay(); // Hide overlay after clicking
        });
        
        pinnedTabsContainer.appendChild(tab);
      });
    } else {
      // Show placeholder pins
      for (let i = 0; i < 3; i++) {
        const tab = document.createElement('div');
        tab.className = 'supercast-tab';
        const img = document.createElement('img');
        img.src = 'https://www.google.com/s2/favicons?domain=google.com&sz=32';
        img.alt = 'Example Tab';
        img.onerror = () => img.style.display = 'none';
        tab.appendChild(img);
        
        pinnedTabsContainer.appendChild(tab);
      }
    }
  });
}

function handlePinnedTabClick(index) {
  chrome.storage.sync.get(['pinnedSites'], function(result) {
    const pinnedSites = result.pinnedSites || [];
    if (pinnedSites[index]) {
      window.open(pinnedSites[index].url, '_blank');
    }
  });
}

function handleReadingItemClick(index) {
  chrome.storage.sync.get(['readingList'], function(result) {
    const readingList = result.readingList || [];
    if (readingList[index]) {
      window.open(readingList[index].url, '_blank');
    }
  });
}

function handleViewAllReadingList() {
  // Create a new tab with a list of all reading list items
  chrome.storage.sync.get(['readingList'], function(result) {
    const readingList = result.readingList || [];
    
    if (readingList.length === 0) {
      showMessage('Your reading list is empty');
      return;
    }
    
    // Create a simple HTML page with the reading list
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Supercast Reading List</title>
        <style>
          body { font-family: 'Inter', sans-serif; margin: 0; padding: 20px; background: #f9f9f9; }
          h1 { color: #333; }
          .reading-list { display: flex; flex-direction: column; gap: 10px; }
          .reading-item { display: flex; align-items: center; padding: 12px; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); cursor: pointer; }
          .reading-item:hover { background: #f5f5f5; }
          .favicon { margin-right: 10px; width: 16px; height: 16px; }
          .title { flex: 1; font-size: 14px; color: #333; }
          .date { font-size: 12px; color: #999; }
        </style>
      </head>
      <body>
        <h1>Reading List</h1>
        <div class="reading-list">
    `;
    
    // Sort by newest first
    const sortedList = [...readingList].sort((a, b) => 
      new Date(b.addedAt) - new Date(a.addedAt)
    );
    
    sortedList.forEach(item => {
      const date = new Date(item.addedAt).toLocaleDateString();
      html += `
        <div class="reading-item" onclick="window.open('${item.url}', '_blank')">
          <img class="favicon" src="${item.favicon || `https://www.google.com/s2/favicons?domain=${new URL(item.url).hostname}`}" alt="" onerror="this.style.display='none'">
          <div class="title">${item.title || 'Unnamed Page'}</div>
          <div class="date">Added: ${date}</div>
        </div>
      `;
    });
    
    html += `
        </div>
      </body>
      </html>
    `;
    
    // Create a blob and open in new tab
    const blob = new Blob([html], {type: 'text/html'});
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    
    // Hide the overlay
    hideOverlay();
  });
}

function handleAddToReadingList() {
  const currentUrl = window.location.href;
  const currentTitle = document.title || 'Unnamed Page';
  
  chrome.storage.sync.get(['readingList'], function(result) {
    let readingList = result.readingList || [];
    
    // Check if already in reading list
    const existingItemIndex = readingList.findIndex(item => item.url === currentUrl);
    
    if (existingItemIndex >= 0) {
      // If already in list, remove it (toggle functionality)
      readingList.splice(existingItemIndex, 1);
      showMessage(`Removed from reading list: ${currentTitle}`);
    } else {
      // Add to reading list
      readingList.push({
        url: currentUrl,
        title: currentTitle,
        siteName: window.location.hostname.replace('www.', ''),
        favicon: `https://www.google.com/s2/favicons?domain=${window.location.hostname}&sz=32`,
        addedAt: new Date().toISOString()
      });
      showMessage(`Added to reading list: ${currentTitle}`);
    }
    
    // Limit to most recent 20 items
    if (readingList.length > 20) {
      readingList = readingList.slice(-20);
    }
    
    // Store back to storage
    chrome.storage.sync.set({ readingList }, function() {
      // Update the UI if expanded
      if (state.isMaximized) {
        updateReadingList();
      }
    });
  });
}

function updateReadingList() {
  const readingListItems = document.querySelector('.supercast-reading-list-items');
  if (!readingListItems) return;
  
  // Clear existing items
  readingListItems.innerHTML = '';
  
  chrome.storage.sync.get(['readingList'], function(result) {
    const readingList = result.readingList || [];
    
    // If we have reading items, display them
    if (readingList.length > 0) {
      // Show the most recent 3 items
      const itemsToShow = readingList.slice(-3).reverse();
      
      itemsToShow.forEach((item) => {
        const readingItem = document.createElement('div');
        readingItem.className = 'supercast-reading-item';
        
        // Create favicon + title layout
        const itemContent = document.createElement('div');
        itemContent.className = 'supercast-reading-item-content';
        
        // Add favicon if available
        if (item.favicon) {
          const favicon = document.createElement('img');
          favicon.src = item.favicon;
          favicon.className = 'supercast-reading-item-favicon';
          favicon.onerror = () => favicon.style.display = 'none';
          favicon.alt = '';
          itemContent.appendChild(favicon);
        }
        
        // Add title text
        const titleText = document.createElement('span');
        titleText.textContent = item.title || 'Unnamed Page';
        itemContent.appendChild(titleText);
        
        readingItem.appendChild(itemContent);
        
        // Make the item clickable
        readingItem.addEventListener('click', () => {
          window.open(item.url, '_blank');
          hideOverlay(); // Hide overlay after clicking
        });
        
        readingListItems.appendChild(readingItem);
      });
    } else {
      // Show example items
      const exampleItems = ['Example website', 'Example website', 'Example website'];
      exampleItems.forEach((item) => {
        const readingItem = document.createElement('div');
        readingItem.className = 'supercast-reading-item';
        const favicon = document.createElement('img');
        favicon.src = 'https://www.google.com/s2/favicons?domain=google.com&sz=16';
        favicon.className = 'supercast-reading-item-favicon';
        favicon.onerror = () => favicon.style.display = 'none';
        readingItem.appendChild(favicon);
        const text = document.createElement('span');
        text.textContent = 'Example website';
        readingItem.appendChild(text);
        readingListItems.appendChild(readingItem);
      });
    }
  });
}

function toggleMaximize() {
  const expandedContent = document.getElementById('supercast-expanded-content');
  const container = document.querySelector('.supercast-container');
  const maxButton = document.querySelector('.supercast-max-button');
  
  if (!expandedContent || !container) return;
  
  // Prevent multiple triggering by checking if animation is already in progress
  if (container.classList.contains('supercast-maximizing') || 
      container.classList.contains('supercast-minimizing')) {
    return;
  }
  
  if (state.isMaximized) {
    // Minimize with animation
    container.classList.add('supercast-minimizing');
    
    // After animation completes, update state and icon
    setTimeout(() => {
      expandedContent.classList.add('supercast-hidden');
      expandedContent.classList.remove('supercast-expanded');
      container.classList.remove('supercast-minimizing');
      maxButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 16H5V5h14v14zM7 10h10v2H7z"></path></svg>`;
      maxButton.title = 'Maximize';
      state.isMaximized = false;
      
      // Clear any summary content when minimizing
      clearSummaryContent();
    }, 250); // Match this duration with the CSS transition
  } else {
    // Maximize with animation
    expandedContent.classList.remove('supercast-hidden');
    expandedContent.classList.add('supercast-expanded');
    container.classList.add('supercast-maximizing');
    
    // After animation completes, update state and icon
    setTimeout(() => {
      container.classList.remove('supercast-maximizing');
      maxButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 16H5V5h14v14zM7 10h10v2H7v-2z"></path></svg>`;
      maxButton.title = 'Minimize';
      state.isMaximized = true;
      
      // Restore default view when maximizing
      restoreDefaultView();
    }, 250); // Match this duration with the CSS transition
  }
}

function handleQuickAction(action) {
  switch(action.toLowerCase()) {
    case 'summarize':
      summarizePage();
      break;
    case 'search':
      const input = document.getElementById('supercast-input');
      input.focus();
      input.placeholder = 'Search...';
      break;
    case 'ask':
      const askInput = document.getElementById('supercast-input');
      askInput.focus();
      askInput.placeholder = 'Ask a question about this page...';
      state.currentMode = 'ask';
      break;
    default:
      // Quick actions button itself, do nothing
      break;
  }
}

function processCommand(command) {
  // Simple command processing
  const lcCommand = command.toLowerCase();
  
  if (lcCommand.includes('summarize')) {
    summarizePage();
  } else if (lcCommand.startsWith('ask') || lcCommand.includes('question')) {
    // Switch to ask mode
    const input = document.getElementById('supercast-input');
    input.placeholder = 'Ask a question about this page...';
    state.currentMode = 'ask';
    input.focus();
  } else if (lcCommand.includes('read') && lcCommand.includes('list')) {
    // Add to reading list
    handleAddToReadingList();
  } else if (lcCommand.includes('pin')) {
    // Pin current site
    handlePinSite();
  } else if (lcCommand.includes('view') && lcCommand.includes('read')) {
    // View reading list
    handleViewAllReadingList();
  } else {
    // Default to web search
    window.open(`https://www.google.com/search?q=${encodeURIComponent(command)}`, '_blank');
    hideOverlay();
  }
}

// Show a temporary message to the user
function showMessage(message, duration = 2000) {
  let messageEl = document.getElementById('supercast-message');
  
  if (!messageEl) {
    messageEl = document.createElement('div');
    messageEl.id = 'supercast-message';
    messageEl.style.position = 'fixed';
    messageEl.style.bottom = '20px';
    messageEl.style.left = '50%';
    messageEl.style.transform = 'translateX(-50%)';
    messageEl.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    messageEl.style.color = 'white';
    messageEl.style.padding = '8px 16px';
    messageEl.style.borderRadius = '4px';
    messageEl.style.zIndex = '10000000';
    messageEl.style.fontSize = '14px';
    messageEl.style.opacity = '0';
    messageEl.style.transition = 'opacity 0.2s ease-in-out';
    document.body.appendChild(messageEl);
  }
  
  messageEl.textContent = message;
  
  // Show the message
  setTimeout(() => {
    messageEl.style.opacity = '1';
  }, 10);
  
  // Hide after duration
  setTimeout(() => {
    messageEl.style.opacity = '0';
  }, duration);
}

// Toggle overlay visibility
function toggleOverlay() {
  // Check if overlay already exists before creating a new one
  let overlay = document.getElementById('supercast-overlay');
  
  if (overlay) {
    // If overlay exists, toggle its visibility
    if (state.isOverlayVisible) {
      hideOverlay();
    } else {
      showOverlay();
    }
  } else {
    // If overlay doesn't exist, create it
    createOverlay();
    showOverlay();
  }
}

// Show the overlay
function showOverlay() {
  const overlay = document.getElementById('supercast-overlay');
  if (overlay) {
    overlay.classList.remove('supercast-hidden');
    document.getElementById('supercast-input').focus();
    state.isOverlayVisible = true;
  }
}

// Hide the overlay
function hideOverlay() {
  const overlay = document.getElementById('supercast-overlay');
  if (overlay) {
    overlay.classList.add('supercast-hidden');
    state.isOverlayVisible = false;
    
    // Reset to command mode when hiding
    const input = document.getElementById('supercast-input');
    if (input) {
      input.value = '';
      input.placeholder = 'Enter your command...';
      state.currentMode = 'command';
    }
  }
}

// Initialize when DOM is ready
let overlay = null;
let initialized = false;

function init() {
  if (initialized) return;
  initialized = true;
  
  // Initialize state
  state = {
    isOverlayVisible: false,
    isMaximized: false,
    pinnedSites: [],
    readingList: [],
    currentMode: 'command',
    currentWebsite: window.location.hostname,
    activeCommand: null,
    searchWebsite: null,
    lastContent: null,
    pendingRequest: false,
    theme: 'light'
  };
  
  // Initialize the API with configuration
  initializeAPI();
  
  // Load stored data from chrome storage
  loadStoredData();
  
  // Initialize storage if needed
  initializeStorage();
  
  // Check if overlay already exists before creating a new one
  if (!document.getElementById('supercast-overlay')) {
    createOverlay();
  }
  
  // Set up keyboard shortcut listeners for the overlay
  document.addEventListener('keydown', (e) => {
    // Check for Alt+Shift+S
    if (e.altKey && e.shiftKey && e.code === 'KeyS') {
      e.preventDefault();
      toggleOverlay();
    }
  });
  
  // Listen for keyboard shortcut messages from background script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'toggle-overlay') {
      toggleOverlay();
    }
  });
  
  console.log('Supercast overlay initialized');
}

/**
 * Initialize the Cohere API with config
 */
function initializeAPI() {
  // First try to get the API key from config
  if (typeof extensionConfig !== 'undefined') {
    extensionConfig.init().then(configured => {
      if (configured) {
        // Check if we have the Cohere API key
        if (extensionConfig.cohereApiKey) {
          console.log('Configuring Cohere API from .env file');
          cohereAPI.configure(extensionConfig.cohereApiKey);
        } else if (extensionConfig.apiKey) {
          // For backward compatibility
          console.log('No Cohere API key found in config');
        }
      } else {
        // If not in config, try from storage
        chrome.storage.sync.get(['cohereApiKey'], function(result) {
          if (result.cohereApiKey) {
            console.log('Configuring Cohere API from storage');
            cohereAPI.configure(result.cohereApiKey);
          } else {
            console.warn('No Cohere API key found');
          }
        });
      }
    });
  } else {
    // Try from storage as fallback
    chrome.storage.sync.get(['cohereApiKey'], function(result) {
      if (result.cohereApiKey) {
        console.log('Configuring Cohere API from storage');
        cohereAPI.configure(result.cohereApiKey);
      } else {
        console.warn('No Cohere API key found');
      }
    });
  }
}

// Try to initialize as soon as possible
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.command === 'toggle-overlay') {
    // Ensure initialization
    if (!initialized) {
      init();
    }
    if (initialized) {
      toggleOverlay();
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'DOM not ready' });
    }
  } else if (request.command === 'ping') {
    // Just respond to the ping to let background script know content script is loaded
    sendResponse({ success: true });
  }
  return true; // Keep the message channel open for async response
});

// Cleanup previous event listener
document.removeEventListener('DOMContentLoaded', init);

/**
 * Summarize the current page using Mozilla's Readability and Cohere API
 */
function summarizePage() {
  try {
    // Update state
    state.currentMode = 'summarize';
    
    // Hide reading list and pinned tabs
    hideReadingList();
    const pinnedTabs = document.querySelector('.supercast-pinned-tabs');
    if (pinnedTabs) pinnedTabs.style.display = 'none';
    
    // Create or get the summary container
    let summaryContainer = document.querySelector('.supercast-summary-container');
    if (!summaryContainer) {
      summaryContainer = document.createElement('div');
      summaryContainer.className = 'supercast-summary-container';
      const expandedContent = document.querySelector('.supercast-expanded-content');
      if (expandedContent) {
        expandedContent.appendChild(summaryContainer);
      }
    }
    
    // Important: Make sure the container is visible after a previous minimize
    summaryContainer.style.display = '';
    
    // Clear previous summary
    summaryContainer.innerHTML = '';
    
    // Show loading indicator
    showSummaryLoading(true);
    
    // Make sure overlay is visible and maximized
    if (!state.isOverlayVisible) {
      showOverlay();
    }
    if (!state.isMaximized) {
      toggleMaximize();
    }
    
    // Check if Readability is available
    if (typeof window.Readability === 'undefined') {
      console.warn('Readability library not loaded. Loading it now...');
      
      // Try to load Readability dynamically
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('Readability.js');
      script.onload = function() {
        console.log('Readability loaded dynamically');
        continueWithReadability();
      };
      script.onerror = function() {
        console.error('Failed to load Readability dynamically');
        showSummaryError("Couldn't load the Readability library. Please refresh the page and try again.");
      };
      document.head.appendChild(script);
    } else {
      continueWithReadability();
    }
    
  } catch (error) {
    console.error('Summarization error:', error);
    showSummaryError("An error occurred while summarizing the page.");
  }
}

/**
 * Continue with summarization after ensuring Readability is available
 */
function continueWithReadability() {
  try {
    // Extract content using Readability
    // const documentClone = document.cloneNode(true);
    // const article = new window.Readability(documentClone).parse();
    
    // TEMPORARILY BYPASSING READABILITY
    console.log("Readability functionality temporarily bypassed for testing");
    
    // If Readability couldn't parse the article, try to get content directly from the page
    let textContent = "";
    let article = null;
    
    /* Commented out Readability parsing
    if (article && article.content) {
      // Get text content from the article
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = article.content;
      textContent = tempDiv.textContent.trim();
      
      console.log("Extracted text length via Readability:", textContent.length);
    } 
    */
    
    // Try getting content directly
    console.log("Using direct content extraction");
    
    // Try to extract content from main content elements
    const mainSelectors = [
      'main', 'article', '.article', '.content', '.post', 
      '#content', '#main', '[role="main"]'
    ];
    
    for (const selector of mainSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        for (const element of elements) {
          // Skip elements that are too small
          if (element.textContent.length > textContent.length) {
            textContent = element.textContent.trim();
          }
        }
      }
    }
    
    // If still not enough, get the body text as a last resort
    if (textContent.length < 50 && document.body) {
      textContent = document.body.textContent.trim();
      console.log("Using body text as fallback, length:", textContent.length);
    }
    
    // Reduce the text length requirement to 50 characters
    if (textContent.length < 50) {
      showSummaryError("Not enough content to summarize. This page may not have sufficient text content or might be using a structure that's difficult to extract content from.");
      console.log("Final extracted text too short:", textContent.length);
      return;
    }
    
    // Store article in state for future use
    state.lastContent = {
      title: document.title,
      content: textContent,
      url: window.location.href
    };
    
    // Try to get API key directly from extensionConfig if available
    if (typeof extensionConfig !== 'undefined' && extensionConfig.cohereApiKey) {
      console.log('Using Cohere API key from extensionConfig');
      cohereAPI.configure(extensionConfig.cohereApiKey);
      generateSummary(textContent);
    }
    // Otherwise check if API is already configured
    else if (cohereAPI.checkConfiguration()) {
      generateSummary(textContent);
    }
    // Finally try to get from storage
    else {
      console.log('Trying to get Cohere API key from storage');
      chrome.storage.sync.get(['cohereApiKey'], function(result) {
        if (result.cohereApiKey) {
          cohereAPI.configure(result.cohereApiKey);
          generateSummary(textContent);
        } else {
          // As a last resort, try to read directly from .env file
          fetch(chrome.runtime.getURL('.env'))
            .then(response => response.text())
            .then(text => {
              const lines = text.split('\n');
              for (const line of lines) {
                if (line.startsWith('COHERE_API_KEY=')) {
                  const apiKey = line.split('=')[1].trim();
                  console.log('Got Cohere API key directly from .env file');
                  cohereAPI.configure(apiKey);
                  generateSummary(textContent);
                  return;
                }
              }
              showSummaryError("API key not configured. Please set your Cohere API key in settings.");
            })
            .catch(error => {
              console.error('Failed to load .env file:', error);
              showSummaryError("API key not configured. Please set your Cohere API key in settings.");
            });
        }
      });
    }
  } catch (error) {
    console.error('Content extraction error:', error);
    showSummaryError("An error occurred while extracting content from the page. Please try again or check the console for details.");
  }
}

/**
 * Generate summary using Cohere API
 * @param {string} textContent - Text content to summarize
 */
async function generateSummary(textContent) {
  try {
    showSummaryLoading(true);
    
    console.log(`Sending ${textContent.length} characters to Cohere API for summarization`);
    
    // Generate summary using Cohere API
    const summaryResult = await cohereAPI.summarize(textContent);
    
    // Show the summary in the overlay
    showSummary(summaryResult);
    
  } catch (error) {
    console.error('Summary generation error:', error);
    
    // Handle different error types
    if (error.message?.includes('500') || error.status === 500) {
      showSummaryError("The Cohere API server encountered an error (HTTP 500). This could be due to server load, API rate limits, or issues with the model. Please try again in a few moments.");
    } else if (error.message?.includes('429') || error.status === 429) {
      showSummaryError("You have exceeded the rate limit for the Cohere API. Please wait a few moments before trying again.");
    } else if (error.message?.includes('401') || error.status === 401) {
      showSummaryError("Authentication failed. Please check that your Cohere API key is valid.");
    } else if (error.message?.includes('403') || error.status === 403) {
      showSummaryError("Access forbidden. Your API key may not have access to the requested model.");
    } else if (error.message?.includes('Network') || error.message?.includes('connection')) {
      showSummaryError("Network error. Please check your internet connection and try again.");
    } else {
      showSummaryError(`An error occurred while generating the summary: ${error.message || 'Unknown error'}`);
    }
  }
}

/**
 * Show summary in the overlay
 * @param {Object} summaryResult - Summary result from Cohere API
 */
function showSummary(summaryResult) {
  // Get the summary container
  const summaryContainer = document.querySelector('.supercast-summary-container');
  if (!summaryContainer) return;
  
  // Make sure the container is visible
  summaryContainer.style.display = '';
  
  // Hide loading
  showSummaryLoading(false);
  
  // Create summary content
  const summaryContent = document.createElement('div');
  summaryContent.id = 'summary-content';
  summaryContent.className = 'summary-content';
  
  // Add title
  const title = document.createElement('h2');
  title.className = 'summary-title';
  title.textContent = 'Summary';
  summaryContent.appendChild(title);
  
  // Add summary text
  const summaryText = document.createElement('div');
  summaryText.className = 'summary-text';
  summaryText.textContent = summaryResult.result;
  summaryContent.appendChild(summaryText);
  
  // Add to container
  summaryContainer.innerHTML = '';
  summaryContainer.appendChild(summaryContent);
  
  // Hide reading list when summary is shown
  hideReadingList();
}

/**
 * Show error message for summary
 * @param {string} message - Error message
 */
function showSummaryError(message) {
  const summaryContainer = document.querySelector('.supercast-summary-container');
  if (!summaryContainer) return;
  
  // Hide loading
  showSummaryLoading(false);
  
  // Create error content
  const errorContent = document.createElement('div');
  errorContent.className = 'summary-error';
  
  // Add error icon
  const errorIcon = document.createElement('div');
  errorIcon.className = 'summary-error-icon';
  errorIcon.innerHTML = '⚠️';
  errorContent.appendChild(errorIcon);
  
  // Add error message
  const errorMessage = document.createElement('div');
  errorMessage.className = 'summary-error-message';
  errorMessage.textContent = message;
  errorContent.appendChild(errorMessage);
  
  // Add to container
  summaryContainer.innerHTML = '';
  summaryContainer.appendChild(errorContent);
}

/**
 * Show loading indicator for summary
 * @param {boolean} isLoading - Whether to show or hide the loading indicator
 */
function showSummaryLoading(isLoading) {
  const summaryContainer = document.querySelector('.supercast-summary-container');
  if (!summaryContainer) return;
  
  // Always ensure the container is visible when showing loading
  if (isLoading) {
    // Make sure container is visible
    summaryContainer.style.display = '';
    
    // Hide reading list when showing loading indicator
    hideReadingList();
    
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'supercast-loading-indicator';
    loadingIndicator.innerHTML = `
      <div class="supercast-spinner"></div>
      <p>Generating summary...</p>
    `;
    summaryContainer.innerHTML = '';
    summaryContainer.appendChild(loadingIndicator);
  } else {
    summaryContainer.innerHTML = '';
  }
}

/**
 * Helper function to hide reading list elements
 * This ensures consistency across all functions that need to hide the reading list
 */
function hideReadingList() {
  // Target all possible reading list selectors
  const selectors = [
    '.reading-list-container', 
    '#reading-list',
    '.reading-list',
    '.supercast-reading-list',
    '.supercast-reading-list-container',
    '[data-section="reading-list"]'
  ];
  
  // Try each selector
  selectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    if (elements && elements.length > 0) {
      elements.forEach(el => {
        el.style.display = 'none';
      });
      console.log(`Hidden reading list elements with selector: ${selector}`);
    }
  });
  
  // Also hide any element with Reading List as text content
  const allHeadings = document.querySelectorAll('h1, h2, h3, h4, h5, h6, div');
  allHeadings.forEach(el => {
    if (el.textContent && el.textContent.trim() === 'Reading List') {
      // Find the closest container
      let container = el.parentElement;
      if (container) {
        container.style.display = 'none';
        console.log('Hidden reading list container by heading text match');
      }
    }
  });
}

/**
 * Restore the default view with pinned tabs and reading list
 */
function restoreDefaultView() {
  // Only restore default if we're not in summarize mode
  if (state.currentMode !== 'summarize') {
    // Update pinned tabs and reading list with the latest data
    updatePinnedTabs();
    updateReadingList();
    
    // Show reading list
    const readingListSelectors = [
      '.reading-list-container', 
      '#reading-list',
      '.reading-list',
      '.supercast-reading-list',
      '.supercast-reading-list-container'
    ];
    
    readingListSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        if (el) el.style.display = '';
      });
    });
    
    // Show pinned tabs
    const pinnedTabs = document.querySelector('.supercast-pinned-tabs');
    if (pinnedTabs) pinnedTabs.style.display = '';
    
    // Also make sure the reading list heading is visible
    const allHeadings = document.querySelectorAll('h1, h2, h3, h4, h5, h6, div');
    allHeadings.forEach(el => {
      if (el.textContent && el.textContent.trim() === 'Reading List') {
        // Make the container visible
        let container = el.parentElement;
        if (container) {
          container.style.display = '';
        }
      }
    });
    
    console.log('Default view restored with reading list and pinned tabs');
  }
}

/**
 * Clear any summary content
 */
function clearSummaryContent() {
  // Clear the summary mode from state
  if (state.currentMode === 'summarize') {
    state.currentMode = '';
  }
  
  // Clear any summary containers
  const summaryContainer = document.querySelector('.supercast-summary-container');
  if (summaryContainer) {
    // Clear content but don't set display to none - this would prevent it from 
    // being visible when summarizePage is called again
    summaryContainer.innerHTML = '';
    
    // Instead of hiding it with style.display = 'none', we'll detach it from the DOM
    // This ensures a clean slate for the next time it's needed
    if (summaryContainer.parentNode) {
      summaryContainer.parentNode.removeChild(summaryContainer);
    }
  }
}

/**
 * Clear any summary content
 */
function clearSummaryContent() {
  // Clear the summary mode from state
  if (state.currentMode === 'summarize') {
    state.currentMode = '';
  }
  
  // Clear any summary containers
  const summaryContainer = document.querySelector('.supercast-summary-container');
  if (summaryContainer) {
    // Clear content but don't set display to none - this would prevent it from 
    // being visible when summarizePage is called again
    summaryContainer.innerHTML = '';
    
    // Instead of hiding it with style.display = 'none', we'll detach it from the DOM
    // This ensures a clean slate for the next time it's needed
    if (summaryContainer.parentNode) {
      summaryContainer.parentNode.removeChild(summaryContainer);
    }
  }
}
