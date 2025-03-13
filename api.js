/**
 * API interface for machine learning models
 */
class CohereAPI {
  constructor() {
    this.apiKey = null;
    this.configured = false;
    this.baseUrl = 'https://api.cohere.ai/v1';
  }
  
  /**
   * Configure the API with an API key
   * @param {string} apiKey - API key to use
   */
  configure(apiKey) {
    this.apiKey = apiKey;
    this.configured = apiKey && apiKey !== 'your_cohere_api_key_here';
    console.log(`API ${this.configured ? 'configured' : 'not configured'}`);
    return this.configured;
  }
  
  /**
   * Check if the API is configured
   * @returns {boolean} - Whether the API is configured
   */
  checkConfiguration() {
    return this.configured && this.apiKey;
  }
  
  /**
   * Query the Cohere API
   * @param {string} endpoint - API endpoint
   * @param {Object} payload - Request payload
   * @returns {Promise} - API response
   */
  async query(endpoint, payload) {
    if (!this.apiKey) {
      throw new Error('API key not configured');
    }
    
    try {
      const url = `${this.baseUrl}/${endpoint}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        mode: 'cors'
      });
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText || 'HTTP ' + response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      throw new Error(`API request failed: ${error.message || 'unknown error'}`);
    }
  }

  /**
   * Summarize text using Cohere's Command R model
   * @param {string} text - Text to summarize
   * @returns {Promise} - Summary result
   */
  async summarize(text) {
    // Record start time for the summary process
    const startTime = Date.now();
    
    // Log the thinking process
    const thoughts = [
      "Processing text content for summarization...",
      "Identifying key information and main points...",
      "Creating a concise summary using Cohere's Command R model..."
    ];
    
    // Set maximum input length
    const maxInputLength = 100000;
    let processedText = text;
    if (text.length > maxInputLength) {
      processedText = text.substring(0, maxInputLength);
      thoughts.push(`Input text truncated from ${text.length} to ${maxInputLength} characters to fit model limits.`);
      console.log(`Input text truncated from ${text.length} to ${maxInputLength} characters`);
    }
    
    try {
      console.log('Using Cohere Command R for summarization');
      
      const payload = {
        message: "Create a concise summary of the following text.",
        chat_history: [],
        documents: [{ text: processedText }],
        model: "command-r",
        temperature: 0.3,
        max_tokens: 768,
        connectors: [],
        citationsConfig: { enable: false },
        returnDocuments: false
      };
      
      // Make API request to Cohere
      const response = await this.query('chat', payload);
      
      // Create additional thoughts based on the result
      thoughts.push(`Summary generated in ${((Date.now() - startTime) / 1000).toFixed(2)} seconds.`);
      
      return {
        result: response.text,
        thoughts: thoughts.join('\n')
      };
    } catch (error) {
      console.error('Summarization error:', error);
      thoughts.push(`Error encountered: ${error.message}`);
      throw error;
    }
  }

  /**
   * Ask a question about content using Cohere's model
   * @param {string} question - Question to ask
   * @param {string} context - Context for the question
   * @returns {Promise} - Answer result
   */
  async askQuestion(question, context) {
    const startTime = Date.now();
    
    // Log thinking process
    const thoughts = [
      "Processing question and context...",
      "Searching for relevant information in the context...",
      "Formulating a detailed and accurate answer..."
    ];
    
    try {
      console.log(`Asking question using Cohere Command R`);
      
      const payload = {
        message: question,
        chat_history: [],
        documents: [{ text: context }],
        model: "command-r",
        temperature: 0.2,
        max_tokens: 800,
        connectors: []
      };
      
      // Make API request to Cohere
      const response = await this.query('chat', payload);
      
      // Create additional thoughts
      thoughts.push(`Answer generated in ${((Date.now() - startTime) / 1000).toFixed(2)} seconds.`);
      
      return {
        result: response.text,
        thoughts: thoughts.join('\n'),
        citations: response.citations || [],
        documents: response.documents || []
      };
    } catch (error) {
      console.error('Question answering error:', error);
      thoughts.push(`Error encountered: ${error.message}`);
      throw error;
    }
  }
}

// Create an instance of the API class
const cohereAPI = new CohereAPI();
