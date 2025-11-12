// The markdown-it library is loaded globally via a <script> tag in index.html.
// We access it through the window.markdownit object.
// This avoids the ES module import error with the UMD build of the library.

/**
 * A swappable service for parsing Markdown content.
 */
class MarkdownService {
    constructor() {
        if (typeof window.markdownit === 'undefined') {
            console.error('Markdown-it library not loaded. Make sure `markdown-it.min.js` is included in your HTML file.');
            // Provide a fallback parser that simply returns the text, to prevent app crashes.
            this.parser = { render: (text) => text };
            return;
        }
        
        // Use the globally available markdownit function
        this.parser = window.markdownit({
            html: false,        // Enable HTML tags in source
            breaks: true,
            linkify: true,     // Autoconvert URL-like text to links
            typographer: true, // Enable smartquotes and other typographic replacements
        });
    }

    /**
     * Renders a Markdown string to HTML.
     * @param {string} markdownText The text to render.
     * @returns {string} The rendered HTML.
     */
    render(markdownText) {
        if (typeof markdownText !== 'string' || !markdownText) {
            return '';
        }
        return this.parser.render(markdownText);
    }
}

// Export a singleton instance
const markdownService = new MarkdownService();
export default markdownService;
