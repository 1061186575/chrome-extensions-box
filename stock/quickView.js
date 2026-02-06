

document.getElementById('return').addEventListener('click', function () {
    location.href = '/index.html'
})


function getStock(stockCode) {
    return fetch('http://qt.gtimg.cn/q=' + stockCode)
        .then(res => res.arrayBuffer())
        .then(res => new TextDecoder('GBK').decode(res))
        .then(res => res.split('~'))
}

function genStockText(res) {
    // http://image.sinajs.cn/newchart/min/n/sh000001.gif
    // http://image.sinajs.cn/newchart/daily/n/sh000001.gif

    const stockMap = {
        1: '名称',
        32: '涨跌%',
    }
    // const list = [
    //     {
    //         name: '纳斯达克ETF',
    //         code: 'sh513300'
    //     },
    //     {
    //         name: '半导体ETF',
    //         code: 'sh512480'
    //     },
    // ]

    let html = ``
    html += '<tr>'
    res.forEach((d, i) => {

        let key = stockMap[i]
        if (key) {
            switch (key) {
                case '涨跌%':
                    const changePercent = parseFloat(d);
                    const colorClass = changePercent >= 0 ? 'positive' : 'negative';
                    html += `<td class="${colorClass}">${d}%</td>`
                    break;
                case '换手率':
                    html += `<td>${d}%</td>`
                    break;
                case '名称':
                    html += `<td>${d}</td>`
                    break;
                default:
                    html += key + ': ' + d + '<br>'
            }
        }
    })
    html += '</tr>'
    // console.log(`html`, html);
    return html
}

function render() {
    let stockCodeArr = JSON.parse(localStorage.getItem('stockCodeArr') || '[]')
    Promise.all(stockCodeArr.map((item) => getStock(item.code))).then(resList => {
        // console.log(`resList`, resList)
        resList = resList
            .sort((a, b) => b[32] - a[32])
            .map(arr => {
                arr[1] = arr[1].replace(/ETF.+/, 'ETF');
                return arr
            })
        document.getElementById('app').innerHTML = `<tr><td>自选:</td></tr>` + resList.map(res => genStockText(res)).join('')
    })
}

render();

async function renderRank() {
    const top = await plateRank(false)
    const bottom = await plateRank(true)
    /*
    top = [
        {
            "名称": "贵金属",
            "涨跌": "-6.57%"
        },
        {
            "名称": "光伏设备",
            "涨跌": "-4.87%"
        },
    ]
     */
    const r = arr => arr.slice(0, 5).map(d => {
        const values = Object.values(d);
        const name = values[0];
        const changePercent = values[1];
        return genTr(name, changePercent)
    }).join('')
    const str = `<tr class="section-header"><td>涨幅榜:</td><td></td></tr> ${r(top)} <tr class="section-header bottom-header"><td>跌幅榜:</td><td></td></tr> ${r(bottom)}`
    document.getElementById('plateRankRender').innerHTML = str
}

renderRank();

function genTr(...arr) {
    let html = '<tr>';

    arr.forEach((item) => {
        let value = item;
        let url = null;
        if (typeof item === 'object' && item !== null) {
            value = item.value;
            url = item.url;
        }
        const firstChar = String(value)[0];
        const lastChar = String(value)[String(value).length - 1];
        let colorClass = '';
        if (firstChar === '-') {
            colorClass = 'negative';
        } else if (firstChar === '+') {
            colorClass = 'positive';
        } else if (/\d/.test(firstChar) && lastChar === '%') {
            colorClass = 'positive';
        }

        // 如果有URL，添加data-url属性和点击样式
        if (url) {
            html += `<td class="${colorClass}" data-url="${url}" style="cursor: pointer;">${value}</td>`;
        } else {
            html += `<td class="${colorClass}">${value}</td>`;
        }
    });

    html += '</tr>';
    return html;
}

async function renderBTC() {
    // https://gushitong.baidu.com/foreign/global-BTCUSD
    // https://gushitong.baidu.com/foreign/global-ETHUSD
    let BTCUSDRes = await fetch('https://finance.pae.baidu.com/api/getrevforeigndata?query=BTCUSD&finClientType=pc').then(res => res.json())
    let ETHUSDRes = await fetch('https://finance.pae.baidu.com/api/getrevforeigndata?query=ETHUSD&finClientType=pc').then(res => res.json())
    if (BTCUSDRes.ResultCode === '0' && ETHUSDRes.ResultCode === '0') {
        let BTCItem = BTCUSDRes.Result.corrCode.front.find(d => d.code === 'BTCUSD' || d.name === '比特币美元');
        let ETHItem = ETHUSDRes.Result.corrCode.front.find(d => d.code === 'ETHCNY');
        if (BTCItem && ETHItem) {
            let title = genTr('BTC and Eth')
            let BTCPrice = genTr(BTCItem.name, {
                value: BTCItem.price.value,
                url: 'https://gushitong.baidu.com/foreign/global-BTCUSD'
            }, BTCItem.ratio.value.replace('00%', '%'))

            let exchangeRate = 7
            try {
                let USDCNYItem = ETHUSDRes.Result.corrCode.back.find(d => d.code === 'USDCNY')
                exchangeRate = +USDCNYItem.price.value
            } catch (e) {
                console.log(`e`, e)
            }
            let EthPrice = genTr('Eth 美元', {
                value: (+ETHItem.price.value / exchangeRate).toFixed(4),
                url: 'https://gushitong.baidu.com/foreign/global-ETHUSD'
            }, ETHItem.ratio.value.replace('00%', '%'))
            
            const BTCRenderEle = document.getElementById('BTCRender')
            BTCRenderEle.innerHTML = title + BTCPrice + EthPrice

            // 添加事件委托
            BTCRenderEle.addEventListener('click', function(event) {
                const target = event.target;
                if (target.tagName === 'TD' && target.hasAttribute('data-url')) {
                    const url = target.getAttribute('data-url');
                    window.open(url);
                }
            });

        }
    }
}
renderBTC();

