/**
 * A service for dynamically loading and using the markdown-it library.
 * This implements a lazy-loading pattern to improve initial page load speed.
 */

let parser = null;
let loadingPromise = null;

/**
 * A safe fallback renderer that displays plain text and prevents XSS.
 * @param {string} text The text to render.
 * @returns {string} HTML-safe string with line breaks.
 */
const fallbackRender = (text) => {
    if (typeof text !== 'string' || !text) return '';
    const el = document.createElement('div');
    el.textContent = text;
    // Replace newlines with <br> for visual consistency
    return el.innerHTML.replace(/\r\n?|\n/g, '<br>');
};

/**
 * Dynamically loads the markdown-it library using a script tag.
 * This function will only execute the load once and cache the result.
 * @returns {Promise<object>} A promise that resolves with the markdown-it parser instance or a fallback.
 */
const load = () => {
    // If the library is already loading or loaded, return the existing promise
    if (loadingPromise) {
        return loadingPromise;
    }

    loadingPromise = new Promise((resolve, reject) => {
        // Check if the library is already available on the window object
        if (window.markdownit) {
            console.log('markdown-it already available.');
            // The constructor is typically all lowercase
            parser = new window.markdownit({
                html: false,
                breaks: true,
                linkify: true,
                typographer: true,
            });
            return resolve(parser);
        }

        const script = document.createElement('script');
        // Path relative to the root index.html
        script.src = 'plugins/presentation/webUI/lib/markdown-it.min.js';
        script.async = true;

        script.onload = () => {
            // After loading, the library should be on the window object
            if (window.markdownit) {
                parser = new window.markdownit({
                    html: false,
                    breaks: true,
                    linkify: true,
                    typographer: true,
                });
                console.log('markdown-it library loaded successfully via script tag.');
                resolve(parser);
            } else {
                reject(new Error('markdown-it script loaded, but `window.markdownit` is not defined.'));
            }
        };

        script.onerror = (err) => {
            reject(new Error('markdown-it script failed to load.'));
        };

        document.head.appendChild(script);
    }).catch(err => {
        console.error('Failed to load markdown-it library:', err);
        // If loading fails for any reason, use the safe fallback to prevent app crashes.
        parser = { render: fallbackRender };
        return parser; // Resolve with the fallback so consumers don't need a .catch()
    });

    return loadingPromise;
};

/**
 * Renders a Markdown string to HTML. If the library is not yet loaded,
 * it returns sanitized plain text as a fallback.
 * @param {string} markdownText The text to render.
 * @returns {string} The rendered HTML or sanitized plain text.
 */
const render = (markdownText) => {
    if (parser) {
        return parser.render(markdownText);
    }
    // If the library isn't loaded yet, use the safe fallback.
    // The UI layer is responsible for re-rendering once loading is complete.
    return fallbackRender(markdownText);
};

/**
 * Checks if the markdown-it library has been successfully loaded.
 * @returns {boolean} True if the parser is initialized.
 */
const isLoaded = () => !!parser && parser.render !== fallbackRender;

// Export a singleton service object
const markdownService = {
    load,
    render,
    isLoaded,
};

export default markdownService;