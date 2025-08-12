/**
 * Matrix Nova UI Enhancements for Dunboyne Hair Studio
 * Provides modern dropdown components, keyboard navigation, and interactive features
 */

class MatrixNovaDropdown {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      searchable: true,
      placeholder: 'Select an option...',
      maxHeight: 300,
      ...options
    };
    this.isOpen = false;
    this.items = [];
    this.selectedItem = null;
    this.filteredItems = [];
    this.focusedIndex = -1;
    
    this.init();
  }
  
  init() {
    this.createDropdownHTML();
    this.bindEvents();
    this.setupKeyboardNavigation();
  }
  
  createDropdownHTML() {
    this.container.innerHTML = `
      <div class="dropdown-trigger" tabindex="0" role="combobox" aria-expanded="false" aria-haspopup="listbox">
        <span class="dropdown-label">${this.options.placeholder}</span>
        <div class="dropdown-arrow"></div>
      </div>
      <div class="dropdown-content" role="listbox">
        ${this.options.searchable ? `
          <div class="dropdown-search">
            <input type="text" placeholder="Search..." class="dropdown-search-input">
          </div>
        ` : ''}
        <div class="dropdown-items"></div>
      </div>
    `;
    
    this.trigger = this.container.querySelector('.dropdown-trigger');
    this.content = this.container.querySelector('.dropdown-content');
    this.label = this.container.querySelector('.dropdown-label');
    this.itemsContainer = this.container.querySelector('.dropdown-items');
    this.searchInput = this.container.querySelector('.dropdown-search-input');
    
    this.container.classList.add('dropdown');
  }
  
  setItems(items) {
    this.items = items;
    this.filteredItems = [...items];
    this.renderItems();
  }
  
  renderItems() {
    this.itemsContainer.innerHTML = '';
    this.filteredItems.forEach((item, index) => {
      const itemElement = document.createElement('div');
      itemElement.className = 'dropdown-item';
      itemElement.setAttribute('role', 'option');
      itemElement.setAttribute('data-index', index);
      itemElement.innerHTML = `
        <span>${item.label}</span>
        ${item.value ? `<span class="item-value">€${parseFloat(item.value).toFixed(2)}</span>` : ''}
      `;
      
      if (this.selectedItem && this.selectedItem.id === item.id) {
        itemElement.classList.add('selected');
        itemElement.setAttribute('aria-selected', 'true');
      }
      
      this.itemsContainer.appendChild(itemElement);
    });
  }
  
  bindEvents() {
    // Toggle dropdown
    this.trigger.addEventListener('click', (e) => {
      e.preventDefault();
      this.toggle();
    });
    
    // Item selection
    this.itemsContainer.addEventListener('click', (e) => {
      const item = e.target.closest('.dropdown-item');
      if (item) {
        const index = parseInt(item.getAttribute('data-index'));
        this.selectItem(this.filteredItems[index]);
      }
    });
    
    // Search functionality
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        this.filterItems(e.target.value);
      });
    }
    
    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target)) {
        this.close();
      }
    });
    
    // Prevent closing when clicking inside
    this.content.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
  
  setupKeyboardNavigation() {
    this.container.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (!this.isOpen) {
            this.open();
          } else if (this.focusedIndex >= 0) {
            this.selectItem(this.filteredItems[this.focusedIndex]);
          }
          break;
          
        case 'Escape':
          e.preventDefault();
          this.close();
          break;
          
        case 'ArrowDown':
          e.preventDefault();
          if (!this.isOpen) {
            this.open();
          } else {
            this.focusNextItem();
          }
          break;
          
        case 'ArrowUp':
          e.preventDefault();
          if (this.isOpen) {
            this.focusPreviousItem();
          }
          break;
          
        case 'Home':
          e.preventDefault();
          if (this.isOpen) {
            this.focusedIndex = 0;
            this.updateFocus();
          }
          break;
          
        case 'End':
          e.preventDefault();
          if (this.isOpen) {
            this.focusedIndex = this.filteredItems.length - 1;
            this.updateFocus();
          }
          break;
      }
    });
  }
  
  filterItems(query) {
    this.filteredItems = this.items.filter(item => 
      item.label.toLowerCase().includes(query.toLowerCase())
    );
    this.focusedIndex = -1;
    this.renderItems();
  }
  
  focusNextItem() {
    this.focusedIndex = Math.min(this.focusedIndex + 1, this.filteredItems.length - 1);
    this.updateFocus();
  }
  
  focusPreviousItem() {
    this.focusedIndex = Math.max(this.focusedIndex - 1, 0);
    this.updateFocus();
  }
  
  updateFocus() {
    const items = this.itemsContainer.querySelectorAll('.dropdown-item');
    items.forEach((item, index) => {
      item.classList.toggle('focused', index === this.focusedIndex);
    });
    
    if (this.focusedIndex >= 0) {
      items[this.focusedIndex].scrollIntoView({ block: 'nearest' });
    }
  }
  
  selectItem(item) {
    this.selectedItem = item;
    this.label.textContent = item.label;
    this.close();
    
    // Trigger change event
    const event = new CustomEvent('change', { 
      detail: { 
        selected: item,
        dropdown: this 
      } 
    });
    this.container.dispatchEvent(event);
  }
  
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }
  
  open() {
    this.isOpen = true;
    this.container.classList.add('active');
    this.trigger.setAttribute('aria-expanded', 'true');
    this.focusedIndex = -1;
    
    if (this.searchInput) {
      setTimeout(() => this.searchInput.focus(), 100);
    }
    
    // Add matrix glow effect
    this.container.classList.add('matrix-glow');
  }
  
  close() {
    this.isOpen = false;
    this.container.classList.remove('active');
    this.trigger.setAttribute('aria-expanded', 'false');
    this.focusedIndex = -1;
    
    if (this.searchInput) {
      this.searchInput.value = '';
      this.filterItems('');
    }
    
    this.trigger.focus();
    
    // Remove matrix glow effect
    this.container.classList.remove('matrix-glow');
  }
  
  getValue() {
    return this.selectedItem;
  }
  
  setValue(itemId) {
    const item = this.items.find(i => i.id === itemId);
    if (item) {
      this.selectItem(item);
    }
  }
}

