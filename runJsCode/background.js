
// 自动执行功能
function autoRun(tab) {
    chrome.storage.local.get(['list'], function(result) {
        const list = result.list || [];
        const url = tab.url;

        list.forEach(item => {
            if (item.autoRun) {
                if (!item.url) {
                    return executeScript(tab, item.code);
                }
                if (url.startsWith(item.url)) {
                    executeScript(tab, item.code);
                }
            }
        });
    });
}

// 执行脚本
function executeScript(tab, code) {
    console.log(`executeScript`, code);

    const preLoadCode = `
function formatDate(inputTime = new Date()) {
  let date = new Date(inputTime);
  let y = date.getFullYear();
  let m = date.getMonth() + 1;
  let d = date.getDate();
  m = m < 10 ? ('0' + m) : m;
  d = d < 10 ? ('0' + d) : d;
  return y + '-' + m + '-' + d;
}

async function delay(ms) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms);
  });
}

function copy(text) {
  if (text instanceof HTMLElement) {
    text = text.innerText
  }
  let input = document.createElement('textarea');
  document.body.appendChild(input);
  input.value = text;
  input.select();
  if (!document.execCommand('copy')) {
    alert('复制失败');
  }
  document.body.removeChild(input);
}
`;
    
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: "MAIN", // 必须设置 MAIN 才能用 eval
        func: (preLoadCode, code) => {
            try {

                var str = preLoadCode + ';' + code;
                var s = document.createElement('script')
                s.textContent = str;
                document.body.append(s);
                s.remove();

                // eval(str);
            } catch (e) {
                console.log(`runJsCode err`, e);
            }
        },
        args: [preLoadCode, code]
    });
}

// 监听标签页激活事件
chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
        autoRun(tab);
    });
});

// 监听标签页更新事件
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.active) {
        autoRun(tab);
    }
});

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'executeScript') {
        // 获取当前活动标签页并执行脚本
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs.length > 0) {
                executeScript(tabs[0], message.code);
            }
        });
    }
});

// 由于 Manifest V3 不再支持直接使用页面作为 background，
// 需要创建一个 service worker 来处理后台任务
// 目前插件主要逻辑在 popup 中运行，所以这里可以保持简单

chrome.action.onClicked.addListener((tab) => {
  // 当用户点击插件图标时打开 popup
  // popup 的内容已经在 index.html 中定义
});
