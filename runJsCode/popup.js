// 默认数据
const defaultList = [
    {
        url: '',
        code: 'alert("Hello World")',
        remark: 'Hello',
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
        this.allCategory = '全部';
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

    pin(index) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(['list'], (result) => {
                let list = result.list || defaultList;
                if (list[index]) {
                    list[index].pinnedAt = Date.now();
                }
                chrome.storage.local.set({list: list}, () => {
                    resolve();
                });
            });
        });
    }

    unpin(index) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(['list'], (result) => {
                let list = result.list || defaultList;
                if (list[index]) {
                    delete list[index].pinnedAt;
                }
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

    // 从代码列表中动态获取分类
    async getCategories() {
        const list = await this.getAll();
        const categories = [...new Set(list.map(item => item.category || this.allCategory))];

        // 确保 allCategory 总是在第一位
        if (categories.includes(this.allCategory)) {
            categories.splice(categories.indexOf(this.allCategory), 1);
        }
        return [this.allCategory, ...categories.sort()];
    }

    // 获取当前选中的分类
    getCurrentCategory() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['currentCategory'], (result) => {
                resolve(result.currentCategory || this.allCategory);
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

    // 获取当前搜索内容
    getSearchQuery() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['searchQuery'], (result) => {
                resolve(result.searchQuery || '');
            });
        });
    }

    // 设置当前搜索内容
    setSearchQuery(searchQuery) {
        return new Promise((resolve) => {
            chrome.storage.local.set({searchQuery}, () => {
                resolve();
            });
        });
    }
}

