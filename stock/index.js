const stockMap = {
  1: '名称',
  3: '当前价格',
  32: '涨跌%',
  37: '成交额（万）',
}
const stockDetails = {
  0: '代码全称',
  2: '代码',
  4: '昨收',
  5: '今开',
  6: '成交量（手）',
  29: '最近逐笔成交',
  30: '时间',
  31: '涨跌',
  33: '最高',
  34: '最低',
  36: '成交量（手）',
  38: '换手率',
  39: '市盈率',
  41: '最高',
  42: '最低',
  43: '振幅',
  44: '流通市值',
  45: '总市值',
  46: '市净率',
  47: '涨停价',
  48: '跌停价',
}


let initStockList = [
  {
    name: '上证指数',
    code: 'sh000001'
  },
  {
    name: '半导体ETF',
    code: 'sh512480'
  },
  {
    name: '新能源ETF',
    code: 'sh516160'
  },
  {
    name: '自由现金流ETF',
    code: 'sz159201'
  },
  {
    name: '纳斯达克ETF',
    code: 'sh513300'
  },
]
let stockCodeArr = JSON.parse(localStorage.getItem('stockCodeArr') || '[]')
if (!stockCodeArr.length) {
  stockCodeArr.push(...initStockList)
  localStorage.setItem('stockCodeArr', JSON.stringify(stockCodeArr))
}
let stockLineType = 'min'
let isShowStockDetails = false


let timer = null
let curTabCode = localStorage.getItem('curTabCode') || stockCodeArr[0].code
renderStock(curTabCode)


function renderTabs() {

  let tabs = document.getElementById('tabs')
  let tabsHTML = ''
  stockCodeArr.forEach((item, index) => {
    tabsHTML += `<button id="tabBtn${index}" 
                  data-index="${index}" 
                  class="tabBtn ${curTabCode === item.code ? 'curTab' : ''}"
                  draggable="true"  
                  >${item.name}</button>
                  `
    tabs.innerHTML = tabsHTML
    Array.from(document.getElementsByClassName('tabBtn')).forEach(d => {
      d.ondragstart = function drag(ev) {
        ev.dataTransfer.setData("index", ev.target.dataset.index)
      }
    })
  })
  tabs.ondrop = function drop(ev) {
    ev.preventDefault();
    let index = ev.dataTransfer.getData("index")
    let appendPos = ev.target.dataset.index
    if (ev.target.tagName !== 'BUTTON') {
      appendPos = stockCodeArr.length - 1
    }
    let item = stockCodeArr[index]
    stockCodeArr.splice(index, 1)
    stockCodeArr.splice(appendPos, 0, item)
    localStorage.setItem('stockCodeArr', JSON.stringify(stockCodeArr))
    renderTabs()
  }
  tabs.ondragover = function allowDrop(ev) {
    ev.preventDefault();
  }


  Array.from(tabs.getElementsByTagName('button')).forEach(d => {
    // 切换
    d.onclick = function () {
      let index = d.dataset.index
      if (!index) {
        return
      }
      let item = stockCodeArr[index]
      renderStock(item.code)
      removeClass()
      d.classList.add('curTab')
      curTabCode = stockCodeArr[index].code
      localStorage.setItem('curTabCode', curTabCode)
    }
    // 删除
    d.oncontextmenu = function (e) {
      e.preventDefault();
      let index = d.dataset.index
      if (index && confirm('确定删除?')) {
        let index = d.dataset.index
        stockCodeArr.splice(index, 1)
        console.log('stockCodeArr', stockCodeArr)
        localStorage.setItem('stockCodeArr', JSON.stringify(stockCodeArr))
        document.getElementById('tabBtn' + index).remove()
        renderTabs()
      }
    };
  })

  function removeClass() {
    Array.from(tabs.getElementsByTagName('button')).forEach(d => {
      d.classList.remove('curTab')
    })
  }
}

renderTabs()


function changeBackground() {

  let changeBGEle = document.getElementById('changebg')
  const bg = localStorage.getItem('bg') || 'light'
  changeBG(bg)


  function changeBG(bg) {
    let body = document.body
    if (typeof bg !== 'string') {
      if (body.classList.contains('dark')) {
        bg = 'light'
        localStorage.setItem('bg', 'light')
      } else {
        bg = 'dark'
        localStorage.setItem('bg', 'dark')
      }
    }
    if (bg === 'light') {
      changeBGEle.innerHTML = 'dark'
      body.classList.remove('dark')
    } else {
      changeBGEle.innerHTML = 'light'
      body.classList.add('dark')
    }
  }

  changeBGEle.onclick = changeBG
}

