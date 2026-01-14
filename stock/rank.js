/**
 * 获取板块排名数据
 * http://quote.eastmoney.com/center/boardlist.html#industry_board
 */

async function plateRank(reverse) {
  let plateUrl = 'http://90.push2.eastmoney.com/api/qt/clist/get?cb=&pn=1&pz=20&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&wbp2u=|0|0|0|web&fid=f3&fs=m:90+t:2+f:!50&fields=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f13,f14,f15,f16,f17,f18,f20,f21,f23,f24,f25,f26,f22,f33,f11,f62,f128,f136,f115,f152,f124,f107,f104,f105,f140,f141,f207,f208,f209,f222&_=1660405752570'
  let plateUrlReverse = 'http://90.push2.eastmoney.com/api/qt/clist/get?cb=&pn=1&pz=20&po=0&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&wbp2u=|0|0|0|web&fid=f3&fs=m:90+t:2+f:!50&fields=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f13,f14,f15,f16,f17,f18,f20,f21,f23,f24,f25,f26,f22,f33,f11,f62,f128,f136,f115,f152,f124,f107,f104,f105,f140,f141,f207,f208,f209,f222&_=1660405752707'
  return await getRank(reverse ? plateUrlReverse : plateUrl, 'plate')
}

/**
 * 获取ETF排名数据
 * http://quote.eastmoney.com/center/gridlist.html#fund_etf
 */

async function ETFRank(reverse) {
  let plateUrl = 'http://34.push2.eastmoney.com/api/qt/clist/get?cb=&pn=1&pz=20&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&wbp2u=|0|0|0|web&fid=f3&fs=b:MK0021,b:MK0022,b:MK0023,b:MK0024&fields=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f13,f14,f15,f16,f17,f18,f20,f21,f23,f24,f25,f22,f11,f62,f128,f136,f115,f152&_=1660574054404'
  let plateUrlReverse = 'http://34.push2.eastmoney.com/api/qt/clist/get?cb=&pn=1&pz=20&po=0&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&wbp2u=|0|0|0|web&fid=f3&fs=b:MK0021,b:MK0022,b:MK0023,b:MK0024&fields=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f13,f14,f15,f16,f17,f18,f20,f21,f23,f24,f25,f22,f11,f62,f128,f136,f115,f152&_=1660574054424'
  return await getRank(reverse ? plateUrlReverse : plateUrl, 'etf')
}

function getRank(url, type) {
  return fetch(url)
    .then(res => res.json())
    .then(res => {
      console.log('res', res)
      let diff = res.data.diff
      let arr = []
      diff.forEach(d => {
        let obj = {
          名称: d.f14,
          涨跌: d.f3 + '%'
        }
        if (type === 'etf') {
          obj.代码 = d.f12
        }
        if (type === 'plate') {
          // obj.领涨股票 = d.f128
        }
        arr.push(obj)
      })
      return arr
    })
}

let isReverse = false
let rankingEle = document.getElementById('ranking')
rankingEle.onclick = async function () {
  let plateData = await plateRank(isReverse)
  let plateStr = JSON.stringify(plateData, null, 2)
  let ETFData = await ETFRank(isReverse)
  let ETFStr = JSON.stringify(ETFData, null, 2)
    rankingEle.innerText = 'ETF排名' + (isReverse ? ' ↓' : ' ↑')
  app.innerHTML = `<div class="ranking">
                      <div>板块:<br>${plateStr}</div>
                      <div>ETF:<br>${ETFStr}</div>
                    </div>`
  isReverse = !isReverse
}



