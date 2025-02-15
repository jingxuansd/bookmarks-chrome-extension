// DOM 元素初始化
const sidebar = document.createElement('div');
sidebar.id = 'bookmark-sidebar';
sidebar.className = 'bookmark-sidebar';

const toggleButton = document.createElement('div');
toggleButton.id = 'bookmark-toggle';
toggleButton.className = 'bookmark-toggle';

const bookmarksContainer = document.createElement('div');
bookmarksContainer.className = 'bookmarks-container';

// 初始化侧边栏结构
sidebar.appendChild(toggleButton);
sidebar.appendChild(bookmarksContainer);

// 状态变量
let isMouseOverSidebar = false;
let hideTimeout;
let isSidebarExpanded = false;

/**
 * 处理文件夹点击事件
 * @param {Event} e - 点击事件对象
 */
function handleFolderClick(e) {
  e.stopPropagation();
  const folder = e.currentTarget.parentElement;
  const toggle = folder.querySelector('.folder-toggle');
  const content = folder.querySelector('.folder-content');
  const currentLevel = folder.closest('.folder-content') || bookmarksContainer;

  // 隐藏所有同级文件夹的内容
  const siblings = Array.from(currentLevel.children).filter(child => 
    child !== folder && child.classList.contains('folder')
  );
  siblings.forEach(sibling => {
    sibling.classList.remove('expanded');
    const siblingContent = sibling.querySelector('.folder-content');
    const siblingToggle = sibling.querySelector('.folder-toggle');
    if (siblingContent) siblingContent.style.display = 'none';
    if (siblingToggle) siblingToggle.textContent = '▶';
  });

  // 切换当前文件夹的展开状态
  folder.classList.toggle('expanded');
  if (folder.classList.contains('expanded')) {
    toggle.textContent = '▼';
    content.style.display = 'block';
    
    // 更新面包屑导航
    updateBreadcrumb(folder);
  } else {
    toggle.textContent = '▶';
    content.style.display = 'none';
    
    // 清除面包屑导航
    clearBreadcrumb();
  }
}

function updateBreadcrumb(folder) {
  const breadcrumbNav = document.querySelector('.breadcrumb-nav') || createBreadcrumbNav();
  breadcrumbNav.innerHTML = '';
  
  const path = [];
  let current = folder;
  
  // 构建路径
  while (current && !current.classList.contains('bookmarks-container')) {
    if (current.classList.contains('folder')) {
      path.unshift({
        title: current.querySelector('.folder-title').textContent,
        element: current
      });
    }
    current = current.parentElement.closest('.folder');
  }
  
  // 添加根目录
  path.unshift({
    title: '书签',
    element: bookmarksContainer
  });
  
  // 创建面包屑项
  path.forEach((item, index) => {
    const breadcrumbItem = document.createElement('span');
    breadcrumbItem.className = 'breadcrumb-item';
    breadcrumbItem.textContent = item.title;
    
    if (index < path.length - 1) {
      breadcrumbItem.addEventListener('click', () => {
        if (item.element === bookmarksContainer) {
          // 返回根目录
          const allFolders = bookmarksContainer.querySelectorAll('.folder');
          allFolders.forEach(f => {
            f.classList.remove('expanded');
            const content = f.querySelector('.folder-content');
            const toggle = f.querySelector('.folder-toggle');
            if (content) content.style.display = 'none';
            if (toggle) toggle.textContent = '▶';
          });
        } else {
          // 返回上级目录
          const event = new Event('click');
          item.element.querySelector('.folder-header').dispatchEvent(event);
        }
      });
      
      // 添加分隔符
      const separator = document.createElement('span');
      separator.className = 'breadcrumb-separator';
      separator.textContent = ' > ';
      breadcrumbNav.appendChild(breadcrumbItem);
      breadcrumbNav.appendChild(separator);
    } else {
      breadcrumbNav.appendChild(breadcrumbItem);
    }
  });
}

function createBreadcrumbNav() {
  const breadcrumbNav = document.createElement('div');
  breadcrumbNav.className = 'breadcrumb-nav';
  sidebar.insertBefore(breadcrumbNav, bookmarksContainer);
  return breadcrumbNav;
}

function clearBreadcrumb() {
  const breadcrumbNav = document.querySelector('.breadcrumb-nav');
  if (breadcrumbNav) {
    breadcrumbNav.innerHTML = '';
  }
}

/**
 * 创建书签元素
 * @param {Object} bookmark - 书签对象
 * @returns {HTMLElement} 创建的书签元素
 */
