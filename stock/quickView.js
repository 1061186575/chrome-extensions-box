
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

function getStock(stockCode) {
    return fetch('http://qt.gtimg.cn/q=' + stockCode)
        .then(res => res.arrayBuffer())
        .then(res => new TextDecoder('GBK').decode(res))
        .then(res => res.split('~'))
}

function genStockText(res) {
    // http://image.sinajs.cn/newchart/min/n/sh000001.gif
    // http://image.sinajs.cn/newchart/daily/n/sh000001.gif
    console.log(res)
    let html = ``
    html += '<tr>'
    res.forEach((d, i) => {

        let key = stockMap[i]
        if (key) {
            switch (key) {
                case '涨跌%':
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
    console.log(`html`, html);
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
    const r = arr => arr.slice(0, 3).map(d => Object.values(d).map(v => `<td>${v}</td>`).join('')).map(d => `<tr>${d}</tr>`).join('')
    const str = `<tr><td>top:</td></tr> ${r(top)} <tr style="margin-top: 10px;"><td>bottom:</td></tr> ${r(bottom)}`
    document.getElementById('rankRender').innerHTML = str
}
renderRank();

document.getElementById('return').onclick = function () {
    location.href = '/index.html'
}