// Enhanced notification system
class MatrixNotifications {
  constructor() {
    this.container = this.createContainer();
    this.notifications = [];
  }
  
  createContainer() {
    const container = document.createElement('div');
    container.id = 'matrix-notifications';
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 2000;
      pointer-events: none;
    `;
    document.body.appendChild(container);
    return container;
  }
  
  show(message, type = 'info', duration = 5000) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <div class="icon icon-${type}"></div>
        <div>${message}</div>
      </div>
    `;
    
    this.container.appendChild(notification);
    this.notifications.push(notification);
    
    // Trigger show animation
    requestAnimationFrame(() => {
      notification.classList.add('show');
    });
    
    // Auto remove
    setTimeout(() => {
      this.remove(notification);
    }, duration);
    
    return notification;
  }
  
  remove(notification) {
    notification.classList.remove('show');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
      this.notifications = this.notifications.filter(n => n !== notification);
    }, 300);
  }
  
  success(message, duration) {
    return this.show(message, 'success', duration);
  }
  
  error(message, duration) {
    return this.show(message, 'error', duration);
  }
  
  warning(message, duration) {
    return this.show(message, 'warning', duration);
  }
  
  info(message, duration) {
    return this.show(message, 'info', duration);
  }
}

// Enhanced loading states
class MatrixLoading {
  static show(element) {
    element.classList.add('loading-overlay');
    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    spinner.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 1001;
    `;
    element.appendChild(spinner);
  }
  
  static hide(element) {
    element.classList.remove('loading-overlay');
    const spinner = element.querySelector('.loading-spinner');
    if (spinner) {
      spinner.remove();
    }
  }
}

// Keyboard navigation enhancements
class KeyboardNavigationManager {
  constructor() {
    this.init();
  }
  
  init() {
    this.enhanceTabNavigation();
    this.enhanceTableNavigation();
  }
  
  enhanceTabNavigation() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach((tab, index) => {
      tab.addEventListener('keydown', (e) => {
        switch (e.key) {
          case 'ArrowLeft':
            e.preventDefault();
            const prevTab = tabs[index - 1] || tabs[tabs.length - 1];
            prevTab.focus();
            prevTab.click();
            break;
            
          case 'ArrowRight':
            e.preventDefault();
            const nextTab = tabs[index + 1] || tabs[0];
            nextTab.focus();
            nextTab.click();
            break;
            
          case 'Home':
            e.preventDefault();
            tabs[0].focus();
            tabs[0].click();
            break;
            
          case 'End':
            e.preventDefault();
            tabs[tabs.length - 1].focus();
            tabs[tabs.length - 1].click();
            break;
        }
      });
    });
  }
  
  enhanceTableNavigation() {
    const tables = document.querySelectorAll('.table');
    tables.forEach(table => {
      const cells = table.querySelectorAll('td input, td select');
      cells.forEach((cell, index) => {
        cell.addEventListener('keydown', (e) => {
          const row = cell.closest('tr');
          const cellIndex = Array.from(row.children).indexOf(cell.closest('td'));
          
          switch (e.key) {
            case 'Tab':
              // Default behavior is fine for Tab
              break;
              
            case 'Enter':
              e.preventDefault();
              const nextRow = row.nextElementSibling;
              if (nextRow) {
                const nextCell = nextRow.children[cellIndex]?.querySelector('input, select');
                if (nextCell) {
                  nextCell.focus();
                }
              }
              break;
              
            case 'ArrowUp':
              e.preventDefault();
              const prevRow = row.previousElementSibling;
              if (prevRow) {
                const prevCell = prevRow.children[cellIndex]?.querySelector('input, select');
                if (prevCell) {
                  prevCell.focus();
                }
              }
              break;
              
            case 'ArrowDown':
              e.preventDefault();
              const downRow = row.nextElementSibling;
              if (downRow) {
                const downCell = downRow.children[cellIndex]?.querySelector('input, select');
                if (downCell) {
                  downCell.focus();
                }
              }
              break;
          }
        });
      });
    });
  }
}

// Initialize global enhancements
const matrixNotifications = new MatrixNotifications();
const keyboardNav = new KeyboardNavigationManager();

// Export for use in other scripts
window.MatrixNova = {
  Dropdown: MatrixNovaDropdown,
  Notifications: matrixNotifications,
  Loading: MatrixLoading,
  KeyboardNav: keyboardNav
};

// Enhanced form validation with Matrix Nova styling
function enhanceFormValidation() {
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      input.addEventListener('invalid', (e) => {
        e.preventDefault();
        input.classList.add('error');
        const message = input.validationMessage || 'This field is required';
        matrixNotifications.error(message);
      });
      
      input.addEventListener('input', () => {
        if (input.checkValidity()) {
          input.classList.remove('error');
        }
      });
    });
  });
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', enhanceFormValidation);
} else {
  enhanceFormValidation();
}