function createBookmarkElement(bookmark) {
  const element = document.createElement('div');
  element.className = 'bookmark-item';
  element.setAttribute('data-bookmark-id', bookmark.id);
  
  if (bookmark.url) {
    // 获取网站的favicon
    const getFavicon = (url) => {
      try {
        const urlObj = new URL(url);
        // 首先尝试使用Google Favicon服务
        return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
      } catch (e) {
        console.warn(`[Favicon] Error parsing URL: ${url}`, e);
        return chrome.runtime.getURL('icons/icon16.png');
      }
    };

    const defaultIcon = chrome.runtime.getURL('icons/icon16.png');
    const faviconUrl = getFavicon(bookmark.url);

    element.innerHTML = `
      <a href="${bookmark.url}" title="${bookmark.title}">
        <img src="${faviconUrl}" 
             alt=""
             width="16" 
             height="16"
             onerror="this.onerror=null; this.src='${defaultIcon}';">
        <span>${bookmark.title}</span>
      </a>
    `;

    // 为图片添加错误处理监听器
    const img = element.querySelector('img');
    img.addEventListener('error', function() {
      this.src = defaultIcon;
    });
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
    
    element.querySelector('.folder-header').addEventListener('click', handleFolderClick);
  }
  
  return element;
}

/**
 * 保存书签到缓存
 * @param {Array} bookmarks - 书签数组
 */
async function saveBookmarksToCache(bookmarks) {
  try {
    console.log('[Bookmarks Cache] Saving bookmarks to cache...');
    await chrome.storage.local.set({ 'cachedBookmarks': bookmarks });
    const timestamp = Date.now();
    await chrome.storage.local.set({ 'lastCacheTime': timestamp });
    console.log(`[Bookmarks Cache] Successfully saved bookmarks to cache at ${new Date(timestamp).toLocaleString()}`);
  } catch (error) {
    console.error('[Bookmarks Cache] Error saving bookmarks to cache:', error);
  }
}

async function loadBookmarksFromCache() {
  try {
    console.log('[Bookmarks Cache] Attempting to load bookmarks from cache...');
    const { cachedBookmarks, lastCacheTime } = await chrome.storage.local.get(['cachedBookmarks', 'lastCacheTime']);
    if (cachedBookmarks && lastCacheTime) {
      const cacheAge = Date.now() - lastCacheTime;
      const cacheAgeMinutes = Math.floor(cacheAge / 60000);
      console.log(`[Bookmarks Cache] Found cached bookmarks from ${new Date(lastCacheTime).toLocaleString()} (${cacheAgeMinutes} minutes old)`);
      if (cacheAge < 5 * 60 * 1000) {
        console.log('[Bookmarks Cache] Cache is fresh (less than 5 minutes old), using cached data');
        return cachedBookmarks;
      } else {
        console.log('[Bookmarks Cache] Cache is stale (more than 5 minutes old), will fetch fresh data');
      }
    } else {
      console.log('[Bookmarks Cache] No cache found or cache is incomplete');
    }
    return null;
  } catch (error) {
    console.error('[Bookmarks Cache] Error loading bookmarks from cache:', error);
    return null;
  }
}

/**
 * 加载并显示书签
 */
