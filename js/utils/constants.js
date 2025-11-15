/**
 * Centralized constants for the application to avoid magic numbers and strings.
 */

// API related configurations
export const API_CONFIG = {
    MAX_RETRIES: 3,
    INITIAL_DELAY_MS: 1000,
    TIMEOUT_MS: 30000,
};

// File upload and processing limits
export const FILE_LIMITS = {
    MAX_ORIGINAL_FILE_SIZE_MB: 10,
    COMPRESSION_THRESHOLD_MB: 2,
};

// Image compression settings
export const IMAGE_SETTINGS = {
    MAX_DIMENSION: 1200,
    COMPRESSION_QUALITY: 0.8,
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
