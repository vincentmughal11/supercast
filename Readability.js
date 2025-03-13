/*
 * Copyright (c) 2010 Arc90 Inc
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*
 * This code is heavily based on Arc90's readability.js (1.7.1) script
 * available at: http://code.google.com/p/arc90labs-readability
 */

/**
 * Public constructor.
 * @param {HTMLDocument} doc     The document to parse.
 * @param {Object}       options The options object.
 */
function Readability(doc, options) {
  // In some older versions content is not initialized properly.
  this._doc = doc;
  this._docJSDOMParser = this._doc.firstChild && this._doc.firstChild.getAttribute && this._doc.firstChild.getAttribute("data-jsdom");
  this._articleTitle = null;
  this._articleByline = null;
  this._articleDir = null;
  this._includeUnlikelyCandidates = true;

  options = options || {};

  this._debug = !!options.debug;
  this._maxElemsToParse = options.maxElemsToParse || 0;
  this._nbTopCandidates = options.nbTopCandidates || 5;
  this._maxPages = options.maxPages || 5;
  this._contentClasses = options.contentClasses || [];
  this._classesToPreserve = this._contentClasses.concat(options.classesToPreserve || []);
  this._keepClasses = !!options.keepClasses;
  this._serializer = options.serializer || function(el) {
    return el.innerHTML;
  };
  this._disableJSONLD = !!options.disableJSONLD;
  this._allowedVideoRegex = options.allowedVideoRegex || /\/\/(www\.)?((dailymotion|youtube|youtube-nocookie|player\.vimeo|v\.qq)\.com|(archive|upload\.wikimedia)\.org|player\.twitch\.tv)/;

  this._wordThreshold = 500;
  this._charThreshold = 2000;

  this._flags = this._getFlags();
  this._cleanRules = this._getCleanRules();
}