async function loadBookmarks() {
  try {
    console.log('[Bookmarks] Starting to load bookmarks...');
    // Try to load from cache first
    const cachedBookmarks = await loadBookmarksFromCache();
    if (cachedBookmarks) {
      console.log('[Bookmarks] Using cached bookmarks data');
      bookmarksContainer.innerHTML = '';
      console.log(`[Bookmarks] Rendering ${cachedBookmarks[0].children.length} bookmarks from cache`);
      cachedBookmarks[0].children.forEach(bookmark => {
        bookmarksContainer.appendChild(createBookmarkElement(bookmark));
      });
      return;
    }

    // If no valid cache, load from Chrome API with retry mechanism
    console.log('[Bookmarks] No valid cache found, fetching fresh data from Chrome API...');
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second

    while (retryCount < maxRetries) {
      try {
        const response = await new Promise((resolve, reject) => {
          const messageTimeout = setTimeout(() => {
            reject(new Error('消息响应超时'));
          }, 5000);

          chrome.runtime.sendMessage({ type: 'GET_BOOKMARKS' }, (response) => {
            clearTimeout(messageTimeout);
            if (chrome.runtime.lastError) {
              console.error('[Bookmarks] Chrome API Error:', chrome.runtime.lastError);
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            console.log('[Bookmarks] Successfully received response from Chrome API');
            resolve(response);
          });
        });

        if (!response) {
          throw new Error('未收到后台脚本响应');
        }

        if (response.error) {
          throw new Error(response.error);
        }

        if (!response.bookmarks || !response.bookmarks[0] || !response.bookmarks[0].children) {
          throw new Error('书签数据结构无效');
        }

        // Save to cache before displaying
        console.log('[Bookmarks] Saving fresh bookmarks data to cache...');
        await saveBookmarksToCache(response.bookmarks);

        console.log(`[Bookmarks] Rendering ${response.bookmarks[0].children.length} bookmarks from fresh data`);
        bookmarksContainer.innerHTML = '';
        response.bookmarks[0].children.forEach(bookmark => {
          bookmarksContainer.appendChild(createBookmarkElement(bookmark));
        });
        console.log('[Bookmarks] Successfully rendered all bookmarks');
        return;

      } catch (error) {
        console.error(`[Bookmarks] Attempt ${retryCount + 1}/${maxRetries} failed:`, error);
        retryCount++;
        
        if (retryCount < maxRetries) {
          console.log(`[Bookmarks] Retrying in ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    throw new Error(`加载书签失败，已重试 ${maxRetries} 次`);

  } catch (error) {
    console.error('Error loading bookmarks:', error);
    bookmarksContainer.innerHTML = `<div class="error-message">加载书签时出错: ${error.message}</div>`;
  }
}

/**
 * 加载侧边栏状态
 */
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

/**
 * 保存侧边栏状态
 */
async function saveSidebarState() {
  try {
    // 检查chrome.storage API是否可用
    if (!chrome?.storage?.local) {
      console.warn('[Sidebar State] Chrome storage API not available');
      return;
    }

    console.log('[Sidebar State] Saving sidebar state...');
    await chrome.storage.local.set({
      'sidebarState': {
        isExpanded: isSidebarExpanded
      }
    });
    console.log('[Sidebar State] Successfully saved sidebar state');
  } catch (error) {
    console.error('[Sidebar State] Error saving sidebar state:', error);
    // 错误发生时，至少保持UI状态的一致性
    if (isSidebarExpanded) {
      sidebar.classList.add('expanded');
    } else {
      sidebar.classList.remove('expanded');
    }
  }
}



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

// 书签变化事件监听
if (chrome.bookmarks && chrome.bookmarks.onCreated) {
  chrome.bookmarks.onCreated.addListener(async () => {
    await loadBookmarks();
    await saveBookmarksToCache(await chrome.bookmarks.getTree());
  });
}

if (chrome.bookmarks && chrome.bookmarks.onRemoved) {
  chrome.bookmarks.onRemoved.addListener(async () => {
    await loadBookmarks();
    await saveBookmarksToCache(await chrome.bookmarks.getTree());
  });
}

if (chrome.bookmarks && chrome.bookmarks.onMoved) {
  chrome.bookmarks.onMoved.addListener(async () => {
    await loadBookmarks();
    await saveBookmarksToCache(await chrome.bookmarks.getTree());
  });
}

if (chrome.bookmarks && chrome.bookmarks.onChanged) {
  chrome.bookmarks.onChanged.addListener(async () => {
    await loadBookmarks();
    await saveBookmarksToCache(await chrome.bookmarks.getTree());
  });
}

// 后台消息监听
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TOGGLE_SIDEBAR') {
    toggleSidebar();
  } else if (message.type === 'BOOKMARK_CREATED') {
    // 处理新增书签事件
    console.log('[Bookmarks] Received bookmark created event:', message.bookmark);
    const bookmarkElement = createBookmarkElement(message.bookmark);
    
    // 根据parentId找到父文件夹并插入书签
    if (message.bookmark.parentId) {
      const parentFolder = bookmarksContainer.querySelector(`[data-bookmark-id="${message.bookmark.parentId}"]`);
      if (parentFolder) {
        const folderContent = parentFolder.querySelector('.folder-content');
        if (folderContent) {
          folderContent.appendChild(bookmarkElement);
          return;
        }
      }
    }
    
    // 如果找不到父文件夹或是根节点的直接子书签，则添加到根节点
    bookmarksContainer.appendChild(bookmarkElement);
  } else if (message.type === 'BOOKMARK_CHANGED') {
    // 处理书签修改事件
    console.log('[Bookmarks] Received bookmark changed event:', message.bookmarkId, message.changeInfo);
    const existingBookmark = bookmarksContainer.querySelector(`[data-bookmark-id="${message.bookmarkId}"]`);
    if (existingBookmark) {
      existingBookmark.querySelector('.bookmark-title').textContent = message.changeInfo.title;
      existingBookmark.querySelector('.bookmark-link').href = message.changeInfo.url;
    }
  } else if (message.type === 'BOOKMARK_REMOVED') {
    // 处理书签删除事件
    console.log('[Bookmarks] Received bookmark removed event:', message.bookmarkId);
    const bookmarkToRemove = bookmarksContainer.querySelector(`[data-bookmark-id="${message.bookmarkId}"]`);
    if (bookmarkToRemove) {
      bookmarkToRemove.remove();
    }
  }
});
