function createOnloadId() {
    if (globalThis.crypto?.randomUUID) {
        return globalThis.crypto.randomUUID();
    }
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function getPreLoadCode(token = '') {
    return `(${preLoadCode.toString()})(${JSON.stringify(token)});`;
}

function setupOnloadBridge(tab, token, callback) {
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: "ISOLATED",
        func: (token) => {
            window.__runJsCodeOnloadToken = token;
            if (window.__runJsCodeOnloadBridgeInited) {
                return;
            }
            window.__runJsCodeOnloadBridgeInited = true;
            window.addEventListener('message', (event) => {
                const data = event.data;
                if (event.source !== window || !data || data.type !== '__runJsCode__save_onload' || data.token !== window.__runJsCodeOnloadToken) {
                    return;
                }
                chrome.storage.local.set({
                    [`__runJsCode__onload_${data.id}`]: {
                        callback: data.callback,
                        params: data.params,
                        expiresAt: Date.now() + 10 * 60 * 1000
                    }
                }, () => {
                    window.postMessage({
                        type: '__runJsCode__save_onload_result',
                        requestId: data.requestId,
                        ok: !chrome.runtime.lastError,
                        error: chrome.runtime.lastError?.message
                    }, '*');
                });
            });
        },
        args: [token]
    }, callback);
}

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
                            // console.log(`Regex match: ${regexPattern} -> ${isMatch} for URL: ${url}`);
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
    let id = '';
    try {
        id = new URL(tab.url).searchParams.get('__runJsCode__onload_id');
    } catch (e) {
    }

    if (id) {
        const storageKey = `__runJsCode__onload_${id}`;
        chrome.storage.local.get([storageKey], (result) => {
            const item = result[storageKey];
            chrome.storage.local.remove(storageKey);

            if (!item || Date.now() > item.expiresAt) {
                console.warn('_onload: 未找到回调或回调已过期', id);
                return;
            }

            executeOnloadCallback(tab, item.callback, item.params, '__runJsCode__onload_id');
        });
        return;
    }

    checkUrlCallback(tab);
}

function decodeUrlCallback(value) {
    try {
        return decodeURIComponent(atob(value));
    } catch (e) {
        console.warn('_onload: URL 回调参数解码失败', e);
        return '';
    }
}

function getUrlCallbackParams(value) {
    if (!value) {
        return 'undefined';
    }

    try {
        const params = JSON.parse(decodeUrlCallback(value));
        return JSON.stringify(params);
    } catch (e) {
        console.warn('_onload: URL 回调参数解析失败', e);
        return '';
    }
}

function checkUrlCallback(tab) {
    let url;
    try {
        url = new URL(tab.url);
    } catch (e) {
        return;
    }

    const encodedCallback = url.searchParams.get('__runJsCode__onload_callback');
    if (!encodedCallback) {
        return;
    }

    const callbackCode = decodeUrlCallback(encodedCallback);
    const callbackParams = getUrlCallbackParams(url.searchParams.get('__runJsCode__callback_params'));
    if (!callbackCode || !callbackParams) {
        return;
    }

    chrome.storage.local.get(['list'], (result) => {
        const list = result.list || [];
        const savedItem = list.find(item => item && item.code === callbackCode);
        if (!savedItem) {
            console.warn('_onload: URL 回调代码与插件已保存代码不一致，已阻止执行');
            return;
        }

        executeOnloadCallback(tab, savedItem.code, callbackParams, [
            '__runJsCode__onload_callback',
            '__runJsCode__callback_params'
        ]);
    });
}

function executeOnloadCallback(tab, callbackCode, callbackParams, paramsToDelete) {
    const token = createOnloadId();
    setupOnloadBridge(tab, token, () => {
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            world: "MAIN",
            func: (code, params, keysToDelete) => {
                try {
                    const urlParams = new URLSearchParams(window.location.search);
                    keysToDelete.forEach(key => urlParams.delete(key));
                    const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '') + window.location.hash;
                    history.replaceState(null, '', newUrl);

                    const blob = new Blob([`;(function () { \ntry {\n${code}  \n} catch (e) { console.log('checkRefreshCallback error:', e) } finally { if (window._runJsCodePluginEnv === true) window._runJsCodePluginEnv = undefined; } })();`], { type: 'application/javascript' });
                    const url = URL.createObjectURL(blob);
                    const script = document.createElement('script');
                    script.src = url;
                    document.head.appendChild(script);
                    URL.revokeObjectURL(url);
                } catch (e) {
                    console.error('_onload: 出错', e);
                }
            },
            args: [`${getPreLoadCode(token)} \n(${callbackCode})(${callbackParams});`, callbackParams, paramsToDelete]
        });
    });
}

