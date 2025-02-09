// Create and inject the sidebar element
const sidebar = document.createElement('div');
sidebar.id = 'bookmark-sidebar';
sidebar.className = 'bookmark-sidebar';

// Create the toggle button
const toggleButton = document.createElement('div');
toggleButton.id = 'bookmark-toggle';
toggleButton.className = 'bookmark-toggle';

// Create the bookmarks container
const bookmarksContainer = document.createElement('div');
bookmarksContainer.className = 'bookmarks-container';

// Immediately initialize the sidebar structure
sidebar.appendChild(toggleButton);
sidebar.appendChild(bookmarksContainer);
document.body.appendChild(sidebar);

// Function to create bookmark elements
function createBookmarkElement(bookmark) {
  const element = document.createElement('div');
  element.className = 'bookmark-item';
  
  if (bookmark.url) {
    // 获取网站的favicon
    const getFavicon = (url) => {
      try {
        const urlObj = new URL(url);
        return `${urlObj.origin}/favicon.ico`;
      } catch (e) {
        return chrome.runtime.getURL('icons/icon16.png');
      }
    };

    const defaultIcon = chrome.runtime.getURL('icons/icon16.png');
    const faviconUrl = getFavicon(bookmark.url);

    element.innerHTML = `
      <a href="${bookmark.url}" title="${bookmark.title}">
        <img src="${faviconUrl}" 
             onerror="this.onerror=null; this.src='${defaultIcon}'" 
             alt=""
             width="16" 
             height="16">
        <span>${bookmark.title}</span>
      </a>
    `;
} else {
    element.className += ' folder';
    element.innerHTML = `
      <div class="folder-header">
        <span class="folder-title">${bookmark.title}</span>
        <span class="folder-toggle">▶</span>
      </div>
      <div class="folder-content" style="display: none;"></div>
    `;
    
    const folderContent = element.querySelector('.folder-content');
    if (bookmark.children) {
      bookmark.children.forEach(child => {
        folderContent.appendChild(createBookmarkElement(child));
      });
    }
    
    element.querySelector('.folder-header').addEventListener('click', (e) => {
      e.stopPropagation(); // 防止事件冒泡
      
      // 如果侧边栏是收起状态，先展开侧边栏
      if (!sidebar.classList.contains('expanded')) {
        sidebar.classList.add('expanded');
        isSidebarExpanded = true;
        // 给一点时间让侧边栏展开动画完成
        setTimeout(() => {
          const isExpanded = element.classList.toggle('expanded');
          const toggle = element.querySelector('.folder-toggle');
          const content = element.querySelector('.folder-content');
          
          if (isExpanded) {
            toggle.textContent = '▼';
            content.style.display = 'block';
          } else {
            toggle.textContent = '▶';
            content.style.display = 'none';
            
            // 递归折叠所有子文件夹
            const childFolders = content.querySelectorAll('.folder.expanded');
            childFolders.forEach(folder => {
              folder.classList.remove('expanded');
              folder.querySelector('.folder-toggle').textContent = '▶';
              folder.querySelector('.folder-content').style.display = 'none';
            });
          }
        }, 200);
      } else {
        const isExpanded = element.classList.toggle('expanded');
        const toggle = element.querySelector('.folder-toggle');
        const content = element.querySelector('.folder-content');
        
        if (isExpanded) {
          toggle.textContent = '▼';
          content.style.display = 'block';
        } else {
          toggle.textContent = '▶';
          content.style.display = 'none';
          
          // 递归折叠所有子文件夹
          const childFolders = content.querySelectorAll('.folder.expanded');
          childFolders.forEach(folder => {
            folder.classList.remove('expanded');
            folder.querySelector('.folder-toggle').textContent = '▶';
            folder.querySelector('.folder-content').style.display = 'none';
          });
        }
      }
    });
  }
  
  return element;
}

// Load and display bookmarks
async function loadBookmarks() {
  try {
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'GET_BOOKMARKS' }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      });
    });

    if (!response) {
      throw new Error('No response received from background script');
    }

    if (response.error) {
      throw new Error(response.error);
    }

    if (!response.bookmarks || !response.bookmarks[0] || !response.bookmarks[0].children) {
      throw new Error('Invalid bookmark data structure');
    }

    bookmarksContainer.innerHTML = '';
    response.bookmarks[0].children.forEach(bookmark => {
      bookmarksContainer.appendChild(createBookmarkElement(bookmark));
    });
  } catch (error) {
    console.error('Error loading bookmarks:', error);
    bookmarksContainer.innerHTML = `<div class="error-message">Error loading bookmarks: ${error.message}</div>`;
  }
}

// Initialize bookmarks
async function initializeBookmarks() {
  try {
    if (!chrome.runtime?.id) {
      throw new Error('Extension context is not available');
    }
    
    await loadBookmarks();
    // 添加初始化完成的标记，触发淡入动画
    requestAnimationFrame(() => {
      sidebar.classList.add('initialized');
    });
  } catch (error) {
    console.error('Error during initialization:', error);
    bookmarksContainer.innerHTML = '<div class="error-message">Failed to connect to extension. Please try reloading the page.</div>';
  }
}

// 确保DOM完全加载后再初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    requestAnimationFrame(initializeBookmarks);
  });
} else {
  requestAnimationFrame(initializeBookmarks);
}

// Handle sidebar visibility
let isMouseOverSidebar = false;
let hideTimeout;
let isSidebarExpanded = false;

function collapseSidebar() {
  isSidebarExpanded = false;
  sidebar.classList.remove('expanded');
  
  // 递归折叠所有展开的文件夹
  function collapseFolder(folder) {
    folder.classList.remove('expanded');
    const toggle = folder.querySelector('.folder-toggle');
    const content = folder.querySelector('.folder-content');
    if (toggle) toggle.textContent = '▶';
    if (content) {
      content.style.display = 'none';
      // 递归处理子文件夹
      const childFolders = content.querySelectorAll('.folder');
      childFolders.forEach(collapseFolder);
    }
  }
  
  const allFolders = sidebar.querySelectorAll('.folder');
  allFolders.forEach(collapseFolder);
}

toggleButton.addEventListener('click', (e) => {
  e.stopPropagation();
  isSidebarExpanded = !isSidebarExpanded;
  if (isSidebarExpanded) {
    sidebar.classList.add('expanded');
  } else {
    collapseSidebar();
  }
});

document.addEventListener('click', (e) => {
  if (!sidebar.contains(e.target) && isSidebarExpanded) {
    collapseSidebar();
  }
});

sidebar.addEventListener('mouseenter', () => {
  isMouseOverSidebar = true;
  clearTimeout(hideTimeout);
  isSidebarExpanded = true;
  requestAnimationFrame(() => {
    sidebar.classList.add('expanded');
  });
});

sidebar.addEventListener('mouseleave', () => {
  isMouseOverSidebar = false;
  if (hideTimeout) {
    clearTimeout(hideTimeout);
  }
  hideTimeout = setTimeout(() => {
    if (!isMouseOverSidebar) {
      collapseSidebar();
    }
  }, 300);
});

// Listen for bookmark changes
chrome.bookmarks.onCreated.addListener(loadBookmarks);
chrome.bookmarks.onRemoved.addListener(loadBookmarks);
chrome.bookmarks.onChanged.addListener(loadBookmarks);
chrome.bookmarks.onMoved.addListener(loadBookmarks);

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'TOGGLE_SIDEBAR') {
    isSidebarExpanded = !isSidebarExpanded;
    if (isSidebarExpanded) {
      sidebar.classList.add('expanded');
    } else {
      collapseSidebar();
    }
  }
});