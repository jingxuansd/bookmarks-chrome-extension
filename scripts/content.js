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

// Cache management functions
async function saveBookmarksToCache(bookmarks) {
  try {
    await chrome.storage.local.set({ 'cachedBookmarks': bookmarks });
    await chrome.storage.local.set({ 'lastCacheTime': Date.now() });
  } catch (error) {
    console.error('Error saving bookmarks to cache:', error);
  }
}

async function loadBookmarksFromCache() {
  try {
    const { cachedBookmarks, lastCacheTime } = await chrome.storage.local.get(['cachedBookmarks', 'lastCacheTime']);
    if (cachedBookmarks && lastCacheTime) {
      // Check if cache is less than 5 minutes old
      const cacheAge = Date.now() - lastCacheTime;
      if (cacheAge < 5 * 60 * 1000) { // 5 minutes in milliseconds
        return cachedBookmarks;
      }
    }
    return null;
  } catch (error) {
    console.error('Error loading bookmarks from cache:', error);
    return null;
  }
}

// Load and display bookmarks
async function loadBookmarks() {
  try {
    // Try to load from cache first
    const cachedBookmarks = await loadBookmarksFromCache();
    if (cachedBookmarks) {
      bookmarksContainer.innerHTML = '';
      cachedBookmarks[0].children.forEach(bookmark => {
        bookmarksContainer.appendChild(createBookmarkElement(bookmark));
      });
      return;
    }

    // If no valid cache, load from Chrome API
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

    // Save to cache before displaying
    await saveBookmarksToCache(response.bookmarks);

    bookmarksContainer.innerHTML = '';
    response.bookmarks[0].children.forEach(bookmark => {
      bookmarksContainer.appendChild(createBookmarkElement(bookmark));
    });
  } catch (error) {
    console.error('Error loading bookmarks:', error);
    bookmarksContainer.innerHTML = `<div class="error-message">Error loading bookmarks: ${error.message}</div>`;
  }
}

// Load saved sidebar state
async function loadSidebarState() {
  try {
    const { sidebarState } = await chrome.storage.local.get('sidebarState');
    if (sidebarState) {
      isSidebarExpanded = sidebarState.isExpanded;
      if (isSidebarExpanded) {
        sidebar.classList.add('expanded');
      }
    }
  } catch (error) {
    console.error('Error loading sidebar state:', error);
  }
}

// Save sidebar state
async function saveSidebarState() {
  try {
    await chrome.storage.local.set({
      'sidebarState': {
        isExpanded: isSidebarExpanded
      }
    });
  } catch (error) {
    console.error('Error saving sidebar state:', error);
  }
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

function setupSidebarInteractions() {
  // 鼠标移入事件
  sidebar.addEventListener('mouseenter', function(e) {
    console.log('Mouse entered sidebar');
    isMouseOverSidebar = true;
    clearTimeout(hideTimeout);
    clearTimeout(sidebar.timer);
    
    // 如果当前是收起状态，则展开
    if (!isSidebarExpanded) {
      isSidebarExpanded = true;
      sidebar.classList.add('expanded');
      saveSidebarState();
    }
  });

  // 鼠标移出事件
  sidebar.addEventListener('mouseleave', function(e) {
    console.log('Mouse left sidebar');
    isMouseOverSidebar = false;
    
    // 确保目标元素不是侧边栏内的元素
    if (!sidebar.contains(e.relatedTarget)) {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
      }
      
      hideTimeout = setTimeout(() => {
        if (!isMouseOverSidebar) {
          collapseSidebar();
          saveSidebarState();
        }
      }, 300);

      // 5 秒后隐藏 sidebar
      clearTimeout(sidebar.timer); // 清除之前的定时器，避免重复触发
      sidebar.timer = setTimeout(() => {
        sidebar.style.opacity = "0";
        sidebar.style.visibility = "hidden";
      }, 5000);
    }
  });

  // 点击切换按钮事件
  toggleButton.addEventListener('click', function(e) {
    e.stopPropagation();
    e.preventDefault();
    
    isSidebarExpanded = !isSidebarExpanded;
    if (isSidebarExpanded) {
      sidebar.classList.add('expanded');
    } else {
      collapseSidebar();
    }
    saveSidebarState();
  });

  // 点击文档其他地方时收起侧边栏
  document.addEventListener('click', function(e) {
    if (!sidebar.contains(e.target) && isSidebarExpanded) {
      collapseSidebar();
      saveSidebarState();
    }
  });
}

async function initializeBookmarks() {
  try {
    // 创建并初始化侧边栏结构
    document.body.appendChild(sidebar);
    
    // 加载保存的侧边栏状态
    await loadSidebarState();
    
    // 设置事件监听器
    setupSidebarInteractions();
    
    // 尝试加载书签（优先使用缓存）
    await loadBookmarks();
    
    // 添加初始化完成的标记，触发淡入动画
    requestAnimationFrame(() => {
      sidebar.classList.add('initialized');
    });
    
    // 设置自动保存状态的监听器
    const autoSaveObserver = new MutationObserver(() => {
      saveSidebarState();
    });
    
    autoSaveObserver.observe(sidebar, {
      attributes: true,
      attributeFilter: ['class']
    });
    
  } catch (error) {
    console.error('Error initializing bookmarks:', error);
  }
}

// 确保在文档准备好时初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeBookmarks);
  // 监听鼠标移动，控制 sidebar 的渐入渐出效果
  document.addEventListener("mousemove", (event) => {
    const sidebar = document.getElementById("bookmark-sidebar");

    // 检查鼠标是否移动到窗口左侧 0~10px 范围
    if (event.clientX <= 10) {
      sidebar.style.opacity = "1";
      sidebar.style.visibility = "visible";
    }
  });
} else {
  initializeBookmarks();
}

// 监听书签变化，自动更新缓存和显示
chrome.bookmarks.onCreated.addListener(async () => {
  await loadBookmarks();
  await saveBookmarksToCache(await chrome.bookmarks.getTree());
});

chrome.bookmarks.onRemoved.addListener(async () => {
  await loadBookmarks();
  await saveBookmarksToCache(await chrome.bookmarks.getTree());
});

chrome.bookmarks.onChanged.addListener(async () => {
  await loadBookmarks();
  await saveBookmarksToCache(await chrome.bookmarks.getTree());
});

chrome.bookmarks.onMoved.addListener(async () => {
  await loadBookmarks();
  await saveBookmarksToCache(await chrome.bookmarks.getTree());
});

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