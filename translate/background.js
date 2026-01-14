// 由于 Manifest V3 不再支持直接使用页面作为 background，
// 需要创建一个 service worker 来处理后台任务

chrome.action.onClicked.addListener((tab) => {
  // 当用户点击插件图标时打开 popup
  // popup 的内容已经在 index.html 中定义
});