Readability.prototype = {
  /**
   * Run any post-process modifications to article content as necessary.
   *
   * @param Element
   * @return void
   **/
  _postProcessContent: function(articleContent) {
    // Readability cannot open relative uris so we convert them to absolute uris.
    this._fixRelativeUris(articleContent);

    this._simplifyNestedElements(articleContent);
  },

  /**
   * Iterates over a NodeList, calls `filterFn` for each node and removes node
   * if function returned `true`.
   *
   * If function is not passed, removes all the nodes in node list.
   *
   * @param NodeList nodeList The nodes to operate on
   * @param Function filterFn the function to use as a filter
   * @return void
   */
  _removeNodes: function(nodeList, filterFn) {
    // Avoid ever operating on live node lists.
    if (this._docJSDOMParser && nodeList._isLiveNodeList) {
      throw new Error("Do not pass live node lists to _removeNodes");
    }
    for (var i = nodeList.length - 1; i >= 0; i--) {
      var node = nodeList[i];
      var parentNode = node.parentNode;
      if (parentNode) {
        if (!filterFn || filterFn.call(this, node, i, nodeList)) {
          parentNode.removeChild(node);
        }
      }
    }
  },

  /**
   * Check if this node has only whitespace and a single element with given tag
   * Returns false if the DIV node contains non-empty text nodes
   * or if it contains no element with given tag or more than 1 element.
   *
   * @param Element
   * @param string tag of child element
   * @return boolean
   */
  _hasSingleTagInsideElement: function(element, tag) {
    // There should be exactly 1 element child with given tag
    if (element.children.length != 1 || element.children[0].tagName !== tag) {
      return false;
    }

    // And there should be no text nodes with real content
    return !this._someNode(element.childNodes, function(node) {
      return node.nodeType === this.TEXT_NODE &&
             this.REGEXPS.hasContent.test(node.textContent);
    });
  },

  /**
   * Runs readability.
   *
   * @return object
   */
  parse: function() {
    // Make sure the document body exists
    if (!this._doc.body) {
      throw new Error("No body found in document. Not able to parse body.");
    }

    // Remove all scripts
    this._removeScripts(this._doc);

    // Remove comments
    this._removeComments(this._doc);

    // Get the title
    this._getArticleTitle();

    // Get the byline
    this._getArticleByline();

    // Get the article content
    var articleContent = this._grabArticle();
    if (!articleContent) {
      return null;
    }

    // Post-process content
    this._postProcessContent(articleContent);

    // Get the excerpt
    var excerpt = this._getArticleExcerpt(articleContent);

    // Get the site name
    var siteName = this._getSiteName();

    // Get the article direction
    var articleDir = this._getArticleDir();

    return {
      title: this._articleTitle,
      byline: this._articleByline,
      dir: articleDir,
      content: articleContent,
      excerpt: excerpt,
      siteName: siteName
    };
  },

  /**
   * Get the article title as an H1.
   *
   * @return string
   **/
  _getArticleTitle: function() {
    // Get the title from the document
    this._articleTitle = this._doc.title.trim();
    return this._articleTitle;
  },

  /**
   * Get the article byline metadata.
   *
   * @return string
   **/
  _getArticleByline: function() {
    this._articleByline = null;
    return this._articleByline;
  },

  /**
   * Get the article direction.
   *
   * @return string
   **/
  _getArticleDir: function() {
    this._articleDir = null;
    return this._articleDir;
  },

  /**
   * Parses the article body. Uses the readability algorithm to extract the main content.
   * 
   * @return Element
   */
  _grabArticle: function() {
    var doc = this._doc;
    var isPaging = (this._page && this._page > 1);

    // We can't grab an article if we don't have a page!
    if (!doc.body) {
      return null;
    }

    // First, get the article content
    var articleContent = doc.createElement("DIV");
    
    // Get all possible paragraphs
    var allParagraphs = doc.getElementsByTagName("p");
    var grabParagraphs = [];

    // Append all paragraphs to the article content
    for (var i = 0; i < allParagraphs.length; i++) {
      var paragraph = allParagraphs[i];
      var parentNode = paragraph.parentNode;
      var grandParentNode = parentNode ? parentNode.parentNode : null;
      
      if (paragraph.textContent.trim().length > 100) {
        grabParagraphs.push(paragraph);
      }
    }

    // If we found paragraphs, create a div with them
    if (grabParagraphs.length > 0) {
      for (var i = 0; i < grabParagraphs.length; i++) {
        articleContent.appendChild(grabParagraphs[i].cloneNode(true));
      }
    } else {
      // If no paragraphs found, just grab the body
      articleContent.innerHTML = doc.body.innerHTML;
    }

    return articleContent;
  },

  /**
   * Attempts to get excerpt text from the article.
   *
   * @param Element articleContent
   * @return string
   **/
  _getArticleExcerpt: function(articleContent) {
    if (!articleContent) {
      return null;
    }

    // Get all paragraphs
    var paragraphs = articleContent.getElementsByTagName("p");
    if (paragraphs.length > 0) {
      return paragraphs[0].textContent.trim();
    }

    return null;
  },

  /**
   * Get the site name
   *
   * @return string
   */
  _getSiteName: function() {
    return window.location.hostname.replace('www.', '');
  },

  /**
   * Removes script tags from the document.
   *
   * @param Element doc
   * @return void
   */
  _removeScripts: function(doc) {
    this._removeNodes(doc.getElementsByTagName('script'));
  },

  /**
   * Removes comments from the document.
   *
   * @param Element doc
   * @return void
   */
  _removeComments: function(doc) {
    var comments = [];
    var walker = doc.createTreeWalker(doc, NodeFilter.SHOW_COMMENT, null, false);
    var node;
    while ((node = walker.nextNode())) {
      comments.push(node);
    }
    this._removeNodes(comments);
  },

  /**
   * Fix links in the article content to be absolute links.
   *
   * @param Element articleContent
   * @return void
   */
  _fixRelativeUris: function(articleContent) {
    var links = articleContent.getElementsByTagName("a");
    this._forEachNode(links, function(link) {
      var href = link.getAttribute("href");
      if (href && href.indexOf("://") < 0) {
        link.setAttribute("href", new URL(href, window.location.href).href);
      }
    });
  },

  /**
   * Simplify nested elements in the article content.
   *
   * @param Element articleContent
   * @return void
   */
  _simplifyNestedElements: function(articleContent) {
    // Nothing to do here for this simplified version
  },

  /**
   * Runs a function on each node in a NodeList.
   *
   * @param NodeList nodeList The nodes to operate on
   * @param Function fn The function to apply to each node
   * @return void
   */
  _forEachNode: function(nodeList, fn) {
    Array.prototype.forEach.call(nodeList, fn, this);
  },

  /**
   * Check if any node in a NodeList matches a function.
   *
   * @param NodeList nodeList The nodes to operate on
   * @param Function fn The function to apply to each node
   * @return boolean
   */
  _someNode: function(nodeList, fn) {
    return Array.prototype.some.call(nodeList, fn, this);
  },

  /**
   * Get flags object for parser options.
   *
   * @return Object
   */
  _getFlags: function() {
    return {
      FLAG_STRIP_UNLIKELYS: 0x1,
      FLAG_WEIGHT_CLASSES: 0x2,
      FLAG_CLEAN_CONDITIONALLY: 0x4
    };
  },

  /**
   * Get rules for cleaning the article content.
   *
   * @return Object
   */
  _getCleanRules: function() {
    return {};
  },

  // Define constants
  TEXT_NODE: 3,

  // Regular expressions
  REGEXPS: {
    hasContent: /\S$/
  }
};

// Expose Readability to the global scope for use in content.js
window.Readability = Readability;
