// Background script for Supercast extension
let isOverlayVisible = false;

// Import the API and config modules
importScripts('config.js', 'api.js');

// Initialize configuration when the service worker starts
extensionConfig.init().then(configured => {
  if (configured) {
    huggingfaceAPI.configure(extensionConfig.apiKey);
    console.log('HuggingFace API configured successfully');
  } else {
    console.warn('HuggingFace API not configured. Please set your API key in the .env file');
  }
});

// Function to ensure content script is injected
async function ensureContentScriptInjected(tab) {
  try {
    // Try to see if we can communicate with the content script
    await chrome.tabs.sendMessage(tab.id, { command: 'ping' });
    // If we get here, the content script is already injected
    return;
  } catch (error) {
    // Content script is not available, inject it
    console.log('Injecting content script into tab', tab.id);
    
    try {
      // Inject CSS first
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['overlay.css']
      });
      
      // Inject scripts in order
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['config.js']
      });
      
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['api.js']
      });
      
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      
      // Wait a moment for scripts to initialize
      return new Promise(resolve => setTimeout(resolve, 100));
    } catch (injectError) {
      console.error('Error injecting content script:', injectError);
      throw injectError;
    }
  }
}

// Listen for keyboard shortcut command
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-overlay') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      try {
        // First make sure the content script is injected
        await ensureContentScriptInjected(tab);
        
        // Then send the toggle message
        const response = await chrome.tabs.sendMessage(tab.id, { command: 'toggle-overlay' });
        if (response && !response.success && response.error === 'DOM not ready') {
          // Wait a short time and try again
          setTimeout(async () => {
            try {
              await chrome.tabs.sendMessage(tab.id, { command: 'toggle-overlay' });
            } catch (retryError) {
              console.error('Failed to send toggle message on retry:', retryError);
            }
          }, 500);
        }
      } catch (error) {
        console.error('Failed to send toggle message:', error);
      }
    }
  }
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.command === 'get-overlay-state') {
    sendResponse({ isVisible: isOverlayVisible });
  }

  if (request.action === 'summarize') {
    if (!huggingfaceAPI.checkConfiguration()) {
      sendResponse({ 
        result: "API not configured. Please add your Huggingface API key to the .env file.",
        thoughts: "Failed to access Huggingface API due to missing API key."
      });
      return true;
    }
    
    // Get the page content and summarize it using the BART model
    huggingfaceAPI.summarize(request.pageContent)
      .then(summary => {
        sendResponse(summary);
      })
      .catch(error => {
        sendResponse({ 
          result: "An error occurred during summarization.",
          thoughts: `Error: ${error.message}`
        });
      });
    
    return true; // Keep the message channel open for async response
  }
  
  if (request.action === 'askPage') {
    if (!huggingfaceAPI.checkConfiguration()) {
      sendResponse({ 
        result: "API not configured. Please add your Huggingface API key to the .env file.",
        thoughts: "Failed to access Huggingface API due to missing API key."
      });
      return true;
    }
    
    // Get the page content and question, then answer using the DeepSeek model
    huggingfaceAPI.askQuestion(request.pageContent, request.question)
      .then(answer => {
        sendResponse(answer);
      })
      .catch(error => {
        sendResponse({ 
          result: "An error occurred while answering your question.",
          thoughts: `Error: ${error.message}`
        });
      });
    
    return true; // Keep the message channel open for async response
  }
});

// Track overlay state changes
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.command === 'overlay-state-changed') {
    isOverlayVisible = request.isVisible;
  }
});
