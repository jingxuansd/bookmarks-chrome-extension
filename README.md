# Bookmark Sidebar Manager

A Chrome extension that provides a convenient and elegant way to access your bookmarks through a collapsible sidebar. The sidebar appears on the left side of your browser window, offering quick access to your bookmarks and bookmark folders.

## Features

- 📌 Sleek, minimalist sidebar interface
- 🔄 Auto-hide and expand functionality
- 📁 Hierarchical folder structure support
- 🖱️ Intuitive mouse-over interaction
- 🎨 Clean, modern design with blur effect
- 🔄 Real-time bookmark updates
- 🖼️ Website favicon support
- 📱 Responsive and adaptive design

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension directory

## Usage

- Click the extension icon in the toolbar to toggle the sidebar
- Hover over the sidebar to expand it
- Click on folders to expand/collapse them
- Click on bookmarks to open them
- Click outside the sidebar to collapse it

## Development

### Project Structure

```
├── manifest.json        # Extension configuration
├── background.js        # Background service worker
├── scripts/
│   └── content.js      # Content script for sidebar functionality
├── styles/
│   └── sidebar.css     # Sidebar styling
└── icons/              # Extension icons
```

### Key Components

- **Sidebar Interface**: Implements a collapsible sidebar with smooth animations
- **Bookmark Management**: Handles bookmark data through Chrome's Bookmarks API
- **Event Handling**: Manages user interactions and bookmark updates
- **Visual Feedback**: Provides intuitive visual cues for user actions

### Features Implementation

- Uses Chrome's Bookmarks API for bookmark management
- Implements real-time updates through event listeners
- Employs modern CSS features for visual effects
- Handles favicon loading with fallback options

## Contributing

Contributions are welcome! Feel free to submit issues and pull requests.

## License

This project is open source and available under the MIT License.