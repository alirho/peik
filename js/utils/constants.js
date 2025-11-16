/**
 * Centralized constants for the application to avoid magic numbers and strings.
 */

// API related configurations
export const API_CONFIG = {
    MAX_RETRIES: 3,
    INITIAL_DELAY_MS: 1000,
    TIMEOUT_MS: 30000,
};

// UI related timeouts
export const UI_TIMEOUTS = {
    COPY_FEEDBACK_MS: 3000,
    ERROR_DISPLAY_MS: 5000,
};

// Cross-tab synchronization configuration
export const SYNC_CONFIG = {
    CHANNEL_NAME: 'goug-chat-sync',
};

// Storage related configurations
export const STORAGE_CONFIG = {
    MAX_SAVE_RETRIES: 3,
    SAVE_RETRY_DELAY_MS: 1000,
    UNSAVED_RETRY_INTERVAL_MS: 10000,
};

// --- Default Validation and Feature Limits ---
export const DEFAULT_LIMITS = {
    maxMessageLength: 50000,
    maxChatTitleLength: 100,
    maxChats: Infinity,
    maxMessagesPerChat: Infinity,
    file: {
        maxOriginalFileSizeBytes: 10 * 1024 * 1024, // 10 MB
        maxCompressedSizeBytes: 4 * 1024 * 1024,   // 4 MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        allowedExtensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    },
    image: {
        maxOriginalDimension: 4096, // Max width/height of original image
        maxFinalDimension: 1200,    // Max width/height after compression
        compressionQuality: 0.8,
        maxAspectRatio: 10.0,
    },
};

// --- Limit Presets for Different Environments ---
export const PRESET_LIMITS = {
    web: {
        // Uses default values, can be customized here
    },
    ide: {
        maxMessageLength: 100000,
        maxChats: 200,
        maxMessagesPerChat: 1000,
        file: {
            ...DEFAULT_LIMITS.file,
            maxOriginalFileSizeBytes: 20 * 1024 * 1024, // 20 MB
        },
    },
    mobile: {
        maxMessageLength: 25000,
        maxChats: 50,
        maxMessagesPerChat: 200,
        file: {
            ...DEFAULT_LIMITS.file,
            maxOriginalFileSizeBytes: 5 * 1024 * 1024, // 5 MB
            maxCompressedSizeBytes: 1.5 * 1024 * 1024, // 1.5 MB
        },
        image: {
            ...DEFAULT_LIMITS.image,
            maxFinalDimension: 800,
            compressionQuality: 0.75,
        }
    },
    unlimited: {
        maxMessageLength: Infinity,
        maxChatTitleLength: Infinity,
        maxChats: Infinity,
        maxMessagesPerChat: Infinity,
        file: {
            ...DEFAULT_LIMITS.file,
            maxOriginalFileSizeBytes: Infinity,
            maxCompressedSizeBytes: Infinity,
            allowedMimeTypes: ['*/*'],
            allowedExtensions: ['*'],
        },
        image: {
            ...DEFAULT_LIMITS.image,
            maxOriginalDimension: Infinity,
            maxFinalDimension: Infinity,
            maxAspectRatio: Infinity,
        }
    }
};