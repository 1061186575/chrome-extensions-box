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
        this.defaultCategories = ['全部', '脚本', '自动运行', '获取页面数据'];
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

    // 获取所有分类
    getCategories() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['categories'], (result) => {
                resolve(result.categories || this.defaultCategories);
            });
        });
    }

    // 保存分类
    saveCategories(categories) {
        return new Promise((resolve) => {
            chrome.storage.local.set({categories}, () => {
                resolve();
            });
        });
    }

    // 获取当前选中的分类
    getCurrentCategory() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['currentCategory'], (result) => {
                resolve(result.currentCategory || '全部');
            });
        });
    }

    // 设置当前选中的分类
    setCurrentCategory(category) {
        return new Promise((resolve) => {
            chrome.storage.local.set({currentCategory: category}, () => {
                resolve();
            });
        });
    }
}

// UI管理
class UIManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.currentCategory = '全部';
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.migrateData();
        await this.initializeCategories();
        await this.renderCategories();
        this.renderList();
    }

    async migrateData() {
        // 确保所有现有数据都有分类字段
        const list = await this.dataManager.getAll();
        let needUpdate = false;
        list.forEach(item => {
            if (!item.category) {
                item.category = '全部';
                needUpdate = true;
            }
        });

        if (needUpdate) {
            await new Promise(resolve => {
                chrome.storage.local.set({list}, () => {
                    resolve();
                });
            });
        }
    }

    async initializeCategories() {
        this.currentCategory = await this.dataManager.getCurrentCategory();
    }

    async renderCategories() {
        const categories = await this.dataManager.getCategories();
        const categoryTabs = document.getElementById('categoryTabs');
        const categoryOptions = document.getElementById('categoryOptions');

        // 清空现有内容
        categoryTabs.innerHTML = '';
        categoryOptions.innerHTML = '';

        // 渲染分类标签
        categories.forEach(category => {
            const tab = document.createElement('div');
            tab.className = 'category-tab';
            tab.textContent = category;
            tab.dataset.category = category;

            if (category === this.currentCategory) {
                tab.classList.add('active');
            }

            tab.addEventListener('click', () => {
                this.switchCategory(category);
            });

            categoryTabs.appendChild(tab);

            // 添加到 datalist
            const option = document.createElement('option');
            option.value = category;
            categoryOptions.appendChild(option);
        });
    }

    async switchCategory(category) {
        this.currentCategory = category;
        await this.dataManager.setCurrentCategory(category);

        // 更新分类标签的激活状态
        document.querySelectorAll('.category-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.category === category) {
                tab.classList.add('active');
            }
        });

        // 重新渲染列表
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
                // 根据当前选中的分类进行筛选
                if (this.currentCategory === '全部' || item.category === this.currentCategory) {
                    const row = this.createDataRow(item, index);
                    listContainer.appendChild(row);
                }
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
            <div class="auto-run" style="width: 120px;">
                <input type="text" class="category-input" value="${item.category || '全部'}" disabled style="width: 100%; padding: 4px; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 12px;">
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
        document.getElementById('addCategory').value = this.currentCategory;
    }

    hideAddForm() {
        document.getElementById('addForm').classList.add('hidden');
        document.getElementById('addBtn').disabled = false;
        document.getElementById('addRemark').value = '';
        document.getElementById('addCode').value = '';
        document.getElementById('addUrl').value = '';
        document.getElementById('addAutoRun').checked = false;
        document.getElementById('addCategory').value = this.currentCategory;
    }

    async saveNewItem() {
        const category = document.getElementById('addCategory').value.trim() || '全部';

        const newItem = {
            remark: document.getElementById('addRemark').value,
            code: document.getElementById('addCode').value,
            url: document.getElementById('addUrl').value,
            autoRun: document.getElementById('addAutoRun').checked,
            category: category
        };

        // 如果是新分类，添加到分类列表中
        if (category !== '全部') {
            const categories = await this.dataManager.getCategories();
            if (!categories.includes(category)) {
                categories.push(category);
                await this.dataManager.saveCategories(categories);
                await this.renderCategories();
            }
        }

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
            const categoryInput = rowElement.querySelector('.category-input');
            const buttons = rowElement.querySelectorAll('button');

            // 启用编辑
            textareas.forEach(ta => ta.disabled = false);
            checkbox.disabled = false;
            categoryInput.disabled = false;

            // 更改按钮
            buttons[1].textContent = '保存';
            buttons[1].className = 'btn-success';
            buttons[1].onclick = () => {
                this.saveItem(index, rowElement);
            };
        });
    }

    async saveItem(index, rowElement) {
        const textareas = rowElement.querySelectorAll('textarea');
        const checkbox = rowElement.querySelector('input[type="checkbox"]');
        const categoryInput = rowElement.querySelector('.category-input');
        const category = categoryInput.value.trim() || '全部';

        const updatedItem = {
            remark: textareas[0].value,
            code: textareas[1].value,
            url: textareas[2].value,
            autoRun: checkbox.checked,
            category: category
        };

        // 如果是新分类，添加到分类列表中
        if (category !== '全部') {
            const categories = await this.dataManager.getCategories();
            if (!categories.includes(category)) {
                categories.push(category);
                await this.dataManager.saveCategories(categories);
                await this.renderCategories();
            }
        }

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
