// 监听扩展安装或更新
chrome.runtime.onInstalled.addListener(() => {
  console.log('Bookmark Sidebar Manager installed/updated');
});

// 监听浏览器启动
chrome.runtime.onStartup.addListener(async () => {
  console.log('Browser started, initializing bookmark sidebar');
  try {
    // 预加载书签数据到缓存
    const bookmarks = await chrome.bookmarks.getTree();
    await chrome.storage.local.set({
      'cachedBookmarks': bookmarks,
      'lastCacheTime': Date.now()
    });
    console.log('Bookmarks cached on browser startup');
  } catch (error) {
    console.error('Error caching bookmarks on startup:', error);
  }
});

// 监听书签移除事件
chrome.bookmarks.onRemoved.addListener(async (id, removeInfo) => {
  console.log(`[Bookmarks] Bookmark removed: ${id}`);
  try {
    // 更新缓存
    const bookmarks = await chrome.bookmarks.getTree();
    await chrome.storage.local.set({
      'cachedBookmarks': bookmarks,
      'lastCacheTime': Date.now()
    });

    // 通知所有标签页更新书签显示
    const maxRetries = 3;
    const retryDelay = 1000; // 1秒延迟

    const notifyTab = async (tab, retryCount = 0) => {
      try {
        // 检查标签页状态
        const currentTab = await chrome.tabs.get(tab.id).catch(() => null);
        if (!currentTab || currentTab.status !== 'complete') {
          console.log(`[Bookmarks] Tab ${tab.id} is not ready for message, skipping...`);
          return;
        }

        await chrome.tabs.sendMessage(tab.id, {
          type: 'BOOKMARK_REMOVED',
          bookmarkId: id
        });
        console.log(`[Bookmarks] Successfully notified tab ${tab.id} about bookmark removal`);
      } catch (error) {
        // 详细记录错误类型
        const errorType = error.message.includes('Receiving end does not exist') ? 'CONNECTION_ERROR' : 'UNKNOWN_ERROR';
        console.log(`[Bookmarks] Notification error type for tab ${tab.id}: ${errorType}`);

        // 只对非连接错误进行重试
        if (errorType === 'UNKNOWN_ERROR' && retryCount < maxRetries - 1) {
          console.log(`[Bookmarks] Retrying notification for tab ${tab.id} in ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          return notifyTab(tab, retryCount + 1);
        } else if (errorType === 'CONNECTION_ERROR') {
          console.log(`[Bookmarks] Tab ${tab.id} does not have content script, skipping...`);
        } else {
          console.error(`[Bookmarks] Failed to notify tab ${tab.id} after ${retryCount + 1} attempts:`, error);
        }
      }
    };

    // 获取所有活动标签页
    const tabs = await chrome.tabs.query({ status: 'complete' });
    console.log(`[Bookmarks] Attempting to notify ${tabs.length} tabs about bookmark removal`);
    
    // 并行通知所有标签页
    await Promise.allSettled(tabs.map(tab => notifyTab(tab)));
    console.log('[Bookmarks] Finished notifying all tabs about bookmark removal');

  } catch (error) {
    console.error('[Bookmarks] Error handling bookmark removal:', error);
  }
});

// 监听书签新增事件
chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
  console.log(`[Bookmarks] Bookmark created: ${id}`);
  try {
    // 更新缓存
    const bookmarks = await chrome.bookmarks.getTree();
    await chrome.storage.local.set({
      'cachedBookmarks': bookmarks,
      'lastCacheTime': Date.now()
    });

    // 通知所有标签页更新书签显示
    const tabs = await chrome.tabs.query({ status: 'complete' });
    console.log(`[Bookmarks] Attempting to notify ${tabs.length} tabs about bookmark creation`);
    
    await Promise.allSettled(tabs.map(async tab => {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'BOOKMARK_CREATED',
          bookmark: bookmark
        });
        console.log(`[Bookmarks] Successfully notified tab ${tab.id} about bookmark creation`);
      } catch (error) {
        if (error.message.includes('Receiving end does not exist')) {
          console.log(`[Bookmarks] Tab ${tab.id} does not have content script, skipping...`);
        } else {
          console.error(`[Bookmarks] Failed to notify tab ${tab.id}:`, error);
        }
      }
    }));

    console.log('[Bookmarks] Finished notifying all tabs about bookmark creation');
  } catch (error) {
    console.error('[Bookmarks] Error handling bookmark creation:', error);
  }
});

// 监听书签修改事件
chrome.bookmarks.onChanged.addListener(async (id, changeInfo) => {
  console.log(`[Bookmarks] Bookmark changed: ${id}`);
  try {
    // 更新缓存
    const bookmarks = await chrome.bookmarks.getTree();
    await chrome.storage.local.set({
      'cachedBookmarks': bookmarks,
      'lastCacheTime': Date.now()
    });

    // 通知所有标签页更新书签显示
    const tabs = await chrome.tabs.query({ status: 'complete' });
    console.log(`[Bookmarks] Attempting to notify ${tabs.length} tabs about bookmark change`);
    
    await Promise.allSettled(tabs.map(async tab => {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'BOOKMARK_CHANGED',
          bookmarkId: id,
          changeInfo: changeInfo
        });
        console.log(`[Bookmarks] Successfully notified tab ${tab.id} about bookmark change`);
      } catch (error) {
        if (error.message.includes('Receiving end does not exist')) {
          console.log(`[Bookmarks] Tab ${tab.id} does not have content script, skipping...`);
        } else {
          console.error(`[Bookmarks] Failed to notify tab ${tab.id}:`, error);
        }
      }
    }));

    console.log('[Bookmarks] Finished notifying all tabs about bookmark change');
  } catch (error) {
    console.error('[Bookmarks] Error handling bookmark change:', error);
  }
});

// 处理来自content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_BOOKMARKS') {
    // 使用Promise.race添加超时机制
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('获取书签超时')), 5000);
    });

    const bookmarksPromise = chrome.bookmarks.getTree().then(bookmarkTreeNodes => {
      if (!bookmarkTreeNodes || !bookmarkTreeNodes.length) {
        throw new Error('未找到书签数据');
      }
      return bookmarkTreeNodes;
    });

    Promise.race([bookmarksPromise, timeoutPromise])
      .then(bookmarkTreeNodes => {
        console.log('[Background] Successfully retrieved bookmarks');
        sendResponse({ bookmarks: bookmarkTreeNodes });
      })
      .catch(error => {
        console.error('[Background] Error getting bookmarks:', error);
        sendResponse({ error: error.message });
      });

    return true; // 保持消息通道开放
  }

  if (request.type === 'ADD_BOOKMARK') {
    chrome.bookmarks.create({
      parentId: request.parentId,
      title: request.title,
      url: request.url
    }, (newBookmark) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError });
        return;
      }
      sendResponse({ success: true, bookmark: newBookmark });
    });
    return true;
  }

  if (request.type === 'REMOVE_BOOKMARK') {
    chrome.bookmarks.remove(request.id, () => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError });
        return;
      }
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.type === 'EDIT_BOOKMARK') {
    chrome.bookmarks.update(request.id, {
      title: request.title,
      url: request.url
    }, (updatedBookmark) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError });
        return;
      }
      sendResponse({ success: true, bookmark: updatedBookmark });
    });
    return true;
  }

  return false; // 表示不会发送响应
});

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SIDEBAR' });
});