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
    // const res = [
    //     "v_sh516160=\"1",
    //     "新能源ETF",
    //     "516160",
    //     "3.000",
    //     "2.958",
    // ]
    const stockMap = {
        1: '名称',
        // 2: '代码',
        3: '当前价格',
        32: '涨跌%',
    }

    let type = res[0].includes('sh') ? 1 : 0
    let code = res[2]
    let time = String(Date.now()).slice(0, -3);
    // https://quote.eastmoney.com/zs399905.html
    let url = `https://webquotepic.eastmoney.com/GetPic.aspx?imageType=r&type=&token=&nid=${type}.${code}&timespan=${time}`
    let html = ``
    html += `<tr data-url="${url}" class="link">`
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
                case '当前价格':
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
    // const stockCodeArr = [
    //     {
    //         name: '纳斯达克ETF',
    //         code: 'sh513300'
    //     },
    //     {
    //         name: '半导体ETF',
    //         code: 'sh512480'
    //     },
    // ]
    let stockCodeArr = JSON.parse(localStorage.getItem('stockCodeArr') || '[]')
    Promise.all(stockCodeArr.map((item) => getStock(item.code))).then(resList => {
        // console.log(`resList`, resList)
        resList = resList
            .sort((a, b) => b[32] - a[32])
            .map(arr => {
                arr[1] = arr[1].replace(/ETF.+/, 'ETF');
                return arr
            })
        const appEle = document.getElementById('app')
        const title = `<tr class="section-header"><td class="link" data-url="https://quote.eastmoney.com/zs399905.html">自选:</td></tr>`
        appEle.innerHTML = title + resList.map(res => genStockText(res)).join('')

        // 添加事件委托
        addOpenUrlEventListener(appEle)
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
    document.getElementById('plateRankRender').innerHTML = `<tr class="section-header"><td>涨幅榜:</td></tr> ${r(top)} <tr class="section-header bottom-header"><td>跌幅榜:</td></tr> ${r(bottom)}`
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
            html += `<td class="${colorClass} link" data-url="${url}">${value}</td>`;
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
    console.log('BTCUSDRes', BTCUSDRes)
    console.log('ETHUSDRes', ETHUSDRes)
    if (BTCUSDRes.ResultCode === '0' && ETHUSDRes.ResultCode === '0') {
        let BTCItem = BTCUSDRes.Result.corrCode.front.find(d => d.code === 'BTCUSD' || d.code === 'BTCCNY');
        let ETHItem = ETHUSDRes.Result.corrCode.front.find(d => d.code === 'ETHUSD' || d.code === 'ETHCNY');
        console.log('BTCItem', BTCItem)
        console.log('ETHItem', ETHItem)
        
        function CNYToUSD(res, item) {
            const value = +item.price.value;
            if (!item.code.endsWith('CNY')) {
                return value.toFixed(4)
            }
            let exchangeRate = 7
            try {
                // 美元兑换人民币汇率
                let USDCNYItem = res.Result.corrCode.back.find(d => d.code === 'USDCNY')
                exchangeRate = +USDCNYItem.price.value
            } catch (e) {
                console.log(`e`, e)
            }
            return (value / exchangeRate).toFixed(4)
        }
        
        if (BTCItem && ETHItem) {
            let title = genTr('BTC and Eth')
            let BTCPrice = genTr({
                value: 'BTC',
                url: 'https://gushitong.baidu.com/foreign/global-BTCUSD'
            }, {
                value: CNYToUSD(BTCUSDRes, BTCItem),
                url: 'https://gushitong.baidu.com/foreign/global-BTCUSD'
            }, BTCItem.ratio.value.replace('00%', '%'))

            let EthPrice = genTr({
                value: 'Eth',
                url: 'https://gushitong.baidu.com/foreign/global-ETHUSD'
            }, {
                value: CNYToUSD(ETHUSDRes, ETHItem),
                url: 'https://gushitong.baidu.com/foreign/global-ETHUSD'
            }, ETHItem.ratio.value.replace('00%', '%'))

            const BTCRenderEle = document.getElementById('BTCRender')
            BTCRenderEle.innerHTML = title + BTCPrice + EthPrice

            // 添加事件委托
            addOpenUrlEventListener(BTCRenderEle)

        }
    }
}

renderBTC();

function addOpenUrlEventListener(ele) {
    ele.addEventListener('click', function (event) {
        const target = event.target;
        const parentElement = target.parentElement;
        const tagName = target.tagName;
        if (
          ((tagName === 'TD' || tagName === 'TR') && target.hasAttribute('data-url')) ||
          (tagName === 'TD' && parentElement.hasAttribute('data-url'))
        ) {
            const url = target.getAttribute('data-url') || parentElement.getAttribute('data-url');
            window.open(url);
        }
    });
}