// UI管理
class UIManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.currentCategory = dataManager.allCategory;
        this.searchQuery = '';
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.migrateData();
        await this.initializeCategories();
        await this.initializeSearch();
        await this.renderCategories();
        this.renderList();
    }

    async migrateData() {
        // 确保所有现有数据都有分类字段
        const list = await this.dataManager.getAll();
        let needUpdate = false;
        list.forEach(item => {
            if (!item.category) {
                item.category = this.dataManager.allCategory;
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

    async initializeSearch() {
        this.searchQuery = await this.dataManager.getSearchQuery();
        document.getElementById('searchInput').value = this.searchQuery;
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

        // 搜索相关事件
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.searchQuery = e.target.value.trim();
            this.dataManager.setSearchQuery(this.searchQuery);
            this.renderList();
        });

        document.getElementById('clearSearchBtn').addEventListener('click', () => {
            document.getElementById('searchInput').value = '';
            this.searchQuery = '';
            this.dataManager.setSearchQuery(this.searchQuery);
            this.renderList();
        });

        // 添加键盘快捷键支持
        document.addEventListener('keydown', (e) => {
            // Ctrl+F 或 Cmd+F 聚焦搜索框
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                document.getElementById('searchInput').focus();
            }
            // ESC 键清空搜索
            if (e.key === 'Escape' && document.getElementById('searchInput') === document.activeElement) {
                document.getElementById('searchInput').value = '';
                this.searchQuery = '';
                this.dataManager.setSearchQuery(this.searchQuery);
                this.renderList();
                document.getElementById('searchInput').blur();
            }
        });
    }

    renderList() {
        const listContainer = document.getElementById('dataList');
        const searchResultsElement = document.getElementById('searchResults');
        listContainer.innerHTML = '';

        // 修改为异步获取数据
        this.dataManager.getAll().then(list => {
            let matchedCount = 0;
            let totalCount = 0;

            const sortedList = list
                .map((item, index) => ({ item, index }))
                .sort((a, b) => {
                    const pinnedDiff = (b.item.pinnedAt || 0) - (a.item.pinnedAt || 0);
                    return pinnedDiff || a.index - b.index;
                });

            sortedList.forEach(({item, index}) => {
                // 先计算分类匹配
                const categoryMatch = this.currentCategory === this.dataManager.allCategory || item.category === this.currentCategory;

                if (categoryMatch) {
                    totalCount++;

                    // 再计算搜索匹配
                    const searchMatch = this.matchesSearch(item);

                    if (searchMatch) {
                        matchedCount++;
                        const row = this.createDataRow(item, index);
                        listContainer.appendChild(row);
                    }
                }
            });

            // 更新搜索结果统计
            if (this.searchQuery) {
                searchResultsElement.textContent = `找到 ${matchedCount} 条结果`;
                searchResultsElement.style.display = 'inline';
            } else {
                searchResultsElement.textContent = `共 ${totalCount} 条`;
                searchResultsElement.style.display = totalCount > 0 ? 'inline' : 'none';
            }
        });
    }

    // 检查项目是否匹配搜索条件
    matchesSearch(item) {
        if (!this.searchQuery) {
            return true;
        }

        const query = this.searchQuery.toLowerCase();
        const remark = (item.remark || '').toLowerCase();
        const code = (item.code || '').toLowerCase();
        const url = (item.url || '').toLowerCase();
        const category = (item.category || '').toLowerCase();

        return remark.includes(query) ||
               code.includes(query) ||
               url.includes(query) ||
               category.includes(query);
    }

    createDataRow(item, index) {
        const div = document.createElement('div');
        div.className = 'data-row';
        div.innerHTML = `
            <textarea class="remark" disabled>${item.remark}</textarea>
            <textarea class="code" disabled>${item.code}</textarea>
            <div class="auto-run">
                <input type="checkbox" ${item.autoRun ? 'checked' : ''} disabled>
                <!--<label>启用</label>-->
            </div>
            <textarea class="url" disabled>${item.url || ''}</textarea>
            <div class="category">
                <input type="text" class="category-input" value="${item.category || this.dataManager.allCategory}" disabled style="width: 100%; padding: 4px; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 12px;">
            </div>
            <div class="actions">
                <button class="run-btn" data-index="${index}">执行</button>
                <button class="pin-btn" data-index="${index}">${item.pinnedAt ? '取消' : '置顶'}</button>
                <button class="edit-btn" data-index="${index}">编辑</button>
                <button class="delete-btn" data-index="${index}">删除</button>
            </div>
        `;

        div.querySelector('.run-btn').addEventListener('click', () => {
            executeScript(item.code);
        });

        div.querySelector('.pin-btn').addEventListener('click', () => {
            this.togglePinItem(index, Boolean(item.pinnedAt));
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
        const category = document.getElementById('addCategory').value.trim() || this.dataManager.allCategory;

        const newItem = {
            remark: document.getElementById('addRemark').value,
            code: document.getElementById('addCode').value,
            url: document.getElementById('addUrl').value,
            autoRun: document.getElementById('addAutoRun').checked,
            category: category
        };

        await this.dataManager.add(newItem);
        // 重新渲染分类和列表
        await this.renderCategories();
        this.renderList();
        this.hideAddForm();
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
            buttons[2].textContent = '保存';
            buttons[2].className = 'btn-success';
            buttons[2].onclick = () => {
                this.saveItem(index, rowElement);
            };
        });
    }

    async saveItem(index, rowElement) {
        const list = await this.dataManager.getAll();
        const currentItem = list[index] || {};
        const textareas = rowElement.querySelectorAll('textarea');
        const checkbox = rowElement.querySelector('input[type="checkbox"]');
        const categoryInput = rowElement.querySelector('.category-input');
        const category = categoryInput.value.trim() || this.dataManager.allCategory;

        const updatedItem = {
            ...currentItem,
            remark: textareas[0].value,
            code: textareas[1].value,
            url: textareas[2].value,
            autoRun: checkbox.checked,
            category: category
        };

        await this.dataManager.update(index, updatedItem);
        // 重新渲染分类和列表
        await this.renderCategories();
        this.renderList();
    }

    async deleteItem(index) {
        if (confirm('确定要删除这项吗？')) {
            await this.dataManager.delete(index);
            // 重新渲染分类和列表
            await this.renderCategories();
            this.renderList();
        }
    }

    async togglePinItem(index, isPinned) {
        if (isPinned) {
            await this.dataManager.unpin(index);
        } else {
            await this.dataManager.pin(index);
        }
        this.renderList();
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

                    await this.renderCategories();
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
            a.download = `运行 JS 代码插件导出数据-${Date.now()}.json`;
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

Array.from(document.querySelectorAll('.tipIcon')).forEach(iconEle => {
    iconEle.addEventListener('click', function() {
        if (iconEle.title) {
            alert(iconEle.title)
        }
    });
});
