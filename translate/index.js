const wordList = JSON.parse(localStorage.getItem('wordList') || '[]');

const translate = document.getElementById('translate');
const auto_pronunciation = document.getElementById('auto-pronunciation');
const input = document.getElementById('input');
const output = document.getElementById('output');
const collect = document.getElementById('collect'); // 单词收藏
const collect_success = document.getElementById('collect-success');
const showCollectWord = document.getElementById('showCollectWord')
const playWordBtn = document.getElementById('playWord-btn');
const playWordStartIndex = document.getElementById('playWordStartIndex');
let timer;
let isShowParaphrase = false; // 是否显示释义
let globalSpeakUrl = '';
let playWordId = 0; // 用于多次点击播放时自动停止上一次播放过程
let recentScrollTime = Date.now()

console.log(formatDate());

window.onscroll = function () {
    recentScrollTime = Date.now()
}

// 播放单词语音
playWordBtn.onclick = function () {
    if (!showCollectWord.children) return
    let wordList = JSON.parse(localStorage.getItem('wordList'));
    let startIndex = 0
    let endIndex = wordList.length
    let pauseTime = 1000 // ms
    playWordId++

    if (playWordStartIndex.value > 0) {
        startIndex = playWordStartIndex.value - 1
    }
    if (startIndex >= endIndex) return;

    async function play(i = 0, playId) {
        let item = showCollectWord.children[i]
        if (playId !== playWordId) {
            item.previousElementSibling.getElementsByClassName('key')[0].style.color = ''
            return
        }
        if (item.previousElementSibling) {
            item.previousElementSibling.getElementsByClassName('key')[0].style.color = ''
        }
        item.getElementsByClassName('key')[0].style.color = '#000000'
        if (Date.now() - recentScrollTime > 2000) { // 一段时间内没有滚动就自动滚动到单词所在位置
            item.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            })
        }

        async function next() {
            if (i < endIndex) {
                await delay(pauseTime);
                document.body.removeChild(audio)
                play(++i, playId);
            }
        }

        let audio = document.createElement('audio')
        audio.src = wordList[i].speakUrl;
        audio.autoplay = true;
        audio.onended = next;
        audio.onerror = next;
        document.body.append(audio);
    }

    play(startIndex, playWordId)
}

//导出, 会导出两份文件, .txt文件用于阅读, .json文件用于导入
document.getElementById("export-btn").onclick = function () {
    let content = "";

    for (let i = 0; i < wordList.length; i++) {
        let { k: key, v: value } = wordList[i];

        let str = String(key).trim() + ":\t\t" +
            String(value).trim().replace(/\n/g, ';') + '\n';

        content += str;
    }

    // 导出为txt文件
    let blob = new Blob([content], {
        type: "text/plain;charset=utf-8"
    });
    let a = document.createElement('a')
    a.download = "导出单词" + formatDate() + ".txt";
    a.href = URL.createObjectURL(blob)
    a.click();
    URL.revokeObjectURL(a.href);

    // 导出为json文件
    a.download = "导出单词(用于导入)" + formatDate() + ".json";
    a.href = URL.createObjectURL(new Blob([JSON.stringify(wordList)], {
        type: "text/plain;charset=utf-8"
    }))
    a.click();
    URL.revokeObjectURL(a.href);
};

// 点击导入单词的button, 模拟点击隐藏的文件选择框
document.getElementById("import-btn").onclick = function () {
    document.getElementById("import-file").click();
}

// 导入, 允许导入json文件和txt文件
document.getElementById("import-file").addEventListener("change", function (e) {

    let file = e.target.files[0];
    if (!file) return;

    let reader = new FileReader();
    reader.readAsText(file);

    reader.onload = function (e) {
        if (file.type === 'application/json') {
            handleJsonFile()
        } else if (file.type === 'text/plain') {
            handleTxtFile()
        } else {
            alert("请选择json文件或者txt文件")
        }
        localStorage.setItem("wordList", JSON.stringify(wordList))
        render_collect_word()
    };

    // 用于导入txt文件, txt文件容易被用户更改导致格式错误, 导入json文件更靠谱
    function handleTxtFile() {
        let data = reader.result;
        // console.log(data);
        let dataArray = data.split(/:\t\t|\n/);
        dataArray.reverse()
        console.log(dataArray);
        for (let i = 0; i < dataArray.length; i += 2) {
            const key = dataArray[i];
            const value = dataArray[i + 1];
            uniqueImport(key, value)
        }
    }

    function handleJsonFile() {
        let data = reader.result;
        try {
            let importData = JSON.parse(data);
            importData.reverse()
            console.log(importData);
            for (let i = 0; i < importData.length; i++) {
                let { k: key, v: value, speakUrl } = importData[i];
                uniqueImport(key, value, speakUrl)
            }
        } catch (e) {
            alert('json文件格式错误, 无法导入');
        }
    }

    // 如果导入的key不存在于wordList才导入
    function uniqueImport(key, value, speakUrl) {
        if (!key) return;

        let hasSameKey = false;
        for (let j = 0; j < wordList.length; j++) {
            if (wordList[j].k === key) {
                hasSameKey = true;
                break;
            }
        }

        if (!hasSameKey) {
            wordList.unshift({
                k: key,
                v: value,
                speakUrl
            })
        }
    }
});