changeBackground()

function runCmd(code) {
  if (code === 'help') {
    alert(`copy: 复制股票数据`)
    return true
  }
  if (code === 'copy') {
    navigator.clipboard.writeText(JSON.stringify(stockCodeArr))
    return true
  }
  return false
}

function addEvent() {
  document.getElementById('add').onclick = async function () {
    let code = prompt('股票代码 (or 命令)')
    if (runCmd(code)) return
    if (!code) return
    if (code.startsWith('0') || code.startsWith('1') || code.startsWith('3')) {
      code = 'sz' + code
    }
    if (code.startsWith('5') || code.startsWith('6')) {
      code = 'sh' + code
    }
    code = code.toLowerCase()
    let stock = await getStock(code)
    let name = stock[1]
    if (!name) {
      alert('代码错误')
      return
    }
    stockCodeArr.push({ name, code, })
    localStorage.setItem('stockCodeArr', JSON.stringify(stockCodeArr))
    location.reload()
  }

  document.getElementById('details').onclick = function () {
    isShowStockDetails = true
    renderStock(curTabCode)
  }

  const stockLineArr = Array.from(document.getElementsByClassName('stockLine'))
  stockLineArr.forEach(d => {
    d.onclick = function () {
      addCurKClass(stockLineArr, this)
      if (stockLineType === this.dataset.type) {
        return
      }
      stockLineType = this.dataset.type
      renderStock(curTabCode)
    }
  })

}

addEvent()

function addCurKClass(arr, curDom) {
  arr.forEach(d => {
    d.classList.remove('curK')
  })
  curDom.classList.add('curK')
}


function getStock(stockCode) {
  return fetch('http://qt.gtimg.cn/q=' + stockCode)
    .then(res => res.arrayBuffer())
    .then(res => new TextDecoder('GBK').decode(res))
    .then(res => res.split('~'))
}

async function renderStock(stockCode) {
  // http://image.sinajs.cn/newchart/min/n/sh000001.gif
  // http://image.sinajs.cn/newchart/daily/n/sh000001.gif
  let render = () => {
    if (app.getElementsByClassName('ranking').length) {
      return
    }
    getStock(stockCode).then(res => {
      console.log(res)
      var html = `<img src="http://image.sinajs.cn/newchart/${stockLineType}/n/${stockCode}.gif" alt="" width="545" height="300"><br>`
      res.forEach((d, i) => {
        let key = stockMap[i]
        if (isShowStockDetails) {
          key = Object.assign({}, stockMap, stockDetails)[i]
        }
        if (key) {
          switch (key) {
            case '时间':
              html += key + ': ' + formatTime(d) + '<br>'
              break;
            case '涨跌%':
            case '振幅':
            case '换手率':
              html += key + ': ' + d + '%' + '<br>'
              break;
            case '当前价格':
              html += key + ': ' + d + (d === res[47] ? ' (已涨停)' : '') + '<br>'
              break;
            case '成交额（万）':
              html += '成交额（亿）' + ': ' + (+d / 10000).toFixed(2) + '<br>'
              break;
            default:
              html += key + ': ' + d + '<br>'
          }
        }
      })
      document.getElementById('app').innerHTML = html
    })
  }
  render()
  clearInterval(timer)
  const hour = new Date().getHours()
  // 开盘和收盘
  if (hour > 9 && hour < 15) {
    timer = setInterval(render, 2000)
  }
}

function getFundFlow(code) {
  // http://qt.gtimg.cn/q=ff_sz000858
  return fetch('http://qt.gtimg.cn/q=ff_' + code)
    .then(res => res.text())
    .then(res => res.split('~'))
    .then(res => {
      console.log('res', res)
    })
}

function formatTime(time) {
  time = String(time).replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, function (match, y, m, d, h, minute, s) {
    return y + '-' + m + '-' + d + ' ' + h + ':' + minute + ':' + s;
  })
  return new Date(time).toLocaleString()
}