// 执行脚本
function executeScript(tab, code) {
    console.log(`executeScript`, code);

    const token = createOnloadId();
    setupOnloadBridge(tab, token, () => {
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            world: "MAIN", // 必须设置 MAIN 才能用 eval
            func: (preLoadCodeStr, code) => {
                try {
                    function safeRunCode(code) {
                        // eval(str);
                        // 可绕过部分 CSP 限制
                        (function () {
                            const blob = new Blob([`;(function () {\ntry {\n${code}  \n} catch (e) { console.log('safeRunCode error:', e) } finally { if (window._runJsCodePluginEnv === true) window._runJsCodePluginEnv = undefined; } })();`], { type: 'application/javascript' });
                            const url = URL.createObjectURL(blob);
                            const script = document.createElement('script');
                            script.src = url;
                            document.head.appendChild(script);
                            URL.revokeObjectURL(url);
                        })();
                        // console.log(`code`, code);
                    }

                    safeRunCode(preLoadCodeStr + '\n' + code);

                } catch (e) {
                    console.log(`runJsCode err`, e);
                }
            },
            args: [getPreLoadCode(token), code]
        });
    });
}


function preLoadCode(onloadToken = '') {
    if (window._runJsCodePluginEnv === undefined) {
        window._runJsCodePluginEnv = true;
    }

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

    function _waitForElementBase(selector, onlyOne = true, interval = 100, maxTimeout = 60 * 1000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            let timerId = null;
            let settled = false;

            const finish = (callback, value) => {
                if (settled) {
                    return;
                }
                settled = true;
                if (timerId) {
                    clearTimeout(timerId);
                }
                callback(value);
            };

            const checkElement = () => {
                if (settled) {
                    return;
                }

                if (onlyOne) {
                    const element = document.querySelector(selector);
                    if (element) {
                        finish(resolve, element);
                        return;
                    }
                } else {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length > 0) {
                        finish(resolve, Array.from(elements));
                        return;
                    }
                }

                const elapsed = Date.now() - startTime;
                if (elapsed >= maxTimeout) {
                    finish(reject, new Error(`_waitForElement: 等待元素超时，selector="${selector}", maxTimeout=${maxTimeout}ms`));
                    return;
                }

                timerId = setTimeout(checkElement, Math.min(interval, maxTimeout - elapsed));
            };

            // 初始检查
            checkElement();
        });
    }
    if (!window._waitForElement) {
        window._waitForElement = function (selector, interval = 100, maxTimeout = 60 * 1000) {
            return _waitForElementBase(selector, true, interval, maxTimeout)
        }
    }
    if (!window._waitForElements) {
        window._waitForElements = function (selector, interval = 100, maxTimeout = 60 * 1000) {
            return _waitForElementBase(selector, false, interval, maxTimeout)
        }
    }

    if (!window._copy) {
        window._copy = function copy(text) {
            if (text instanceof HTMLElement) {
                text = text.innerText.trim();
            }

            function legacyCopy(text) {
                return new Promise((resolve, reject) => {
                    const textarea = document.createElement('textarea');
                    textarea.value = text;
                    textarea.style.position = 'fixed';
                    document.body.appendChild(textarea);
                    textarea.select();

                    try {
                        const isSuccess = document.execCommand('copy');
                        if (isSuccess) {
                            resolve();
                        } else {
                            reject(new Error('复制失败'));
                        }
                    } catch (err) {
                        reject(err);
                    } finally {
                        document.body.removeChild(textarea);
                    }
                });
            }

            if (navigator.clipboard) {
                return navigator.clipboard.writeText(text).catch(() => {
                    return legacyCopy(text);
                });
            }
            return legacyCopy(text);
        }
    }

    if (!window._toast) {
        window._toast = function toast(msg, durationMs = 3000) {
            const durationNumber = Number(durationMs);
            durationMs = Number.isFinite(durationNumber) ? Math.max(0, durationNumber) : 3000;
            const containerId = '__runJsCodeToastContainer';
            let container = document.getElementById(containerId);

            if (!container) {
                container = document.createElement('div');
                container.id = containerId;
                Object.assign(container.style, {
                    position: 'fixed',
                    top: '24px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: '2147483647',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    pointerEvents: 'none',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                });
                document.documentElement.appendChild(container);
            }

            const toastEle = document.createElement('div');
            toastEle.textContent = msg instanceof HTMLElement ? msg.innerText : String(msg ?? '');
            Object.assign(toastEle.style, {
                maxWidth: 'min(420px, calc(100vw - 32px))',
                padding: '10px 14px',
                borderRadius: '6px',
                background: 'rgba(32, 33, 36, 0.94)',
                color: '#fff',
                fontSize: '14px',
                lineHeight: '20px',
                boxShadow: '0 6px 18px rgba(0, 0, 0, 0.22)',
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap',
                opacity: '0',
                transition: 'opacity 160ms ease, transform 160ms ease',
                transform: 'translateY(-6px)'
            });
            container.appendChild(toastEle);

            requestAnimationFrame(() => {
                toastEle.style.opacity = '1';
                toastEle.style.transform = 'translateY(0)';
            });

            const close = () => {
                toastEle.style.opacity = '0';
                toastEle.style.transform = 'translateY(-6px)';
                setTimeout(() => {
                    toastEle.remove();
                    if (container.childElementCount === 0) {
                        container.remove();
                    }
                }, 180);
            };

            setTimeout(close, durationMs);
            return close;
        }
    }

    if (!window._onload || window._onload.__runJsCodeHelper) {
        // callback 会在页面跳转后立即执行
        window._onload = async function (url, callback, callbackParams = undefined, runOptions = {}) {
            const { newTabOpen } = runOptions;
            if (typeof url !== 'string') {
                console.error('_onload: url 必须是字符串');
                return;
            }
            if (typeof callback !== 'function') {
                console.error('_onload: callback 必须是一个函数');
                return;
            }
            const supportedTypes = ['undefined', 'boolean', 'number', 'string', 'object'];
            if (!supportedTypes.includes(typeof callbackParams)) {
                console.error(`_onload: callbackParams 只支持: ${supportedTypes} 类型`);
                return;
            }

            // 使用 URL 对象和 URLSearchParams 正确处理 URL
            const urlObj = new URL(url, window.location.origin);
            const onloadId = window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
            const requestId = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
            let params = 'undefined';

            try {
                if (callbackParams !== undefined) {
                    params = JSON.stringify(callbackParams);
                }
            } catch (e) {
                console.error('_onload: callbackParams 序列化失败', e);
                return;
            }

            try {
                await new Promise((resolve, reject) => {
                    const timer = setTimeout(() => {
                        window.removeEventListener('message', onMessage);
                        reject(new Error('_onload: 保存回调超时'));
                    }, 1000);

                    function onMessage(event) {
                        const data = event.data;
                        if (event.source !== window || !data || data.type !== '__runJsCode__save_onload_result' || data.requestId !== requestId) {
                            return;
                        }
                        clearTimeout(timer);
                        window.removeEventListener('message', onMessage);
                        data.ok ? resolve() : reject(new Error(data.error || '_onload: 保存回调失败'));
                    }

                    window.addEventListener('message', onMessage);
                    window.postMessage({
                        type: '__runJsCode__save_onload',
                        token: onloadToken,
                        requestId,
                        id: onloadId,
                        callback: callback.toString(),
                        params
                    }, '*');
                });
            } catch (e) {
                console.error(e);
                return;
            }

            urlObj.searchParams.set('__runJsCode__onload_id', onloadId);
            const targetUrl = urlObj.toString();

            if (newTabOpen) {
                window.open(targetUrl);
            } else {
                location.href = targetUrl;
            }
        }
        window._onload.__runJsCodeHelper = true;
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
