# Supercast

An AI-powered Chrome extension that enhances your web browsing experience with intelligent features like summarization, Q&A, and more.

## Features

- **Smart Overlay**: Press `Ctrl + Alt + Space` to open a sleek overlay interface
- **AI-Powered Features**:
  - Summarize any webpage using Facebook BART
  - Ask questions about the content using DeepSeek-R1
  - Search within specific websites
  - Change webpage themes on the fly
- **Organization Tools**:
  - Pin frequently visited sites
  - Maintain a reading list
- **Modern Design**:
  - Glass morphism UI
  - Inter font
  - Responsive layout

## Installation

1. Clone this repository
2. Get your Huggingface API key from [huggingface.co](https://huggingface.co)
3. Create a `.env` file in the root directory and add your API key:
   ```
   HUGGINGFACE_API_KEY=your_api_key_here
   ```
4. Open Chrome and go to `chrome://extensions/`
5. Enable "Developer mode" in the top-right corner
6. Click "Load unpacked" and select the extension directory

## Usage

1. Press `Ctrl + Alt + Space` to open the Supercast overlay
2. Type a command or click a button:
   - `summarize` - Get a concise summary of the current page
   - `ask [question]` - Ask a question about the page content
   - `search [query]` - Search within specific sites
   - `change theme [light/dark]` - Change the page theme

## Development

The extension uses the following technologies:
- JavaScript (ES6+)
- Chrome Extension APIs
- Huggingface API
  - Facebook BART for summarization
  - DeepSeek-R1 for question answering

## License

MIT License
