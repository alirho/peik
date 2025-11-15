/**
 * An in-memory storage implementation that mimics the storageService API.
 * Useful for environments without IndexedDB or for testing.
 */

let settings = null;
const chats = new Map();

/**
 * Loads the user's settings from memory.
 * @returns {Promise<object|null>} A promise that resolves with the settings object or null.
 */
export async function loadSettings() {
    return settings;
}

/**
 * Saves the user's settings to memory.
 * @param {object} newSettings - The settings object.
 */
export async function saveSettings(newSettings) {
    settings = newSettings;
}

/**
 * Loads all chat objects from memory.
 * @returns {Promise<Array<object>>} A promise that resolves with the array of chats.
 */
export async function loadAllChats() {
    return Array.from(chats.values());
}

/**
 * Saves a single chat object to memory.
 * @param {object} chat - The chat object to save.
 */
export async function saveChat(chat) {
    // Clone to prevent mutation issues, mimicking database behavior
    chats.set(chat.id, JSON.parse(JSON.stringify(chat)));
}

/**
 * Deletes a single chat from memory by its ID.
 * @param {string} chatId - The ID of the chat to delete.
 */
export async function deleteChatById(chatId) {
    chats.delete(chatId);
}
