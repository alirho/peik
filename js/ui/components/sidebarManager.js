/**
 * Manages the behavior of the sidebar, specifically for mobile view.
 */
class SidebarManager {
    /**
     * Initializes the manager by finding the relevant DOM elements and binding events.
     */
    constructor() {
        this.sidebar = document.querySelector('.sidebar');
        this.menuToggleButton = document.getElementById('menu-toggle-button');

        if (this.sidebar && this.menuToggleButton) {
            this.bindEvents();
        }
    }

    /**
     * Binds the click event to the menu toggle button.
     */
    bindEvents() {
        this.menuToggleButton.addEventListener('click', this.toggle.bind(this));
    }

    /**
     * Toggles the 'open' class on the sidebar element to show or hide it.
     */
    toggle() {
        this.sidebar.classList.toggle('open');
    }
}

export default SidebarManager;
