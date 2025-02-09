// Listen for extension installation or update
chrome.runtime.onInstalled.addListener(() => {
  console.log('Bookmark Sidebar Manager installed/updated');
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_BOOKMARKS') {
    chrome.bookmarks.getTree().then(bookmarkTreeNodes => {
      if (!bookmarkTreeNodes || !bookmarkTreeNodes.length) {
        sendResponse({ error: 'No bookmarks found' });
        return;
      }
      sendResponse({ bookmarks: bookmarkTreeNodes });
    }).catch(error => {
      console.error('Error getting bookmarks:', error);
      sendResponse({ error: error.message });
    });
    return true; // Required for async response
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

  return false; // Indicate no response will be sent
});

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SIDEBAR' });
});