// 点击收藏
collect.onclick = function () {
    // 如果要保证k唯一,在unshift之前应该先遍历wordList查找该k是否已经存在,这里我就不保证k唯一了
    wordList.unshift({
        k: input.value.trim(),
        v: output.value.trim(),
        speakUrl: globalSpeakUrl
    })
    localStorage.setItem("wordList", JSON.stringify(wordList))
    collect_success.style.visibility = 'visible'; // 显示"收藏成功"
    render_collect_word();
    setTimeout(function () {
        collect_success.style.visibility = 'hidden' // 隐藏"收藏成功"
    }, 1500)
}


// 显示收藏的单词
function render_collect_word() {
    let wordHTML = '';
    for (let i = 0; i < wordList.length; i++) {
        let { k: key, v: value, speakUrl } = wordList[i];
        wordHTML += `
            <div class="showSingleParaphrase">
                <span class="key" data-speakUrl="${speakUrl || ''}">${i+1}. ${key}</span>
                <span class="value" style="display: ${isShowParaphrase ? '' : 'none'};">${value}</span>
                <button data-key="${key}" class="deleteWord floatR" style="color: #F44336;">删除</button>
                <br clear="both">
                <hr>
            </div>`
    }
    showCollectWord.innerHTML = wordHTML;
}

render_collect_word();


// 删除收藏的单词
$(document).delegate('.showSingleParaphrase > .deleteWord', 'click', function () {
    let key = this.dataset.key;
    // 相同的key只删除第一个, 不一定是点击删除的那一个
    for (let i = 0; i < wordList.length; i++) {
        if (wordList[i].k === key) {
            wordList.splice(i, 1);
            i--;// 删除数组元素后wordList.length会减一, 所以让i也减一
            this.parentElement.remove(); // 从dom中移除
            break;
        }
    }
    localStorage.setItem("wordList", JSON.stringify(wordList));
});


// 显示与隐藏单个释义
$(document).delegate('.showSingleParaphrase', 'click', function () {
    const elem = this.getElementsByClassName('value')[0]
    if (elem.style.display) {
        elem.style.display = '';
    } else {
        elem.style.display = 'none';
    }
});

$(document).delegate('.showSingleParaphrase > .key', 'click', function (e) {
    e.stopPropagation();
    pronunciation(this.dataset.speakurl);
});


// 显示与隐藏全部释义
let paraphraseBtn = document.getElementById('paraphrase-btn');
paraphraseBtn.onclick = function () {
    if (isShowParaphrase) {
        paraphraseBtn.innerText = '显示释义';
    } else {
        paraphraseBtn.innerText = '隐藏释义';
    }
    isShowParaphrase = !isShowParaphrase;
    render_collect_word();
}


// 初始化自动发音的状态并储存到localStorage
let is_auto_pronunciation = localStorage.getItem('is_auto_pronunciation');
if (!is_auto_pronunciation) {
    is_auto_pronunciation = "true" //默认自动发音
    localStorage.setItem('is_auto_pronunciation', is_auto_pronunciation)
}


input.oninput = function (ev) {
    // 函数防抖, 减少不必要的请求
    clearTimeout(timer);

    timer = setTimeout(() => {
        translateFun(); // 翻译
    }, 1000);
};

translate.onclick = function () {
    translateFun().then(result => {
        pronunciation(result.speakUrl); // 翻译后需要发音
    });
};

function changePronunciationBtnText() {
    if (is_auto_pronunciation === 'true') {
        auto_pronunciation.textContent = '允许发音: 开';
        auto_pronunciation.style.backgroundColor = 'rgb(50, 226, 203)';
    } else {
        auto_pronunciation.textContent = '允许发音: 关';
        auto_pronunciation.style.backgroundColor = 'rgb(169, 169, 169)';
    }
}

changePronunciationBtnText();

// 自动发音的开关
auto_pronunciation.onclick = function () {
    if (is_auto_pronunciation === 'true') {
        is_auto_pronunciation = 'false'
    } else {
        is_auto_pronunciation = 'true'
    }
    localStorage.setItem('is_auto_pronunciation', is_auto_pronunciation)
    changePronunciationBtnText()
};

async function translateFun() {
    let result = await send(input.value);
    if (!result) return {};
    // console.log(result);
    // console.log(result.speakUrl); // 翻译前的语音
    // console.log(result.tSpeakUrl); // 翻译后的语音

    globalSpeakUrl = result.speakUrl;

    if (result.basic && result.basic.explains) {
        let value = "";
        result.basic.explains.forEach(element => {
            value += element + '\n'; //让其换行
        });
        output.value = value;
    } else if (result.translation) {
        output.value = result.translation;
    } else {
        alert("错误: 没有返回翻译结果!")
    }

    return result;
}

function pronunciation(speakUrl) {
    if (is_auto_pronunciation === 'true' && speakUrl) {
        let audio = document.createElement('audio');
        audio.src = speakUrl;
        audio.play();
        audio = null;
    }
}

async function send(q, from = 'Auto', to = 'Auto') {
    if (!q) return;
    let result = null;
    await $.ajax({
        url: 'https://aidemo.youdao.com/trans',
        type: 'post',
        dataType: 'json',
        data: {
            q,
            from,
            to,
        },
        success(data) {
            result = data;
        },
        error() {
            alert('翻译失败, 请检查网络或稍后再试');
        }
    });
    return result;
}


// 格式化时间和日期
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
