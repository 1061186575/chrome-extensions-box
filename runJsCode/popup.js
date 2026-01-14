// 默认数据
const defaultList = [
    {
        url: '',
        code: 'alert("Hello World")',
        remark: 'test',
        autoRun: false,
    },
    {
        url: 'https://www.baidu.com',
        code: 'alert("要搜索什么?")',
        remark: '切换到百度自动执行',
        autoRun: true,
    },
    {
        url: '',
        code: `
localStorage.clear()
sessionStorage.clear()

var cookieRemove = (name) => {
    document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT'
}
var cookieNames = document.cookie.split('; ').map(d => d.split('=')[0])

cookieNames.forEach(name => cookieRemove(name))`,
        remark: '清理缓存和 cookie',
        autoRun: false,
    },
];

// 执行脚本
function executeScript(code) {
    // 向background发送消息执行脚本
    chrome.runtime.sendMessage({
        action: 'executeScript',
        code: code
    });
}

// 数据管理
class DataManager {
    constructor() {
    }

    add(item) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(['list'], (result) => {
                let list = result.list || defaultList;
                list.push(item);
                chrome.storage.local.set({list: list}, () => {
                    resolve();
                });
            });
        })
    }

    update(index, item) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(['list'], (result) => {
                let list = result.list || defaultList;
                list[index] = item;
                chrome.storage.local.set({list: list}, () => {
                    resolve();
                });
            });
        });
    }

    delete(index) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(['list'], (result) => {
                let list = result.list || defaultList;
                list.splice(index, 1);
                chrome.storage.local.set({list: list}, () => {
                    resolve();
                });
            });
        });
    }

    getAll() {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(['list'], (result) => {
                resolve(result.list || defaultList);
            });
        });
    }
}

// UI管理
class UIManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.init();
    }

    init() {
        this.bindEvents();
        this.renderList();
    }

    bindEvents() {
        document.getElementById('addBtn').addEventListener('click', () => {
            this.showAddForm();
        });

        document.getElementById('cancelAddBtn').addEventListener('click', () => {
            this.hideAddForm();
        });

        document.getElementById('saveAddBtn').addEventListener('click', () => {
            this.saveNewItem();
        });

        document.getElementById('importBtn').addEventListener('click', () => {
            document.getElementById('upload').click();
        });

        document.getElementById('upload').addEventListener('change', (e) => {
            this.importData(e);
        });

        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportData();
        });
    }

    renderList() {
        const listContainer = document.getElementById('dataList');
        listContainer.innerHTML = '';

        // 修改为异步获取数据
        this.dataManager.getAll().then(list => {
            list.forEach((item, index) => {
                const row = this.createDataRow(item, index);
                listContainer.appendChild(row);
            });
        });
    }

    createDataRow(item, index) {
        const div = document.createElement('div');
        div.className = 'data-row';
        div.innerHTML = `
            <textarea class="remark" disabled>${item.remark}</textarea>
            <textarea class="code" disabled>${item.code}</textarea>
            <textarea class="url" disabled>${item.url || ''}</textarea>
            <div class="auto-run">
                <input type="checkbox" ${item.autoRun ? 'checked' : ''} disabled>
                <label>启用</label>
            </div>
            <div class="actions">
                <button class="run-btn" data-index="${index}">执行</button>
                <button class="edit-btn" data-index="${index}">编辑</button>
                <button class="delete-btn" data-index="${index}">删除</button>
            </div>
        `;

        div.querySelector('.run-btn').addEventListener('click', () => {
            executeScript(item.code);
        });

        div.querySelector('.edit-btn').addEventListener('click', () => {
            this.editItem(div, index);
        });

        div.querySelector('.delete-btn').addEventListener('click', () => {
            this.deleteItem(index);
        });

        return div;
    }

    showAddForm() {
        document.getElementById('addForm').classList.remove('hidden');
        document.getElementById('addBtn').disabled = true;
    }

    hideAddForm() {
        document.getElementById('addForm').classList.add('hidden');
        document.getElementById('addBtn').disabled = false;
        this.clearAddForm();
    }

    clearAddForm() {
        document.getElementById('addRemark').value = '';
        document.getElementById('addCode').value = '';
        document.getElementById('addUrl').value = '';
        document.getElementById('addAutoRun').checked = false;
    }

    saveNewItem() {
        const newItem = {
            remark: document.getElementById('addRemark').value,
            code: document.getElementById('addCode').value,
            url: document.getElementById('addUrl').value,
            autoRun: document.getElementById('addAutoRun').checked
        };

        this.dataManager.add(newItem).then(() => {
            this.renderList();
            this.hideAddForm();
        });
    }

    editItem(rowElement, index) {
        // 异步获取数据后再编辑
        this.dataManager.getAll().then(list => {
            const item = list[index];
            const textareas = rowElement.querySelectorAll('textarea');
            const checkbox = rowElement.querySelector('input[type="checkbox"]');
            const buttons = rowElement.querySelectorAll('button');

            // 启用编辑
            textareas.forEach(ta => ta.disabled = false);
            checkbox.disabled = false;

            // 更改按钮
            buttons[1].textContent = '保存';
            buttons[1].className = 'btn-success';
            buttons[1].onclick = () => {
                this.saveItem(index, rowElement);
            };
        });
    }

    saveItem(index, rowElement) {
        const textareas = rowElement.querySelectorAll('textarea');
        const checkbox = rowElement.querySelector('input[type="checkbox"]');

        const updatedItem = {
            remark: textareas[0].value,
            code: textareas[1].value,
            url: textareas[2].value,
            autoRun: checkbox.checked
        };

        this.dataManager.update(index, updatedItem).then(() => {
            this.renderList();
        });
    }

    deleteItem(index) {
        if (confirm('确定要删除这项吗？')) {
            this.dataManager.delete(index).then(() => {
                this.renderList();
            });
        }
    }

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importList = JSON.parse(e.target.result);
                let importedCount = 0;

                this.dataManager.getAll().then(async list => {
                    for (let item of importList) {
                        if (this.isUnique(item, list)) {
                            await this.dataManager.add(item);
                            importedCount++;
                        }
                    }

                    this.renderList();
                    alert(`成功导入 ${importedCount} 条数据`);
                });
            } catch (error) {
                alert('文件格式错误，无法导入');
            }
        };

        reader.readAsText(file);
        event.target.value = ''; // 重置文件输入
    }

    isUnique(item, list) {
        if (!item.url && !item.code && !item.remark) {
            return false;
        }

        return !list.find(d =>
            d.url === item.url &&
            d.code === item.code &&
            d.remark === item.remark
        );
    }

    exportData() {
        this.dataManager.getAll().then(list => {
            const data = JSON.stringify(list, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `插件导出数据-${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();

            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
        });
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', function() {
    const dataManager = new DataManager();
    const uiManager = new UIManager(dataManager);
});
