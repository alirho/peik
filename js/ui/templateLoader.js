/**
 * Loads an HTML template from a given path.
 * @param {string} path The path to the HTML template file.
 * @returns {Promise<string>} A promise that resolves with the HTML content as a string.
 * @throws {Error} If the template cannot be fetched.
 */
export async function loadTemplate(path) {
    try {
        const response = await fetch(path);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.text();
    } catch (error) {
        console.error(`Failed to load template from ${path}:`, error);
        throw new Error(`Could not load template: ${path}`);
    }
}
