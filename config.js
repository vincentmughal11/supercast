/**
 * Configuration loader for BrieflyAI extension
 * Loads API keys and other configuration from .env file
 */

// Configuration object for the extension
const config = {
  // Default values
  apiKey: null,
  cohereApiKey: null,
  configured: false,
  
  // Initialize configuration
  async init() {
    try {
      // Try to load the .env file
      const response = await fetch(chrome.runtime.getURL('.env'));
      const text = await response.text();
      
      // Parse the .env file
      const lines = text.split('\n');
      for (const line of lines) {
        // Skip comments and empty lines
        if (line.startsWith('#') || line.trim() === '') continue;
        
        // Parse key-value pairs
        const [key, value] = line.split('=').map(part => part.trim());
        if (key === 'HUGGINGFACE_API_KEY') {
          this.apiKey = value;
        } else if (key === 'COHERE_API_KEY') {
          this.cohereApiKey = value;
          // Check if Cohere API key is configured properly
          this.configured = this.cohereApiKey && this.cohereApiKey !== 'your_cohere_api_key_here';
        }
      }
      
      // For backward compatibility, also consider configured if Huggingface API key is set
      if (!this.configured) {
        this.configured = this.apiKey && this.apiKey !== 'your_huggingface_api_key_here';
      }
      
      return this.configured;
    } catch (error) {
      console.error('Failed to load configuration:', error);
      return false;
    }
  }
};

// Export the config object
const extensionConfig = config;
