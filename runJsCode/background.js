// 自动执行功能
function autoRun(tab) {
    chrome.storage.local.get(['list'], function (result) {
        const list = result.list || [];
        const url = tab.url;

        list.forEach(item => {
            if (item.autoRun) {
                if (!item.url) {
                    return executeScript(tab, item.code);
                }

                try {
                    // 支持正则表达式匹配和普通字符串匹配
                    let isMatch = false;

                    // 检查是否是正则表达式（以 / 开头和结尾）
                    if (item.url.startsWith('/') && item.url.endsWith('/')) {
                        // 正则表达式格式：/pattern/
                        try {
                            const regexPattern = item.url.slice(1, -1); // 去掉前后的 /
                            const regex = new RegExp(regexPattern);
                            isMatch = regex.test(url);
                            console.log(`Regex match: ${regexPattern} -> ${isMatch} for URL: ${url}`);
                        } catch (e) {
                            console.error('Invalid regex pattern:', item.url, e);
                            // 如果正则表达式无效，回退到字符串匹配
                            isMatch = url.startsWith(item.url);
                        }
                    } else {
                        // 普通字符串匹配
                        isMatch = url.startsWith(item.url);
                    }

                    if (isMatch) {
                        executeScript(tab, item.code);
                    }
                } catch (e) {
                    console.log(`自动运行代码执行出错`, e);
                }
            }
        });
    });
}

// 检查并执行刷新回调
function checkRefreshCallback(tab) {
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: "MAIN",
        func: (preLoadCodeStr) => {
            try {
                // 检查 URL 参数中是否有回调函数
                const urlParams = new URLSearchParams(window.location.search);
                const encodedCallback = urlParams.get('__runJsCode__onload_callback');

                if (encodedCallback) {
                    console.log('检测到 URL 参数中的回调函数');
                    const callbackString = decodeURIComponent(atob(encodedCallback));
                    console.log('解码后的回调函数:', callbackString);

                    // 清理 URL 参数（不刷新页面）
                    urlParams.delete('__runJsCode__onload_callback');
                    const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '') + window.location.hash;
                    history.replaceState(null, '', newUrl);
                    console.log('已清理 URL 参数，新 URL:', newUrl);

                    // 执行预加载代码和回调函数
                    const combinedCode = `(${preLoadCodeStr})(); \n(${callbackString})();`;
                    const blob = new Blob([`;(function () { try {  ${combinedCode}  } catch (e) { console.log('checkRefreshCallback error:', e) } })();`], { type: 'application/javascript' });
                    const url = URL.createObjectURL(blob);
                    const script = document.createElement('script');
                    script.src = url;
                    document.head.appendChild(script);
                    URL.revokeObjectURL(url);

                    console.log('回调函数执行完成');
                }
            } catch (e) {
                console.error('_onload: 出错', e);
            }
        },
        args: [preLoadCode.toString()]
    });
}

// 执行脚本
function executeScript(tab, code) {
    console.log(`executeScript`, code);

    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: "MAIN", // 必须设置 MAIN 才能用 eval
        func: (preLoadCodeStr, code) => {
            try {

                function safeRunCode(code) {
                    // eval(str);
                    // 可绕过部分 CSP 限制
                    (function () {
                        const blob = new Blob([`;(function () { try {  ${code}  } catch (e) { console.log('safeRunCode error:', e) } })();`], { type: 'application/javascript' });
                        const url = URL.createObjectURL(blob);
                        const script = document.createElement('script');
                        script.src = url;
                        document.head.appendChild(script);
                        URL.revokeObjectURL(url);
                    })();
                    // console.log(`code`, code);
                }

                safeRunCode(`(${preLoadCodeStr})();` + '\n' + code);

            } catch (e) {
                console.log(`runJsCode err`, e);
            }
        },
        args: [preLoadCode.toString(), code]
    });
}


function preLoadCode() {
    if (!window._$) {
        window._$ = document.querySelector.bind(document);
    }
    if (!window._$$) {
        window._$$ = document.querySelectorAll.bind(document);
    }

    if (!window._delay) {
        window._delay = async function delay(ms) {
            return new Promise((resolve) => {
                setTimeout(resolve, ms);
            });
        }
    }

    if (!window._copy) {
        window._copy = function copy(text) {
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
    }

    if (!window._onload) {
        // callback 会在页面跳转后立即执行
        window._onload = function (url, callback, options = {}) {
            const { newTabOpen, delayRun = 0 } = options;
            if (typeof url !== 'string') {
                console.error('_onload: url 必须是字符串');
                return;
            }
            if (typeof callback !== 'function') {
                console.error('_onload: callback 必须是一个函数');
                return;
            }
            if (typeof delayRun !== 'number') {
                console.error('_onload: delayRun 必须是一个数字, 单位是毫秒');
                return;
            }

            // 将回调函数序列化并编码为 URL 参数
            const callbackString = callback.toString();
            const encodedCallback = btoa(encodeURIComponent(callbackString));

            // 使用 URL 对象和 URLSearchParams 正确处理 URL
            const urlObj = new URL(url, window.location.origin);
            urlObj.searchParams.set('__runJsCode__onload_callback', encodedCallback);
            // urlObj.searchParams.set('__runJsCode__delay_run', String(delayRun));
            const targetUrl = urlObj.toString();

            if (newTabOpen) {
                window.open(targetUrl);
            } else {
                location.href = targetUrl;
            }
        }
    }
}

// 监听标签页激活事件
chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
        // 先检查刷新回调，再执行自动运行
        checkRefreshCallback(tab);
        autoRun(tab);
    });
});

// 监听标签页更新事件
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.active) {
        // 页面刷新完成后，先检查是否有待执行的回调函数
        checkRefreshCallback(tab);
        // 然后执行自动运行逻辑
        autoRun(tab);
    }
});

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'executeScript') {
        // 获取当前活动标签页并执行脚本
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
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
