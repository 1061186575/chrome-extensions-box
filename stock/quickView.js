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
    let dayUrl = `https://webquoteklinepic.eastmoney.com/GetPic.aspx?nid=${type}.${code}&type=&unitWidth=-6&ef=&formula=KDJ&AT=1&imageType=KXL&timespan=${time}`
    let html = ``
    html += `<tr>`
    res.forEach((d, i) => {
        let key = stockMap[i]
        if (key) {
            switch (key) {
                case '涨跌%':
                    const changePercent = parseFloat(d);
                    const colorClass = changePercent >= 0 ? 'positive' : 'negative';
                    html += `<td data-url="https://quote.eastmoney.com/${code}.html" data-action="open" class="${colorClass} link">${d}%</td>`
                    break;
                case '换手率':
                    html += `<td>${d}%</td>`
                    break;
                case '名称':
                    html += `<td  data-url="${url}" data-action="showMinImage" class="link">${d}</td>`
                    break;
                case '当前价格':
                    html += `<td  data-url="${dayUrl}" data-action="showDayImage" class="link">${d}</td>`
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
        const title = `<tr class="section-header"><td class="link" data-url="https://quote.eastmoney.com/zs399905.html" data-action="open">自选:</td></tr>
<tr><td id="showAllMinImage" class="cursorP">全部分时图</td></tr>`
        appEle.innerHTML = title + resList.map(res => genStockText(res)).join('')

        // 添加事件委托
        addOpenUrlEventListener(appEle)
    })
}

render();

async function renderRank() {
    const top = await ETFRank(false)
    const bottom = await ETFRank(true)
    const top2 = await plateRank(false)
    const bottom2 = await plateRank(true)
    // console.log(`top`, top);
    // console.log(`top2`, top2);

    /*
    top = [
        {
            "type": "etf",
            "名称": "中韩半导体ETF华泰柏瑞",
            "涨跌": "9.99%",
            "代码": "513310"
        }
    ]
    top2 = [
        {
            "type": "plate",
            "名称": "半导体材料",
            "涨跌": "9.06%",
            "代码": "BK1325"
        }
    ]
     */
    const r = arr => arr
        .map((d, i) => {
            const name = d.名称.replace(/ETF.+/, 'ETF');
            const code = String(d.代码)
            const changePercent = d.涨跌;
            const firstIndex = arr.findIndex(d2 => d2.名称.startsWith(name))
            // 去掉重复的 ETF 名称
            if (firstIndex > -1 && i !== firstIndex) {
                return ''
            }

            let urlParamType = addStockPrefix(code).includes('sh') ? 1 : 0
            if (code.startsWith('BK')) {
                urlParamType = 90;
            }
            let time = String(Date.now()).slice(0, -3);
            // https://quote.eastmoney.com/zs399905.html
            let imgUrl = `https://webquotepic.eastmoney.com/GetPic.aspx?imageType=r&type=&token=&nid=${urlParamType}.${code}&timespan=${time}`
            return genTr({
                value: name,
                url: imgUrl,
                action: code ? 'showMinImage' : 'open',
            }, {
                value: changePercent,
                url: d.type === 'etf' ? `https://quote.eastmoney.com/${code}.html` : `https://quote.eastmoney.com/bk/${urlParamType}.${code}.html`,
                action: 'open',
            })
        }).filter(d => d).slice(0, 5).join('')
    const plateRankRenderEle = document.getElementById('plateRankRender')
    plateRankRenderEle.innerHTML = `<tr class="section-header"><td>涨幅榜:</td></tr> ${r(top)}${r(top2)} <tr class="section-header bottom-header"><td>跌幅榜:</td></tr> ${r(bottom)}${r(bottom2)}`
    // 添加事件委托
    addOpenUrlEventListener(plateRankRenderEle)
}

renderRank();

function genTr(...arr) {
    let html = '<tr>';

    arr.forEach((item) => {
        let value = item;
        let url = null;
        let action = null;
        if (typeof item === 'object' && item !== null) {
            value = item.value;
            url = item.url;
            action = item.action;
        }
        const firstChar = String(value)[0];
        const lastChar = String(value)[String(value).length - 1];
        let colorClass = '';
        if (firstChar === '-') {
            colorClass = 'negative';
        } else if (firstChar === '+') {
            colorClass = 'positive';
        } else if (parseFloat(value) === 0 && lastChar === '%') {
            colorClass = '';
        } else if (/\d/.test(firstChar) && lastChar === '%') {
            colorClass = 'positive';
        }

        // 如果有URL，添加data-url属性和点击样式
        if (url) {
            html += `<td class="${colorClass} link" data-url="${url}" data-action="${action}">${value}</td>`;
        } else {
            html += `<td class="${colorClass}">${value}</td>`;
        }
    });

    html += '</tr>';
    return html;
}

function getGold() {
    // https://quote.eastmoney.com/center/gridlist2.html#futures_101_1
    let now = Date.now()
    let callbackName = `jQuery371037434943223805185_${now}`
    return fetch(`https://futsseapi.eastmoney.com/list/variety/101/1?callbackName=${callbackName}&field=dm%2Csc%2Cname%2Cp%2Czdf%2Czsjd%2Czde%2Co%2Czjsj%2Ch%2Cl%2Cvol%2Ccje%2Cwp%2Cnp%2Cccl&token=58b2fa8f54683b60b87d69b31969089c&orderBy=zdf&sort=desc&pageSize=20&pageIndex=0&blockName=callback&_=${now + 2}`)
        .then(res => res.text())
        .then(text => {
            // console.log('text', text)
            let jsonStr = text.replace(callbackName, '').replace(/^\(/, '').replace(/\)$/, '');
            let obj = JSON.parse(jsonStr).list.find(d => d.name === 'COMEX黄金')
            return {
                name: obj.name,
                value: obj.p,
                ratio: obj.zdf,
            }
        })
        .catch(err => {
            console.error('err', err)
        })
}

function getNDX() {
    // https://quote.eastmoney.com/gb/zsNDX.html
    // https://quote.eastmoney.com/gb/zsNDX100.html
    let now = Date.now()
    let callbackName = `jQuery371016327434452843647_${now}`
    // https://push2.eastmoney.com/api/qt/stock/get?invt=2&fltt=1&cb=jQuery351036492793292695_1787723047269&fields=f58%2Cf107%2Cf57%2Cf43%2Cf59%2Cf169%2Cf170%2Cf152%2Cf46%2Cf60%2Cf44%2Cf45%2Cf171%2Cf47%2Cf86%2Cf292&secid=100.NDX&ut=fa5fd1943c7b386f172d6893dbfba10b&wbp2u=%7C0%7C0%7C0%7Cweb&dect=1&_=1787723047270
    // https://push2.eastmoney.com/api/qt/stock/get?invt=2&fltt=1&cb=jQuery351089441917184841_1787723118578&fields=f58%2Cf107%2Cf57%2Cf43%2Cf59%2Cf169%2Cf170%2Cf152%2Cf46%2Cf60%2Cf44%2Cf45%2Cf171%2Cf47%2Cf86%2Cf292&secid=100.NDX100&ut=fa5fd1943c7b386f172d6893dbfba10b&wbp2u=%7C0%7C0%7C0%7Cweb&dect=1&_=1787723118579
    // let name = 'NDX'
    let name = 'NDX100'
    return fetch(`https://push2.eastmoney.com/api/qt/clist/get?np=1&fltt=1&invt=2&cb=${callbackName}&fs=i%3A100.DJIA%2Ci%3A100.SPX%2Ci%3A100.${name}%2Ci%3A100.TSX%2Ci%3A100.BVSP%2Ci%3A100.MXX&fields=f12%2Cf13%2Cf14%2Cf292%2Cf1%2Cf2%2Cf4%2Cf3%2Cf152%2Cf17%2Cf18%2Cf15%2Cf16%2Cf7%2Cf124&fid=f3&pn=1&pz=20&po=1&dect=1&ut=fa4fd6943c7b386f272d6893dbfba10b&wbp2u=%7C0%7C0%7C0%7Cweb&_=${now + 3}`)
        .then(res => res.text())
        .then(text => {
            // console.log('text', text)
            let jsonStr = text.replace(callbackName, '').replace(/^\(/, '').replace(/\);$/, '');
            let obj = JSON.parse(jsonStr).data.diff.find(d => d.f12 === name)
            return {
                name: obj.f14,
                value: obj.f2 / 100,
                ratio: obj.f3 / 100,
            }
        })
        .catch(err => {
            console.error('err', err)
        })
}

function getExchangeRate() {
    // https://quote.eastmoney.com/center/gridlist.html#forex_cnh
    // https://push2.eastmoney.com/api/qt/clist/get?np=1&fltt=1&invt=2&cb=jQuery371021256925088745415_1771556994041&fs=m%3A133&fields=f12%2Cf13%2Cf14%2Cf1%2Cf2%2Cf4%2Cf3%2Cf152%2Cf17%2Cf18%2Cf15%2Cf16&fid=f3&pn=1&pz=20&po=1&dect=1&ut=fa5fd1943c7b386f172d6893dbfba10b&wbp2u=%7C0%7C0%7C0%7Cweb&_=1771556994043
    let now = Date.now()
    let callbackName = `jQuery371016327434452843647_${now}`
    return fetch(`https://push2.eastmoney.com/api/qt/clist/get?np=1&fltt=1&invt=2&cb=${callbackName}&fs=m%3A133&fields=f12%2Cf13%2Cf14%2Cf1%2Cf2%2Cf4%2Cf3%2Cf152%2Cf17%2Cf18%2Cf15%2Cf16&fid=f3&pn=1&pz=20&po=1&dect=1&ut=fa5fd1943c7b386f172d6893dbfba10b&wbp2u=%7C0%7C0%7C0%7Cweb&_=${now + 5}`)
        .then(res => res.text())
        .then(text => {
            // console.log('text', text)
            let jsonStr = text.replace(callbackName, '').replace(/^\(/, '').replace(/\);$/, '');
            let obj = JSON.parse(jsonStr).data.diff.find(d => d.f14 === '美元兑离岸人民币')
            return {
                name: obj.f14,
                value: obj.f2 / 10000,
                ratio: obj.f3 / 100,
            }
        })
        .catch(err => {
            console.error('err', err)
        })
}

async function renderBTC() {
    // https://gushitong.baidu.com/foreign/global-BTCUSD
    // https://gushitong.baidu.com/foreign/global-ETHUSD

    let headers = {
        "accept": "application/vnd.finance-web.v1+json",
        "accept-language": "en,zh-CN;q=0.9,zh;q=0.8",
        "acs-token": "1777010415458_1777050910847_a28oKD3KMjUklhIdRZDCMcJmQE2nsyID80ZM9YIl5zlnxfE3SVslsn/eNVRI906UODU6gOXSL8vJjS59ojoLJRspmANVtbF9Mg8YGDKWL6EeL78QGNrd3Rhh+FxLfwnV0EHuPD/3pipUKzpH9IGPDt0IIJqEYP+DoPJ6urArS5kyeqLIkrutURxBYXljmzsUFdtrupigS2jMQoVhdeerI5iP88+tzTAGcxVuwyGEXWa7D1NN8hxmoWG0RMWQY2wQnbO8mdzOtdFdU8Yqxe/gzunYiPNb6nRBHLAzKhHrJlLz4HHPlHyY0+cXPILV2t9QmWGMoHauBqs6/FgUvDspyseyyl7aWVnzgAMLj16eX5w+3M9j0yc6LjKfa5hJ9JCqnxhF2CVpy/7mtGeAua2mdA==",
        "cache-control": "no-cache",
        "pragma": "no-cache",
        "priority": "u=1, i",
        "sec-ch-ua": "\"Google Chrome\";v=\"147\", \"Not.A/Brand\";v=\"8\", \"Chromium\";v=\"147\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Windows\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site"
    }
    let params = {
        headers,
        "referrer": "https://finance.baidu.com/",
        "body": null,
        "method": "GET",
    }

    const [
        NDXItem,
        GoldItem,
        BTCUSDRes,
        ETHUSDRes,
        exchangeRateItem,
    ] = await Promise.all([
        getNDX(),
        getGold(),
        fetch('https://finance.pae.baidu.com/api/getrevforeigndata?query=BTCUSD&finClientType=pc', params).then(res => res.json()),
        fetch('https://finance.pae.baidu.com/api/getrevforeigndata?query=ETHUSD&finClientType=pc', params).then(res => res.json()),
        getExchangeRate(),
    ])

    console.log('NDXItem', NDXItem)
    console.log('GoldItem', GoldItem)
    console.log('BTCUSDRes', BTCUSDRes)
    console.log('ETHUSDRes', ETHUSDRes)
    console.log('exchangeRateItem', exchangeRateItem)

    // 美元兑换人民币汇率
    let exchangeRate = exchangeRateItem?.value || 7;

    let title = `<tr class="section-header"><td>其他:</td></tr>`
    let NDXContent = ''
    let GoldContent = ''
    let BTCContent = ''
    let EthContent = ''

    if (NDXItem) {
        NDXContent = genTr({
            value: NDXItem.name,
            url: `https://webquotepic.eastmoney.com/GetPic.aspx?imageType=r&token=ed8644c9d251add88e27b65506f6e5da&nid=100.NDX&timespan=${get10LenTime()}`,
            action: `showMinImage`,
        }, {
            value: NDXItem.value,
            url: `https://webquoteklinepic.eastmoney.com/GetPic.aspx?nid=100.NDX&type=&unitWidth=-6&ef=&formula=KDJ&imageType=KXL&timespan=${get10LenTime()}`,
            action: `showDayImage`,
        }, {
            value: NDXItem.ratio + '%',
            url: `https://quote.eastmoney.com/gb/zsNDX.html`,
            action: `open`,
        })
    }

    if (GoldItem) {
        // GoldContent += genTr({
        //     value: GoldItem.name,
        //     url: `https://webquotepic.eastmoney.com/GetPic.aspx?imageType=r&type=&token=ed8644c9d251add88e27b65506f6e5da&nid=101.GC00Y&timespan=${get10LenTime()}`,
        //     action: 'showMinImage',
        // }, {
        //     value: GoldItem.value,
        //     url: `https://quote.eastmoney.com/globalfuture/GC00Y.html`,
        //     action: 'open',
        // }, GoldItem.ratio + '%')
        GoldContent += genTr({
            value: '黄金(元/g)',
            url: `https://webquotepic.eastmoney.com/GetPic.aspx?imageType=r&type=&token=ed8644c9d251add88e27b65506f6e5da&nid=101.GC00Y&timespan=${get10LenTime()}`,
            action: 'showMinImage',
        }, {
            // value: (GoldItem.value / 31.1035 * exchangeRate).toFixed(2),
            value: GoldItem.value,
            url: `https://webquoteklinepic.eastmoney.com/GetPic.aspx?nid=101.GC00Y&type=&unitWidth=-6&ef=&formula=KDJ&AT=1&imageType=KXL&timespan=${get10LenTime()}`,
            action: 'showDayImage',
        }, {
            value: GoldItem.ratio + '%',
            url: `https://quote.eastmoney.com/globalfuture/GC00Y.html`,
            action: 'open',
        })
    }

    if (BTCUSDRes.ResultCode === '0' && ETHUSDRes.ResultCode === '0') {
        console.log('获取BTC数据成功')
        let BTCItem = BTCUSDRes.Result.corrCode.front.find(d => d.code === 'BTCUSD' || d.code === 'BTCCNY');
        let ETHItem = ETHUSDRes.Result.corrCode.front.find(d => d.code === 'ETHUSD' || d.code === 'ETHCNY');
        // console.log('BTCItem', BTCItem)
        // console.log('ETHItem', ETHItem)

        function CNYToUSD(res, item) {
            const value = +item.price.value;
            if (!item.code.endsWith('CNY')) {
                return value.toFixed(2)
            }
            // try {
            //     // 美元兑换人民币汇率
            //     let USDCNYItem = res.Result.corrCode.back.find(d => d.code === 'USDCNY')
            //     if (+USDCNYItem.price.value > 0) {
            //         exchangeRate = +USDCNYItem.price.value
            //     }
            // } catch (e) {
            //     console.log(`e`, e)
            // }
            return (value / exchangeRate).toFixed(2)
        }

        if (BTCItem) {
            BTCContent = genTr({
                value: 'BTC',
                url: 'https://gushitong.baidu.com/foreign/global-BTCUSD'
            }, {
                value: CNYToUSD(BTCUSDRes, BTCItem),
                url: 'https://gushitong.baidu.com/foreign/global-BTCUSD'
            }, BTCItem.ratio.value.replace('00%', '%'))
        }

        if (ETHItem) {
            EthContent = genTr({
                value: 'Eth',
                url: 'https://gushitong.baidu.com/foreign/global-ETHUSD'
            }, {
                value: CNYToUSD(ETHUSDRes, ETHItem),
                url: 'https://gushitong.baidu.com/foreign/global-ETHUSD'
            }, ETHItem.ratio.value.replace('00%', '%'))
        }
    }

    // 渲染
    let BTCRenderId = 'BTCRenderLast'
    let date = new Date()
    // 非A股交易时间就把BTC放最前面
    if (date.getHours() < 9 || date.getHours() > 16 || date.getDay() === 6 || date.getDay() === 0) {
        BTCRenderId = 'BTCRenderFirst'
    }

    const BTCRenderEle = document.getElementById(BTCRenderId)
    BTCRenderEle.innerHTML = title + NDXContent + GoldContent + BTCContent + EthContent

    // 添加事件委托
    addOpenUrlEventListener(BTCRenderEle)
}

renderBTC();

function addOpenUrlEventListener(ele) {
    ele.addEventListener('click', function (event) {
        const target = event.target;
        const parentElement = target.parentElement;
        const tagName = target.tagName;
        if (target.id === 'showAllMinImage') {
            let tr = target.parentElement
            while (tr && tr.nextElementSibling) {
                tr = tr.nextElementSibling
                if (insertMinImage(tr)) {
                    // 这里是为了跳过新添加的 tr
                    tr = tr.nextElementSibling
                }
            }
            target.remove() // 防止重复点击
            setBodyWidth()
            return
        }
        if (
            ((tagName === 'TD' || tagName === 'TR') && target.hasAttribute('data-url')) ||
            (tagName === 'TD' && parentElement.hasAttribute('data-url'))
        ) {
            const action = target.getAttribute('data-action') || parentElement.getAttribute('data-action');
            const url = target.getAttribute('data-url') || parentElement.getAttribute('data-url');
            if (action === 'open') {
                window.open(url);
            } else if (action === 'showMinImage') {
                if (tagName === 'TD') {
                    insertMinImage(parentElement, url)
                } else {
                    insertMinImage(target, url)
                }
                setBodyWidth()
            } else if (action === 'showDayImage') {
                if (tagName === 'TD') {
                    insertDayImage(parentElement, url)
                } else {
                    insertDayImage(target, url)
                }
                setBodyWidth()
            } else {
                window.open(url);
            }
        }
    });
}

function insertMinImage(tr, url) {
    url = url || tr.getAttribute('data-url')
    // console.log(tr)
    // console.log('url', url)
    if (url) {
        const newTr = document.createElement('tr')
        newTr.innerHTML = `<td><img src="${url}" width="578px" alt=""></td>`
        tr.after(newTr)
        return true;
    } else {
        console.warn('tr 的 data-url 没有值', tr)
    }
    return false;
}

function insertDayImage(tr, url) {
    url = url || tr.getAttribute('data-url')
    // console.log(tr)
    // console.log('url', url)
    if (url) {
        const newTr = document.createElement('tr')
        newTr.innerHTML = `<td><img src="${url}" width="520px" alt="" style="margin: 0 29px"></td>`
        tr.after(newTr)
        return true;
    } else {
        console.warn('tr 的 data-url 没有值', tr)
    }
    return false;
}

function setBodyWidth(px = 600) {
    const width = px + 'px'
    if (document.body.style.width !== width) {
        document.body.style.width = width
    }
}

function get10LenTime() {
    return Date.now().toString().substring(0, 10).length;
}

function addStockPrefix(code) {
    if (!code || typeof code !== 'string') return code;
    code = code.trim().toLowerCase();

    const firstChar = code.charAt(0);

    // 优先判断北交所的新代码
    if (code.startsWith('920')) {
        return 'bj' + code;
    }

    // 深交所：0,1,2,3开头
    if ('0123'.includes(firstChar)) {
        return 'sz' + code;
    }

    // 上交所：5,6,7,9开头（科创板688也是上交所）
    if ('5679'.includes(firstChar) || code.startsWith('688')) {
        return 'sh' + code;
    }

    // 旧的北交所/新三板代码（43, 83, 87开头）
    if (firstChar === '4' || firstChar === '8' || code.startsWith('43') || code.startsWith('83') || code.startsWith('87')) {
        return 'bj' + code;
    }

    return code;
}
