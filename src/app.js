import { formatDateTime } from './utils/date.js'
import {
  addDataError,
  addDataWarning,
  buildDataStatusText,
  createInitialDataStatus,
  finalizeDataStatus,
  markFallback,
  mergeLoadedDataStatus,
} from './utils/dataStatus.js'
import { escapeHtml, renderTableState } from './utils/dom.js'
import { formatNullableNumber, toNumberStrict } from './utils/number.js'

const DATA_INDEX_URL = './data/krx/index.json'
const DATA_BASE_URL = './data/krx'
const NAVER_MARKET_URL = './data/naver-market.json'
const MARKET_INDEX_URL = './data/market-index.json'
const STOCK_META_URL = './data/stock-meta.json'
const US_STOCKS_URL = './data/us-stocks.json'
const ETF_UNIVERSE_URL = './data/etf-universe.json'
const UPDATE_STATUS_URL = './data/update-status.json'

const themeUp = [
  ['반도체 제품(전력반도체)', 10.4, [21, 24, 23, 29, 31, 38, 44]],
  ['온디바이스 AI', 8.49, [18, 20, 22, 21, 27, 32, 36]],
  ['반도체 제품(비메모리)', 8.04, [16, 18, 17, 21, 28, 31, 35]],
  ['반도체 제품(시스템반도체)', 7.87, [19, 20, 22, 24, 29, 30, 34]],
  ['HD현대그룹', 7.84, [12, 15, 17, 20, 21, 26, 31]],
  ['피팅/밸브', 7.59, [11, 13, 12, 18, 23, 25, 29]],
  ['화장품', 7.35, [14, 15, 19, 18, 22, 27, 31]],
  ['백화점', 7.0, [10, 11, 14, 15, 19, 22, 26]],
  ['ARM', 6.87, [13, 13, 16, 19, 21, 24, 28]],
  ['반도체 후공정', 6.86, [15, 16, 18, 19, 22, 23, 27]],
]

const themeDown = [
  ['양자컴퓨터', -2.87, [28, 26, 25, 24, 21, 20, 18]],
  ['블록체인', -2.36, [25, 25, 22, 21, 20, 18, 17]],
  ['6G', -2.25, [24, 23, 22, 20, 19, 18, 16]],
  ['생체인식', -1.75, [22, 21, 21, 19, 18, 17, 16]],
  ['자동차', -1.67, [30, 28, 27, 26, 25, 23, 22]],
  ['인도투자', -1.31, [20, 19, 19, 18, 17, 17, 16]],
  ['현대자동차그룹', -1.27, [23, 22, 21, 20, 20, 18, 17]],
  ['양자암호통신', -1.17, [18, 19, 17, 17, 16, 15, 14]],
  ['핀테크', -1.17, [17, 17, 16, 15, 15, 14, 13]],
  ['영원그룹', -1.08, [16, 16, 15, 15, 14, 13, 13]],
]

const hotThemes = [
  ['전고체 배터리', 4.65, [20, 22, 24, 24, 27, 29, 32]],
  ['OCI그룹', 8.79, [17, 19, 21, 23, 27, 30, 35]],
  ['마이크로 LED', 5.33, [16, 17, 19, 21, 23, 26, 29]],
  ['반도체 제품(비메모리)', 16.21, [18, 20, 24, 28, 34, 39, 45]],
  ['구글 TPU', 7.47, [15, 16, 19, 22, 26, 28, 31]],
  ['6G', -6.36, [28, 26, 24, 22, 20, 18, 16]],
  ['지주사', 4.05, [14, 15, 17, 18, 20, 22, 24]],
  ['석유화학', 2.01, [12, 13, 13, 14, 15, 16, 17]],
]

const marketCaps = [
  ['삼성전자', '005930', '468조', [23, 25, 24, 27, 28, 30, 33]],
  ['SK하이닉스', '000660', '245조', [18, 19, 24, 28, 32, 36, 41]],
  ['LG에너지솔루션', '373220', '90조', [26, 25, 24, 22, 21, 22, 23]],
  ['삼성바이오로직스', '207940', '75조', [18, 18, 19, 21, 22, 24, 25]],
  ['현대차', '005380', '56조', [20, 21, 20, 21, 23, 24, 25]],
  ['기아', '000270', '43조', [19, 19, 18, 20, 21, 21, 22]],
  ['셀트리온', '068270', '39조', [16, 18, 17, 20, 23, 22, 24]],
  ['NAVER', '035420', '35조', [20, 19, 18, 18, 17, 18, 19]],
  ['KB금융', '105560', '34조', [17, 18, 19, 20, 21, 23, 24]],
  ['한화에어로스페이스', '012450', '32조', [13, 16, 18, 24, 30, 35, 39]],
]

const fallbackMarketIndex = [
  { name: '원달러', value: '1,477.50', unit: '원', change: '-6.50', tone: 'down' },
  { name: '원엔', value: '926.88', unit: '원/100엔', change: '-2.48', tone: 'down' },
  { name: 'WTI', value: '94.4', unit: '달러', change: '-1.45', tone: 'down' },
  { name: '국제 금', value: '4,740.9', unit: '달러', change: '+16.90', tone: 'up' },
]

const usStocks = [
  { symbol: 'NVDA', name: 'NVIDIA', sector: 'AI 반도체', price: 178.35, changeRate: 2.31, marketCap: '4.35T', amount: '42.1B', popularity: 98, trend: [18, 20, 24, 31, 35, 42, 49] },
  { symbol: 'MSFT', name: 'Microsoft', sector: '클라우드', price: 509.9, changeRate: 0.82, marketCap: '3.79T', amount: '16.8B', popularity: 91, trend: [20, 21, 23, 24, 25, 28, 30] },
  { symbol: 'AAPL', name: 'Apple', sector: '소비자기술', price: 247.4, changeRate: -0.43, marketCap: '3.67T', amount: '13.9B', popularity: 87, trend: [30, 29, 28, 27, 27, 26, 25] },
  { symbol: 'AMZN', name: 'Amazon', sector: '커머스·클라우드', price: 229.2, changeRate: 1.12, marketCap: '2.44T', amount: '12.6B', popularity: 84, trend: [17, 18, 19, 22, 23, 25, 27] },
  { symbol: 'GOOGL', name: 'Alphabet', sector: '검색·AI', price: 186.7, changeRate: -0.21, marketCap: '2.27T', amount: '9.8B', popularity: 82, trend: [24, 24, 23, 22, 22, 21, 21] },
  { symbol: 'META', name: 'Meta Platforms', sector: '소셜·AI', price: 641.3, changeRate: 1.76, marketCap: '1.62T', amount: '11.4B', popularity: 80, trend: [16, 18, 20, 23, 26, 30, 34] },
  { symbol: 'TSLA', name: 'Tesla', sector: '전기차', price: 336.2, changeRate: 3.58, marketCap: '1.08T', amount: '24.2B', popularity: 96, trend: [14, 12, 18, 24, 30, 33, 41] },
  { symbol: 'AVGO', name: 'Broadcom', sector: '반도체', price: 329.8, changeRate: 1.04, marketCap: '1.55T', amount: '7.2B', popularity: 74, trend: [19, 20, 23, 25, 28, 29, 31] },
  { symbol: 'BRK.B', name: 'Berkshire Hathaway', sector: '복합지주', price: 531.1, changeRate: 0.24, marketCap: '1.15T', amount: '2.9B', popularity: 62, trend: [21, 21, 22, 23, 23, 24, 25] },
  { symbol: 'LLY', name: 'Eli Lilly', sector: '비만치료제', price: 1128.4, changeRate: 1.37, marketCap: '1.07T', amount: '5.8B', popularity: 78, trend: [19, 21, 22, 25, 28, 31, 34] },
  { symbol: 'JPM', name: 'JPMorgan Chase', sector: '은행', price: 308.4, changeRate: -0.18, marketCap: '846B', amount: '4.6B', popularity: 68, trend: [22, 23, 23, 24, 23, 23, 22] },
  { symbol: 'V', name: 'Visa', sector: '결제', price: 356.8, changeRate: 0.31, marketCap: '681B', amount: '3.1B', popularity: 66, trend: [18, 18, 19, 20, 20, 21, 22] },
  { symbol: 'MA', name: 'Mastercard', sector: '결제', price: 581.6, changeRate: 0.44, marketCap: '529B', amount: '2.2B', popularity: 61, trend: [17, 18, 18, 20, 21, 22, 23] },
  { symbol: 'NFLX', name: 'Netflix', sector: '스트리밍', price: 1156.9, changeRate: 1.91, marketCap: '492B', amount: '4.1B', popularity: 73, trend: [16, 17, 20, 23, 25, 29, 32] },
  { symbol: 'COST', name: 'Costco', sector: '소매', price: 1012.4, changeRate: 0.12, marketCap: '449B', amount: '1.8B', popularity: 58, trend: [20, 20, 21, 21, 22, 22, 23] },
  { symbol: 'ORCL', name: 'Oracle', sector: '클라우드', price: 286.2, changeRate: 2.08, marketCap: '805B', amount: '6.9B', popularity: 79, trend: [14, 16, 18, 21, 26, 31, 36] },
  { symbol: 'AMD', name: 'AMD', sector: 'AI 반도체', price: 226.1, changeRate: 2.84, marketCap: '366B', amount: '9.2B', popularity: 89, trend: [13, 14, 17, 22, 27, 33, 39] },
  { symbol: 'PLTR', name: 'Palantir', sector: 'AI 소프트웨어', price: 206.5, changeRate: 4.36, marketCap: '482B', amount: '8.7B', popularity: 95, trend: [10, 13, 17, 24, 31, 38, 46] },
  { symbol: 'CRM', name: 'Salesforce', sector: 'SaaS', price: 284.9, changeRate: -0.62, marketCap: '274B', amount: '2.7B', popularity: 55, trend: [24, 24, 23, 22, 21, 20, 20] },
  { symbol: 'COIN', name: 'Coinbase', sector: '가상자산', price: 386.8, changeRate: 3.08, marketCap: '99B', amount: '5.1B', popularity: 88, trend: [14, 13, 18, 22, 28, 32, 37] },
  { symbol: 'SMCI', name: 'Super Micro Computer', sector: 'AI 서버', price: 71.4, changeRate: 5.12, marketCap: '43B', amount: '3.8B', popularity: 86, trend: [11, 13, 14, 20, 24, 32, 41] },
  { symbol: 'MU', name: 'Micron', sector: '메모리', price: 172.2, changeRate: 1.48, marketCap: '193B', amount: '4.9B', popularity: 76, trend: [15, 16, 19, 21, 25, 27, 30] },
  { symbol: 'HOOD', name: 'Robinhood', sector: '증권 플랫폼', price: 138.7, changeRate: 2.22, marketCap: '122B', amount: '2.6B', popularity: 84, trend: [12, 14, 17, 19, 24, 28, 31] },
  { symbol: 'SHOP', name: 'Shopify', sector: '커머스 SaaS', price: 162.5, changeRate: 1.13, marketCap: '210B', amount: '2.5B', popularity: 72, trend: [15, 16, 18, 19, 21, 23, 25] },
]

let usStockUniverse = [...usStocks]

const themeStockSeeds = {
  '반도체 제품(전력반도체)': [
    ['DB하이텍', '000990', ['반도체', '시스템반도체']],
    ['티씨케이', '064760', ['반도체 장비', '태양광']],
    ['하나머티리얼즈', '166090', ['반도체 소재']],
    ['LX세미콘', '108320', ['OLED', '팹리스']],
    ['KEC', '092220', ['전기차', '반도체 부품']],
    ['에이프로', '262260', ['2차전지 장비', 'ESS']],
    ['시지트로닉스', '429270', ['시스템반도체']],
  ],
  '온디바이스 AI': [
    ['제주반도체', '080220', ['메모리', 'AI']],
    ['가온칩스', '399720', ['시스템반도체', 'ARM']],
    ['칩스앤미디어', '094360', ['팹리스', 'AI']],
    ['텔레칩스', '054450', ['차량용 반도체']],
    ['리노공업', '058470', ['반도체 후공정']],
    ['에이직랜드', '445090', ['디자인하우스']],
    ['오픈엣지테크놀로지', '394280', ['반도체 IP']],
  ],
  '반도체 제품(비메모리)': [
    ['DB하이텍', '000990', ['파운드리']],
    ['LX세미콘', '108320', ['디스플레이 반도체']],
    ['가온칩스', '399720', ['디자인하우스']],
    ['어보브반도체', '102120', ['MCU']],
    ['칩스앤미디어', '094360', ['반도체 IP']],
    ['텔레칩스', '054450', ['차량용']],
    ['에이디테크놀로지', '200710', ['디자인하우스']],
  ],
  '반도체 제품(시스템반도체)': [
    ['DB하이텍', '000990', ['파운드리']],
    ['LX세미콘', '108320', ['팹리스']],
    ['가온칩스', '399720', ['디자인하우스']],
    ['오픈엣지테크놀로지', '394280', ['반도체 IP']],
    ['칩스앤미디어', '094360', ['반도체 IP']],
    ['넥스트칩', '396270', ['차량용 반도체']],
  ],
  'HD현대그룹': [
    ['HD현대', '267250', ['지주사']],
    ['HD현대중공업', '329180', ['조선']],
    ['HD한국조선해양', '009540', ['조선']],
    ['HD현대일렉트릭', '267260', ['전력기기']],
    ['HD현대미포', '010620', ['조선']],
    ['HD현대마린엔진', '071970', ['조선 기자재']],
    ['HD현대인프라코어', '042670', ['건설기계']],
  ],
  '피팅/밸브': [
    ['성광벤드', '014620', ['조선 기자재']],
    ['태광', '023160', ['플랜트']],
    ['하이록코리아', '013030', ['밸브']],
    ['디케이락', '105740', ['피팅']],
    ['비엠티', '086670', ['피팅']],
    ['화성밸브', '039610', ['밸브']],
  ],
  '화장품': [
    ['실리콘투', '257720', ['K뷰티']],
    ['아모레퍼시픽', '090430', ['브랜드']],
    ['LG생활건강', '051900', ['브랜드']],
    ['한국콜마', '161890', ['ODM']],
    ['코스맥스', '192820', ['ODM']],
    ['브이티', '018290', ['K뷰티']],
    ['클리오', '237880', ['색조']],
    ['토니모리', '214420', ['브랜드']],
  ],
  '백화점': [
    ['현대백화점', '069960', ['유통']],
    ['신세계', '004170', ['유통']],
    ['롯데쇼핑', '023530', ['유통']],
    ['한화갤러리아', '452260', ['유통']],
  ],
  ARM: [
    ['가온칩스', '399720', ['디자인하우스']],
    ['오픈엣지테크놀로지', '394280', ['반도체 IP']],
    ['칩스앤미디어', '094360', ['반도체 IP']],
    ['넥스트칩', '396270', ['차량용 반도체']],
  ],
  '반도체 후공정': [
    ['한미반도체', '042700', ['HBM 장비']],
    ['리노공업', '058470', ['검사용 소켓']],
    ['ISC', '095340', ['테스트 소켓']],
    ['하나마이크론', '067310', ['패키징']],
    ['네패스', '033640', ['패키징']],
    ['SFA반도체', '036540', ['패키징']],
    ['테크윙', '089030', ['검사장비']],
  ],
  '양자컴퓨터': [
    ['우리로', '046970', ['양자암호']],
    ['엑스게이트', '356680', ['보안']],
    ['드림시큐리티', '203650', ['보안']],
    ['코위버', '056360', ['통신장비']],
  ],
  블록체인: [
    ['우리기술투자', '041190', ['가상자산']],
    ['한화투자증권', '003530', ['가상자산']],
    ['갤럭시아머니트리', '094480', ['전자결제']],
    ['위메이드', '112040', ['게임']],
  ],
  '6G': [
    ['오이솔루션', '138080', ['통신장비']],
    ['케이엠더블유', '032500', ['통신장비']],
    ['쏠리드', '050890', ['통신장비']],
    ['RFHIC', '218410', ['통신장비']],
  ],
  생체인식: [
    ['슈프리마', '236200', ['보안']],
    ['드림시큐리티', '203650', ['보안']],
    ['유니온커뮤니티', '203450', ['보안']],
  ],
  자동차: [
    ['현대차', '005380', ['완성차']],
    ['기아', '000270', ['완성차']],
    ['현대모비스', '012330', ['부품']],
    ['HL만도', '204320', ['부품']],
  ],
  인도투자: [
    ['미래에셋증권', '006800', ['증권']],
    ['삼성증권', '016360', ['증권']],
    ['신한지주', '055550', ['금융']],
  ],
  현대자동차그룹: [
    ['현대차', '005380', ['완성차']],
    ['기아', '000270', ['완성차']],
    ['현대모비스', '012330', ['부품']],
    ['현대글로비스', '086280', ['물류']],
    ['현대오토에버', '307950', ['소프트웨어']],
  ],
  양자암호통신: [
    ['우리로', '046970', ['통신']],
    ['코위버', '056360', ['통신장비']],
    ['드림시큐리티', '203650', ['보안']],
  ],
  핀테크: [
    ['카카오페이', '377300', ['결제']],
    ['NHN KCP', '060250', ['전자결제']],
    ['KG이니시스', '035600', ['전자결제']],
    ['갤럭시아머니트리', '094480', ['전자결제']],
  ],
  영원그룹: [
    ['영원무역', '111770', ['패션']],
    ['영원무역홀딩스', '009970', ['지주사']],
  ],
  '전고체 배터리': [
    ['삼성SDI', '006400', ['2차전지']],
    ['이수스페셜티케미컬', '457190', ['소재']],
    ['한농화성', '011500', ['소재']],
    ['씨아이에스', '222080', ['장비']],
    ['대주전자재료', '078600', ['소재']],
  ],
  OCI그룹: [
    ['OCI홀딩스', '010060', ['지주사']],
    ['OCI', '456040', ['화학']],
    ['유니드', '014830', ['화학']],
  ],
  '마이크로 LED': [
    ['서울반도체', '046890', ['LED']],
    ['루멘스', '038060', ['LED']],
    ['코세스', '089890', ['장비']],
    ['레이크머티리얼즈', '281740', ['소재']],
  ],
  '구글 TPU': [
    ['가온칩스', '399720', ['디자인하우스']],
    ['에이디테크놀로지', '200710', ['디자인하우스']],
    ['오픈엣지테크놀로지', '394280', ['반도체 IP']],
  ],
  지주사: [
    ['SK', '034730', ['지주사']],
    ['LG', '003550', ['지주사']],
    ['HD현대', '267250', ['지주사']],
    ['두산', '000150', ['지주사']],
    ['CJ', '001040', ['지주사']],
  ],
  석유화학: [
    ['LG화학', '051910', ['화학']],
    ['롯데케미칼', '011170', ['화학']],
    ['금호석유', '011780', ['화학']],
    ['한화솔루션', '009830', ['화학']],
  ],
}

const etfThemes = [
  ['AI 전력', 'PLUS 태양광&ESS', 8.49, [13, 15, 17, 21, 27, 31, 35]],
  ['조선', 'SOL 조선기자재', 7.67, [12, 14, 16, 20, 24, 28, 31]],
  ['화장품', 'HANARO K-뷰티', 5.41, [16, 17, 19, 21, 24, 27, 29]],
  ['외인수급', 'WON K-글로벌수급상위', 4.74, [14, 15, 16, 20, 21, 23, 25]],
  ['코스닥', 'TIME 코스닥액티브', 4.09, [11, 13, 14, 15, 17, 19, 21]],
]

const fallbackEtfUniverse = [
  {
    code: '379800',
    name: 'KODEX 미국S&P500TR',
    issuer: '삼성자산운용',
    category: '국내상장 미국ETF',
    themes: ['미국 대표지수', '국내상장 미국ETF'],
    price: 19845,
    changeRate: 0.84,
    amount: 38200000000,
    marketCap: 2840000000000,
    trend: [20, 21, 23, 24, 26, 29, 31],
    holdings: [
      ['Microsoft', 'MSFT', 7.1],
      ['NVIDIA', 'NVDA', 6.8],
      ['Apple', 'AAPL', 6.2],
      ['Amazon', 'AMZN', 3.9],
      ['Meta Platforms', 'META', 2.8],
    ],
  },
  {
    code: '133690',
    name: 'TIGER 미국나스닥100',
    issuer: '미래에셋자산운용',
    category: '국내상장 미국ETF',
    themes: ['미국 대표지수', '국내상장 미국ETF', 'AI 반도체'],
    price: 148230,
    changeRate: 1.16,
    amount: 64100000000,
    marketCap: 3980000000000,
    trend: [19, 22, 24, 27, 31, 35, 38],
    holdings: [
      ['NVIDIA', 'NVDA', 8.9],
      ['Microsoft', 'MSFT', 8.1],
      ['Apple', 'AAPL', 7.4],
      ['Amazon', 'AMZN', 5.2],
      ['Broadcom', 'AVGO', 4.7],
    ],
  },
  {
    code: '381180',
    name: 'TIGER 미국필라델피아반도체나스닥',
    issuer: '미래에셋자산운용',
    category: '국내상장 미국ETF',
    themes: ['AI 반도체', '국내상장 미국ETF'],
    price: 24210,
    changeRate: 2.42,
    amount: 51800000000,
    marketCap: 2160000000000,
    trend: [14, 16, 21, 23, 28, 33, 39],
    holdings: [
      ['NVIDIA', 'NVDA', 10.8],
      ['Broadcom', 'AVGO', 8.5],
      ['AMD', 'AMD', 6.7],
      ['Applied Materials', 'AMAT', 5.8],
      ['Micron', 'MU', 4.9],
    ],
  },
  {
    code: '069500',
    name: 'KODEX 200',
    issuer: '삼성자산운용',
    category: '국내 대표지수',
    themes: ['코스닥', '국내 대표지수'],
    price: 42780,
    changeRate: -0.18,
    amount: 92800000000,
    marketCap: 5640000000000,
    trend: [22, 22, 23, 22, 21, 22, 21],
    holdings: [
      ['삼성전자', '005930', 25.6],
      ['SK하이닉스', '000660', 10.9],
      ['현대차', '005380', 2.7],
      ['기아', '000270', 2.1],
      ['KB금융', '105560', 1.9],
    ],
  },
  {
    code: '466920',
    name: 'SOL 조선TOP3플러스',
    issuer: '신한자산운용',
    category: '국내 테마',
    themes: ['조선', '조선 기자재'],
    price: 18460,
    changeRate: 3.24,
    amount: 28400000000,
    marketCap: 428000000000,
    trend: [12, 13, 17, 21, 25, 31, 36],
    holdings: [
      ['HD현대중공업', '329180', 24.2],
      ['한화오션', '042660', 21.4],
      ['삼성중공업', '010140', 18.7],
      ['HD한국조선해양', '009540', 12.8],
      ['HD현대마린엔진', '071970', 7.6],
    ],
  },
  {
    code: '475300',
    name: 'SOL 반도체후공정',
    issuer: '신한자산운용',
    category: '국내 테마',
    themes: ['반도체 후공정', 'AI 반도체'],
    price: 15620,
    changeRate: 4.07,
    amount: 19400000000,
    marketCap: 286000000000,
    trend: [13, 13, 16, 20, 26, 32, 37],
    holdings: [
      ['한미반도체', '042700', 19.8],
      ['리노공업', '058470', 12.1],
      ['ISC', '095340', 9.4],
      ['티씨케이', '064760', 8.2],
      ['하나마이크론', '067310', 6.8],
    ],
  },
  {
    code: '491010',
    name: 'PLUS 태양광&ESS',
    issuer: '한화자산운용',
    category: '국내 테마',
    themes: ['AI 전력', '전력 인프라'],
    price: 13240,
    changeRate: 8.49,
    amount: 33700000000,
    marketCap: 312000000000,
    trend: [13, 15, 17, 21, 27, 31, 35],
    holdings: [
      ['HD현대일렉트릭', '267260', 18.6],
      ['LS ELECTRIC', '010120', 15.2],
      ['효성중공업', '298040', 12.8],
      ['일진전기', '103590', 8.4],
      ['LS', '006260', 7.9],
    ],
  },
  {
    code: '469070',
    name: 'KODEX AI전력핵심설비',
    issuer: '삼성자산운용',
    category: '국내 테마',
    themes: ['AI 전력', '전력 인프라'],
    price: 17680,
    changeRate: 6.11,
    amount: 21900000000,
    marketCap: 374000000000,
    trend: [12, 14, 16, 19, 25, 29, 33],
    holdings: [
      ['LS ELECTRIC', '010120', 16.9],
      ['HD현대일렉트릭', '267260', 16.1],
      ['효성중공업', '298040', 14.4],
      ['대한전선', '001440', 8.2],
      ['가온전선', '000500', 6.7],
    ],
  },
  {
    code: '463250',
    name: 'HANARO K-뷰티',
    issuer: 'NH아문디자산운용',
    category: '국내 테마',
    themes: ['화장품'],
    price: 11930,
    changeRate: 5.41,
    amount: 16800000000,
    marketCap: 241000000000,
    trend: [16, 17, 19, 21, 24, 27, 29],
    holdings: [
      ['아모레퍼시픽', '090430', 19.4],
      ['LG생활건강', '051900', 15.1],
      ['한국콜마', '161890', 9.8],
      ['코스맥스', '192820', 8.9],
      ['실리콘투', '257720', 7.4],
    ],
  },
]

let etfUniverse = [...fallbackEtfUniverse]

const dataSourceDefaults = {
  krx: { label: 'KRX 연기금', state: 'loading', detail: 'index.json 확인 중' },
  stockMeta: { label: '종목 메타', state: 'loading', detail: '시가총액과 차트 보강 데이터 확인 중' },
  naverMarket: { label: 'Naver 마켓', state: 'loading', detail: '테마/검색/거래대금 랭킹 확인 중' },
  marketIndex: { label: '시장지표', state: 'loading', detail: '환율/원자재 지표 확인 중' },
  updateStatus: { label: '자동갱신', state: 'loading', detail: '최근 자동갱신 결과 확인 중' },
  usStocks: { label: '미국 주식', state: 'loading', detail: '미국 종목 가격 흐름 확인 중' },
  etfs: { label: 'ETF', state: 'loading', detail: 'ETF 목록과 구성종목 확인 중' },
}

const dataStateLabels = {
  loading: '확인 중',
  live: '실데이터',
  fallback: '백업 데이터',
  sample: '샘플 데이터',
  warning: '주의',
  error: '오류',
}

const state = {
  view: 'stock',
  rows: [],
  filteredRows: [],
  rowsByDate: new Map(),
  dates: [],
  currentDate: null,
  stockMeta: new Map(),
  naverMarket: null,
  marketIndex: fallbackMarketIndex,
  stockCountry: 'kr',
  krStockSection: 'market',
  usStockSection: 'market',
  pensionSection: 'trend',
  selectedTheme: themeUp[0][0],
  selectedUsTheme: null,
  chartPeriod: 5,
  marketQuery: '',
  sortKey: 'netBuy',
  query: '',
  visibleLimit: 20,
  etfVisibleLimit: 20,
  etfSection: 'theme',
  etfQuery: '',
  etfTheme: etfThemes[0][0],
  selectedEtfCode: etfUniverse[0].code,
  selectedHolding: null,
  meta: null,
  dataSources: Object.fromEntries(Object.entries(dataSourceDefaults).map(([key, value]) => [key, { ...value }])),
}

let currentDataStatus = createInitialDataStatus()
let appDataStatus = currentDataStatus

function splitCsvLine(line) {
  const cells = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        cell += '"'
        index += 1
      } else {
        quoted = !quoted
      }
      continue
    }

    if (char === ',' && !quoted) {
      cells.push(cell.trim())
      cell = ''
      continue
    }

    cell += char
  }

  cells.push(cell.trim())
  return cells
}

function toNumber(value) {
  return toNumberStrict(value) ?? 0
}

function normalizeInvestorLabel(value) {
  const text = String(value ?? '').trim()
  if (text === '연기금 등' || text === '연기금등') return '연기금'
  return text
}

function marketCapToNumber(value) {
  const text = String(value ?? '').trim()
  const number = Number(text.replace(/[^0-9.]/g, '')) || 0
  if (text.includes('조')) return number * 1_000_000_000_000
  if (text.includes('억')) return number * 100_000_000
  return number
}

function parseKrxCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean)
  const headers = splitCsvLine(lines[0] ?? '').map((header) => header.replace(/^\uFEFF/, ''))

  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line)
    const row = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']))
    const buyAmount = toNumber(row['매수거래대금'])
    const sellAmount = toNumber(row['매도거래대금'])
    const grossAmount = buyAmount + sellAmount

    return {
      date: row['날짜'],
      market: row['시장'],
      investor: normalizeInvestorLabel(row['투자자']),
      ticker: row['티커'],
      name: row['종목명'],
      sellVolume: toNumber(row['매도거래량']),
      buyVolume: toNumber(row['매수거래량']),
      netVolume: toNumber(row['순매수거래량']),
      sellAmount,
      buyAmount,
      netAmount: toNumber(row['순매수거래대금']),
      buyPressure: grossAmount === 0 ? 0 : Math.round((buyAmount / grossAmount) * 1000) / 10,
    }
  }).filter((row) => row.date && row.ticker && row.name)
}

function formatMoney(value) {
  const absolute = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (absolute >= 1_000_000_000_000) return `${sign}${(absolute / 1_000_000_000_000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}조`
  if (absolute >= 100_000_000) return `${sign}${(absolute / 100_000_000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}억`
  if (absolute >= 10_000) return `${sign}${Math.round(absolute / 10_000).toLocaleString('ko-KR')}만`
  return `${sign}${absolute.toLocaleString('ko-KR')}`
}

function formatMarketCap(value) {
  if (!value) return '-'
  if (value >= 1_000_000_000_000) return `${Math.round(value / 1_000_000_000_000).toLocaleString('ko-KR')}조`
  if (value >= 100_000_000) return `${Math.round(value / 100_000_000).toLocaleString('ko-KR')}억`
  return formatMoney(value)
}

function formatNumber(value) {
  return formatNullableNumber(value)
}

function formatShareVolume(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number === 0) return '-'
  if (Math.abs(number) >= 100_000_000) {
    return `${(number / 100_000_000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}억주`
  }
  if (Math.abs(number) >= 10_000) {
    return `${(number / 10_000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}만주`
  }
  return `${Math.round(number).toLocaleString('ko-KR')}주`
}

function formatPercentRatio(value) {
  if (value === null || value === undefined) return '-'
  return `${(value * 100).toFixed(3)}%`
}

function formatSignedPercent(value) {
  if (value === null || value === undefined || value === '') return '-'
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  const sign = number > 0 ? '+' : ''
  return `${sign}${number.toFixed(2)}%`
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function compareNullableDesc(a, b) {
  const left = finiteNumber(a)
  const right = finiteNumber(b)
  if (left === null && right === null) return 0
  if (left === null) return 1
  if (right === null) return -1
  return right - left
}

function compareNullableAsc(a, b) {
  const left = finiteNumber(a)
  const right = finiteNumber(b)
  if (left === null && right === null) return 0
  if (left === null) return 1
  if (right === null) return -1
  return left - right
}

function toneForValue(value, fallback = 'neutral') {
  const number = finiteNumber(value)
  if (number === null) return fallback
  if (number > 0) return 'up'
  if (number < 0) return 'down'
  return 'neutral'
}

function formatPrice(value) {
  if (!value) return '-'
  return `${Number(value).toLocaleString('ko-KR')}원`
}

function formatSignedPrice(value) {
  if (value === null || value === undefined || value === '') return '-'
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  const sign = number > 0 ? '+' : ''
  return `${sign}${number.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}원`
}

function formatDateId(value) {
  const text = String(value ?? '').trim()
  const match = text.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (!match) return text || '-'
  return `${match[1]}.${match[2]}.${match[3]}`
}

function latestTimestamp(values) {
  const timestamps = values
    .filter(Boolean)
    .map((value) => Date.parse(value))
    .filter(Number.isFinite)
  if (timestamps.length === 0) return null
  return new Date(Math.max(...timestamps)).toISOString()
}

function withCacheBust(url) {
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}ts=${Date.now()}`
}

function getDataFreshnessStatus(generatedAt) {
  if (!generatedAt) {
    return {
      status: 'fallback',
      label: '갱신시각 없음',
    }
  }

  const generatedTime = new Date(generatedAt).getTime()
  if (Number.isNaN(generatedTime)) {
    return {
      status: 'fallback',
      label: '갱신시각 오류',
    }
  }

  const ageHours = (Date.now() - generatedTime) / 1000 / 60 / 60

  if (ageHours <= 48) {
    return {
      status: 'ok',
      label: '정상',
    }
  }

  if (ageHours <= 72) {
    return {
      status: 'stale',
      label: '지연',
    }
  }

  return {
    status: 'error',
    label: '오래됨',
  }
}

function setDataSource(key, patch) {
  state.dataSources[key] = { ...state.dataSources[key], ...patch }
  renderDataStatus()
}

function recordDataFallback(source, error) {
  const message = error?.message ?? String(error ?? 'unknown error')
  addDataError(currentDataStatus, source, error)
  markFallback(currentDataStatus, source, message)
}

function recordDataError(source, error) {
  addDataError(currentDataStatus, source, error)
}

function recordDataWarning(source, warning) {
  addDataWarning(currentDataStatus, source, warning)
}

function isAdminModeFromUrl() {
  const params = new URLSearchParams(window.location.search)

  if (params.get('admin') === '1') {
    localStorage.setItem('myfmlvAdmin', '1')
    return true
  }

  if (params.get('admin') === '0') {
    localStorage.removeItem('myfmlvAdmin')
    return false
  }

  return localStorage.getItem('myfmlvAdmin') === '1'
}

function initAdminDataStatusToggle() {
  const toggle = document.getElementById('adminDataStatusToggle')
  const panel = document.getElementById('adminDataStatusPanel')

  if (!toggle || !panel) return

  const isAdmin = isAdminModeFromUrl()

  if (!isAdmin) {
    toggle.hidden = true
    panel.hidden = true
    toggle.setAttribute('aria-expanded', 'false')
    return
  }

  toggle.hidden = false

  if (toggle.dataset.bound !== 'true') {
    toggle.addEventListener('click', () => {
      const nextOpen = panel.hidden
      panel.hidden = !nextOpen
      toggle.setAttribute('aria-expanded', String(nextOpen))
    })
    toggle.dataset.bound = 'true'
  }
}

function marketIndexUpdatedAt(marketIndex) {
  if (!Array.isArray(marketIndex)) return null
  return latestTimestamp(marketIndex.map((item) => item.updatedAt))
}

function aggregateFreshnessStatus(values) {
  const statuses = values.map(getDataFreshnessStatus)
  if (statuses.some((item) => item.status === 'error')) return { status: 'error', label: '오래됨' }
  if (statuses.some((item) => item.status === 'stale')) return { status: 'stale', label: '지연' }
  if (statuses.some((item) => item.status === 'fallback')) return { status: 'fallback', label: '일부 갱신시각 없음' }
  return { status: 'ok', label: '정상' }
}

function renderDataSourceList(sources) {
  const sourceList = document.querySelector('#dataSourceList')
  if (!sourceList) return

  sourceList.innerHTML = sources.map((source) => `
    <div class="data-source" data-state="${escapeHtml(source.state)}">
      <dt>${escapeHtml(source.label)}</dt>
      <dd>
        <strong>${escapeHtml(dataStateLabels[source.state] ?? source.state)}</strong>
        <span>${escapeHtml(source.detail ?? '')}</span>
      </dd>
    </div>
  `).join('')
}

function updateDataStatusPanel(status = currentDataStatus) {
  const panel = document.getElementById('adminDataStatusPanel')
  const main = document.getElementById('dataStatusMain')
  const meta = document.getElementById('dataStatusMeta')
  const debug = document.getElementById('dataStatusDebug')

  if (!panel || !main || !meta) {
    console.warn('[data-status] status panel elements not found')
    return
  }

  const text = buildDataStatusText(status)

  panel.dataset.status = text.level || 'unknown'
  panel.dataset.state = text.level || 'unknown'
  main.textContent = text.title
  meta.textContent = text.detail

  if (debug) {
    debug.textContent = JSON.stringify({
      status,
      sources: state.dataSources,
    }, null, 2)
  }

  renderDataSourceList(Object.values(state.dataSources))
}

function renderDataStatus() {
  finalizeDataStatus(currentDataStatus, {
    krxIndex: state.meta,
    naverMarket: state.naverMarket,
    marketIndex: state.marketIndex,
  })
  updateDataStatusPanel(currentDataStatus)
}

function formatUsd(value) {
  if (!value) return '-'
  return `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

function formatUsdCompact(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number === 0) return '-'
  if (number >= 1_000_000_000_000) return `$${(number / 1_000_000_000_000).toLocaleString('en-US', { maximumFractionDigits: 1 })}T`
  if (number >= 1_000_000_000) return `$${(number / 1_000_000_000).toLocaleString('en-US', { maximumFractionDigits: 1 })}B`
  if (number >= 1_000_000) return `$${(number / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 1 })}M`
  return `$${Math.round(number).toLocaleString('en-US')}`
}

function parseAbbrevValue(value) {
  const text = String(value ?? '').trim().toUpperCase()
  const number = Number.parseFloat(text.replace(/[^0-9.-]/g, '')) || 0
  if (text.endsWith('T')) return number * 1_000_000_000_000
  if (text.endsWith('B')) return number * 1_000_000_000
  if (text.endsWith('M')) return number * 1_000_000
  return number
}

function chartValues(values) {
  const source = (Array.isArray(values) ? values : []).map(Number).filter(Number.isFinite)
  if (currentPeriod() === 1) return source
  return seriesWindow(values, { includeBaseline: state.chartPeriod > 1 })
}

function currentPeriod() {
  return Math.max(1, Number(state.chartPeriod) || 1)
}

function seriesWindow(values, { forReturn = false, includeBaseline = false, strict = false } = {}) {
  const source = (Array.isArray(values) ? values : []).map(Number).filter(Number.isFinite)
  const period = currentPeriod()
  if (period === 1) return source.slice(-2)
  const windowSize = (forReturn || includeBaseline) ? period + 1 : period
  const minimumWindowSize = forReturn ? period : windowSize
  if (strict && source.length < minimumWindowSize) return []
  if (source.length > windowSize) return source.slice(-windowSize)
  return source
}

function seriesChangeRate(values, options = {}) {
  const source = seriesWindow(values, { forReturn: true, strict: true, ...options })
  if (source.length < 2) return null
  const first = source[0]
  const last = source.at(-1)
  if (!Number.isFinite(first) || !Number.isFinite(last) || first === 0) return null
  return Math.round((((last - first) / first) * 100) * 100) / 100
}

function officialDailyChangeRate(item) {
  return finiteNumber(item?.changeRate)
}

function numericHistoryValues(entries) {
  return (Array.isArray(entries) ? entries : [])
    .map((entry) => Array.isArray(entry) ? Number(entry[1]) : Number(entry))
    .filter(Number.isFinite)
}

function periodAmount(item) {
  const fallback = finiteNumber(item?.amount)
  if (currentPeriod() === 1 && fallback !== null) return fallback

  const values = numericHistoryValues(item?.amountHistory).slice(-currentPeriod())
  if (values.length === 0) return fallback ?? 0
  if (fallback !== null) values[values.length - 1] = fallback
  return Math.round(values.reduce((sum, value) => sum + value, 0))
}

function sparkline(values, tone = 'neutral') {
  const chartData = chartValues(values)
  if (chartData.length < 2) return '<span class="spark-placeholder">-</span>'
  const width = 84
  const height = 30
  const min = Math.min(...chartData)
  const max = Math.max(...chartData)
  const range = max - min || 1
  const points = chartData.map((value, index) => {
    const x = (index / Math.max(chartData.length - 1, 1)) * width
    const y = height - ((value - min) / range) * (height - 5) - 2.5
    return [x, y]
  })
  const line = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const area = `${line} L${width} ${height} L0 ${height} Z`
  return `<svg class="spark ${tone}" viewBox="0 0 ${width} ${height}" aria-hidden="true"><path class="area" d="${area}" fill="currentColor"></path><path class="line" d="${line}"></path></svg>`
}

function seedTrend(seed, tone = 'up') {
  const base = [...String(seed)].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return Array.from({ length: 7 }, (_, index) => {
    const wave = ((base + index * 13) % 11) - 5
    const slope = tone === 'down' ? -index * 2 : index * 2
    return 30 + slope + wave
  })
}

function normalizeLoadedEtf(item) {
  const changeRate = Number(item.changeRate) || 0
  const trend = Array.isArray(item.trend) && item.trend.length > 0
    ? item.trend.map(Number).filter(Number.isFinite)
    : (Array.isArray(item.priceHistory) ? item.priceHistory.map((entry) => Number(entry[1])).filter(Number.isFinite) : [])
  const dayTrend = Array.isArray(item.dayTrend)
    ? item.dayTrend.map(Number).filter(Number.isFinite)
    : []
  const price = Number(item.price) || trend.at(-1) || 0

  return {
    code: String(item.code ?? ''),
    name: String(item.name ?? ''),
    issuer: String(item.issuer ?? '운용사 미확인'),
    category: String(item.category ?? 'ETF'),
    themes: Array.isArray(item.themes) ? item.themes.map(String) : [],
    price,
    changeRate,
    amount: Number(item.amount) || 0,
    marketCap: Number(item.marketCap) || 0,
    etfType: String(item.etfType ?? ''),
    trend: trend.length > 0 ? trend : [price].filter(Boolean),
    dayTrend,
    priceHistory: Array.isArray(item.priceHistory) ? item.priceHistory : [],
    amountHistory: Array.isArray(item.amountHistory) ? item.amountHistory : [],
    latestCandle: item.latestCandle ?? null,
    holdings: Array.isArray(item.holdings)
      ? item.holdings.map(([name, ticker, ratio]) => [String(name ?? ''), String(ticker ?? ''), Number(ratio) || 0]).filter(([name]) => name)
      : [],
    source: String(item.source ?? '로컬 ETF 데이터'),
  }
}

function etfTrend(item) {
  if (state.chartPeriod === 1 && Array.isArray(item.dayTrend) && item.dayTrend.length >= 2) {
    return item.dayTrend
  }

  if (state.chartPeriod === 1) return numericHistoryValues(item?.priceHistory).slice(-2)
  return item.trend
}

function etfChangeRate(item) {
  if (state.chartPeriod === 1) return officialDailyChangeRate(item)
  return seriesChangeRate(etfTrend(item))
}

function etfPeriodAmount(item) {
  return periodAmount(item)
}

function historyValues(item) {
  return numericHistoryValues(item?.priceHistory)
}

function stockTrend(item) {
  if (state.chartPeriod === 1 && Array.isArray(item?.dayTrend) && item.dayTrend.length >= 2) {
    return item.dayTrend.map(Number).filter(Number.isFinite)
  }

  const history = historyValues(item)
  if (state.chartPeriod === 1) return history.slice(-2)
  if (history.length > 0) return history
  if (Array.isArray(item?.trend) && item.trend.length > 0) return item.trend
  return []
}

function stockPeriodChangeRate(item) {
  if (state.chartPeriod === 1) return officialDailyChangeRate(item)
  return seriesChangeRate(stockTrend(item))
}

function indexedSeries(values, targetLength = 60) {
  const source = values
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0)
    .slice(-targetLength)
  const first = source[0]
  if (!first || source.length < 2) return []
  return source.map((value) => Math.round((value / first) * 10000) / 100)
}

function averageAlignedSeries(seriesList, targetLength = 60) {
  const normalized = seriesList
    .map((series) => indexedSeries(series, targetLength))
    .filter((series) => series.length >= 2)
  const maxLength = Math.max(0, ...normalized.map((series) => series.length))
  if (maxLength < 2) return []

  return Array.from({ length: maxLength }, (_, index) => {
    const offset = maxLength - index
    const values = normalized
      .map((series) => series[series.length - offset])
      .filter(Number.isFinite)
    if (values.length === 0) return null
    return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100
  }).filter(Number.isFinite)
}

function aggregateStockTrend(items) {
  return averageAlignedSeries(items.map((item) => historyValues(item)), 61)
}

function marketTrend(market) {
  return aggregateStockTrend(stockMetaItems().filter((item) => item.market === market))
}

function themeTrend(stocks, fallback = []) {
  const trend = aggregateStockTrend(stocks)
  if (trend.length >= 2) return trend
  return Array.isArray(fallback) ? fallback : []
}

function themeChangeRate(stocks, fallback = []) {
  return seriesChangeRate(themeTrend(stocks, fallback))
}

function stockChangeAmount(item) {
  if (state.chartPeriod === 1) {
    const history = historyValues(item)
    if (history.length >= 2) return Math.round((history.at(-1) - history.at(-2)) * 100) / 100
  }

  const values = seriesWindow(stockTrend(item), { forReturn: true, strict: true })
  if (values.length >= 2) return Math.round((values.at(-1) - values[0]) * 100) / 100
  return null
}

function marketSearchScore(item, query) {
  const name = String(item.name ?? '').toLowerCase()
  const ticker = String(item.ticker ?? '')
  if (ticker === query || name === query) return 0
  if (ticker.startsWith(query) || name.startsWith(query)) return 1
  return 2
}

function normalizeLoadedUsStock(item) {
  const history = Array.isArray(item.priceHistory) ? item.priceHistory : []
  const historyPrices = historyValues(item)
  const changeRate = Number(item.changeRate) || 0
  return {
    ...item,
    symbol: String(item.symbol ?? ''),
    naverCode: String(item.naverCode ?? item.symbol ?? ''),
    name: String(item.name ?? item.symbol ?? ''),
    sector: String(item.sector ?? ''),
    price: Number(item.price) || historyPrices.at(-1) || 0,
    changeRate,
    amount: String(item.amount ?? '0'),
    marketCap: String(item.marketCap ?? '0'),
    popularity: Number(item.popularity) || 0,
    priceHistory: history,
    dayTrend: Array.isArray(item.dayTrend) ? item.dayTrend.map(Number).filter(Number.isFinite) : [],
    latestCandle: item.latestCandle ?? null,
    trend: historyPrices.length > 0 ? historyPrices : (Array.isArray(item.trend) ? item.trend : []),
  }
}

function usStockLookup(symbol, naverCode) {
  const normalizedSymbol = String(symbol ?? '').toUpperCase()
  const normalizedCode = String(naverCode ?? '').toUpperCase()
  return usStockUniverse.find((item) => (
    String(item.symbol ?? '').toUpperCase() === normalizedSymbol
    || String(item.naverCode ?? '').toUpperCase() === normalizedCode
  )) ?? null
}

function enrichUsRankItem(item) {
  const local = usStockLookup(item.symbol, item.naverCode)
  if (!local) return item
  return {
    ...item,
    priceHistory: local.priceHistory?.length ? local.priceHistory : item.priceHistory,
    dayTrend: local.dayTrend?.length ? local.dayTrend : item.dayTrend,
    latestCandle: local.latestCandle ?? item.latestCandle,
    trend: local.trend?.length ? local.trend : item.trend,
  }
}

function builtinStockMeta() {
  return new Map(marketCaps.map(([name, ticker, cap]) => [ticker, {
    ticker,
    name,
    marketCap: marketCapToNumber(cap),
    marketCapLabel: cap,
  }]))
}

function countStreak(ticker, direction) {
  let streak = 0
  const startIndex = Math.max(state.dates.indexOf(state.currentDate), 0)

  for (const date of state.dates.slice(startIndex)) {
    const row = state.rowsByDate.get(date)?.get(ticker)
    if (!row) break
    const matched = direction === 'buy' ? row.netAmount > 0 : row.netAmount < 0
    if (!matched) break
    streak += 1
  }

  return streak
}

function enrichRows(rows) {
  return rows.map((row) => {
    const meta = state.stockMeta.get(row.ticker)
    const marketCap = meta?.marketCap ?? null
    const buyToMarketCap = marketCap && row.buyAmount > 0 ? row.buyAmount / marketCap : null

    return {
      ...row,
      marketCap,
      marketCapLabel: meta?.marketCapLabel ?? formatMarketCap(marketCap),
      buyToMarketCap,
      buyStreak: row.netAmount > 0 ? countStreak(row.ticker, 'buy') : 0,
      sellStreak: row.netAmount < 0 ? countStreak(row.ticker, 'sell') : 0,
      priceHistory: meta?.priceHistory ?? [],
      dayTrend: meta?.dayTrend ?? [],
      changeRate: meta?.changeRate ?? 0,
    }
  })
}

function pensionPeriodDates() {
  const period = Math.max(1, Number(state.chartPeriod) || 1)
  const startIndex = Math.max(state.dates.indexOf(state.currentDate), 0)
  return state.dates.slice(startIndex, startIndex + period)
}

function aggregatePensionRowsForPeriod() {
  const grouped = new Map()

  pensionPeriodDates().forEach((date) => {
    const rows = state.rowsByDate.get(date)
    if (!rows) return

    rows.forEach((row) => {
      const current = grouped.get(row.ticker) ?? {
        ...row,
        date: state.currentDate,
        sellVolume: 0,
        buyVolume: 0,
        netVolume: 0,
        sellAmount: 0,
        buyAmount: 0,
        netAmount: 0,
        buyPressure: 0,
      }

      current.sellVolume += row.sellVolume
      current.buyVolume += row.buyVolume
      current.netVolume += row.netVolume
      current.sellAmount += row.sellAmount
      current.buyAmount += row.buyAmount
      current.netAmount += row.netAmount
      grouped.set(row.ticker, current)
    })
  })

  return enrichRows([...grouped.values()].map((row) => {
    const grossAmount = row.buyAmount + row.sellAmount
    return {
      ...row,
      buyPressure: grossAmount === 0 ? 0 : Math.round((row.buyAmount / grossAmount) * 1000) / 10,
    }
  }))
}

function activePensionRows() {
  return aggregatePensionRowsForPeriod()
}

function themePeriodAmount(stocks) {
  return stocks.reduce((sum, stock) => sum + periodAmount(stock), 0)
}

function themePeriodCounts(stocks) {
  return stocks.reduce((counts, stock) => {
    const rate = stockPeriodChangeRate(stock)
    if (rate > 0) counts.rise += 1
    if (rate < 0) counts.fall += 1
    if (rate === 0) counts.steady += 1
    return counts
  }, { rise: 0, fall: 0, steady: 0 })
}

function staticItems(items, tone = 'up', formatter = (value) => `${value}%`, sortDirection = 'desc') {
  return items.map(([name, value, trend]) => {
    const stocks = themeStocks(name)
    const computedTrend = themeTrend(stocks, trend)
    const computedRate = seriesChangeRate(computedTrend)
    const displayRate = computedRate ?? (state.chartPeriod === 1 ? value : null)
    return {
      name,
      sub: `${themeStockSeeds[name]?.length ?? 0}종목`,
      value: displayRate === null ? '-' : formatter(displayRate),
      tone: toneForValue(displayRate, tone),
      trend: computedTrend,
      action: 'theme-detail',
      actionValue: name,
      sortValue: displayRate,
    }
  })
    .sort((a, b) => sortDirection === 'asc' ? compareNullableAsc(a.sortValue, b.sortValue) : compareNullableDesc(a.sortValue, b.sortValue))
    .map((item, index) => ({ ...item, rank: index + 1 }))
}

function themeRankItem(item, valueMode = 'rate') {
  const stocks = Array.isArray(item.stocks) && item.stocks.length > 0
    ? item.stocks.map(enrichNaverDomesticItem)
    : themeStocks(item.name)
  const trend = themeTrend(stocks)
  const rate = themeChangeRate(stocks) ?? (state.chartPeriod === 1 ? finiteNumber(item.changeRate) : null)
  const amount = themePeriodAmount(stocks) || Number(item.amount) || 0
  const counts = themePeriodCounts(stocks)
  const value = valueMode === 'amount'
    ? formatMoney(amount)
    : formatSignedPercent(rate)
  return {
    name: item.name,
    rate,
    amount,
    sub: `${formatNumber(Number(item.totalCount) || stocks.length)}종목 · 상승 ${formatNumber(counts.rise)} · 하락 ${formatNumber(counts.fall)}`,
    value,
    tone: toneForValue(rate, 'neutral'),
    trend,
    action: 'theme-detail',
    actionValue: item.name,
    sortValue: valueMode === 'amount' ? amount : rate,
  }
}

function rankThemeItems(items, sortDirection = 'desc') {
  return items
    .sort((a, b) => sortDirection === 'asc' ? compareNullableAsc(a.sortValue, b.sortValue) : compareNullableDesc(a.sortValue, b.sortValue))
    .map((item, index) => ({ ...item, rank: index + 1 }))
}

function themeRankItems(items, valueMode = 'rate', sortDirection = 'desc') {
  return rankThemeItems(items.map((item) => themeRankItem(item, valueMode)), sortDirection)
}

function periodThemeRankItems(predicate, valueMode = 'rate', sortDirection = 'desc') {
  return rankThemeItems(
    naverThemeUniverse()
      .map((item) => themeRankItem(item, valueMode))
      .filter(predicate),
    sortDirection,
  )
}

function themeStocks(themeName) {
  const naverStocks = naverThemeStocks(themeName)
  if (naverStocks.length > 0) {
    return naverStocks.map((item) => ({
      ...item,
      tags: [item.market ?? 'KRX'],
      marketCapLabel: item.marketCapLabel ?? formatMarketCap(item.marketCap),
      trend: stockTrend(item),
    }))
  }

  const seeds = themeStockSeeds[themeName] ?? []
  if (seeds.length > 0) {
    return seeds.map(([name, ticker, tags]) => {
      const meta = state.stockMeta.get(ticker) ?? {}
      return {
        name: meta.name ?? name,
        ticker,
        tags,
        market: meta.market ?? 'KRX',
        price: meta.price ?? null,
        changeRate: meta.changeRate ?? 0,
        marketCap: meta.marketCap ?? null,
        marketCapLabel: meta.marketCapLabel ?? formatMarketCap(meta.marketCap),
        amount: meta.amount ?? 0,
        priceHistory: meta.priceHistory ?? [],
        amountHistory: meta.amountHistory ?? [],
        dayTrend: meta.dayTrend ?? [],
        trend: stockTrend({ ticker, ...meta }),
      }
    })
  }

  return stockMetaItems()
    .filter((item) => item.name && item.ticker)
    .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))
    .slice(0, 8)
    .map((item) => ({
      ...item,
      tags: [item.market ?? 'KRX'],
      marketCapLabel: item.marketCapLabel ?? formatMarketCap(item.marketCap),
      trend: stockTrend(item),
    }))
}

function stockMetaItems() {
  return [...state.stockMeta.entries()].map(([ticker, meta]) => ({ ticker, ...meta }))
}

function enrichNaverDomesticItem(item) {
  const ticker = String(item.ticker ?? '').padStart(6, '0')
  const meta = state.stockMeta.get(ticker) ?? {}
  return {
    ...item,
    ticker,
    name: item.name || meta.name || ticker,
    market: item.market || meta.market || 'KRX',
    price: Number(item.price) || Number(meta.price) || null,
    changeRate: Number(item.changeRate) || Number(meta.changeRate) || 0,
    amount: Number(item.amount) || Number(meta.amount) || 0,
    volume: Number(item.volume) || Number(meta.volume) || 0,
    marketCap: Number(item.marketCap) || Number(meta.marketCap) || null,
    marketCapLabel: meta.marketCapLabel ?? formatMarketCap(Number(item.marketCap) || Number(meta.marketCap)),
    priceHistory: meta.priceHistory ?? item.priceHistory ?? [],
    amountHistory: meta.amountHistory ?? item.amountHistory ?? [],
    dayTrend: meta.dayTrend ?? item.dayTrend ?? [],
    latestCandle: meta.latestCandle ?? item.latestCandle ?? null,
  }
}

function naverDomesticRankItems(key) {
  return (state.naverMarket?.domestic?.[key] ?? [])
    .map(enrichNaverDomesticItem)
    .filter((item) => item.ticker && item.name)
}

function naverThemeBuckets() {
  return state.naverMarket?.themes ?? null
}

function naverThemeUniverse() {
  const buckets = naverThemeBuckets()
  if (!buckets) return []

  const themes = new Map()
  ;['all', 'rising', 'falling', 'hot'].forEach((key) => {
    ;(buckets[key] ?? []).forEach((theme) => {
      const name = String(theme.name ?? '')
      if (!name) return
      const current = themes.get(name) ?? {}
      themes.set(name, {
        ...current,
        ...theme,
        stocks: Array.isArray(theme.stocks) && theme.stocks.length > 0 ? theme.stocks : current.stocks,
      })
    })
  })
  return [...themes.values()]
}

function naverThemeStocks(themeName) {
  const buckets = naverThemeBuckets()
  if (!buckets) return []
  return ['all', 'rising', 'falling', 'hot']
    .flatMap((key) => buckets[key] ?? [])
    .find((theme) => theme.name === themeName)
    ?.stocks
    ?.map(enrichNaverDomesticItem) ?? []
}

function naverUsRankItems(key) {
  return (state.naverMarket?.us?.[key] ?? [])
    .filter((item) => item.symbol && item.name)
}

function naverWorldStockUrl(code) {
  return `https://m.stock.naver.com/worldstock/stock/${encodeURIComponent(code)}/total`
}

function marketCapItems() {
  const naverItems = naverDomesticRankItems('marketCap').slice(0, 10)
  if (naverItems.length > 0) {
    return naverItems.map((item, index) => {
      const changeRate = stockPeriodChangeRate(item)
      return {
        rank: item.rank ?? index + 1,
        name: item.name,
        sub: `${item.ticker} · ${item.market || 'KRX'}`,
        href: `https://finance.naver.com/item/main.naver?code=${item.ticker}`,
        value: item.marketCapLabel ?? formatMarketCap(item.marketCap),
        tone: toneForValue(changeRate),
        trend: stockTrend(item),
      }
    })
  }

  const items = stockMetaItems()
    .filter((item) => item.marketCap && item.name)
    .sort((a, b) => b.marketCap - a.marketCap)
    .slice(0, 10)

  if (items.length > 0) {
    return items.map((item, index) => {
      const changeRate = stockPeriodChangeRate(item)
      return {
        rank: index + 1,
        name: item.name,
        sub: `${item.ticker} · ${item.market || 'KRX'}`,
        href: `https://finance.naver.com/item/main.naver?code=${item.ticker}`,
        value: item.marketCapLabel ?? formatMarketCap(item.marketCap),
        tone: toneForValue(changeRate),
        trend: stockTrend(item),
      }
    })
  }

  return marketCaps.map(([name, ticker, cap, trend], index) => ({
    rank: index + 1,
    name,
    sub: ticker,
    href: `https://finance.naver.com/item/main.naver?code=${ticker}`,
    value: cap,
    tone: 'neutral',
    trend,
  }))
}

function rowsByPensionMode(mode) {
  const rows = activePensionRows()

  if (mode === 'sell') {
    return [...rows]
      .filter((row) => row.netAmount < 0)
      .sort((a, b) => a.netAmount - b.netAmount)
  }

  if (mode === 'buyStreak') {
    return [...rows]
      .filter((row) => row.netAmount > 0 && row.buyStreak > 0)
      .sort((a, b) => b.buyStreak - a.buyStreak || b.netAmount - a.netAmount)
  }

  if (mode === 'buyToMarketCap') {
    return [...rows]
      .filter((row) => row.netAmount > 0 && row.buyToMarketCap !== null)
      .sort((a, b) => b.buyToMarketCap - a.buyToMarketCap || b.netAmount - a.netAmount)
  }

  return [...rows]
    .filter((row) => row.netAmount > 0)
    .sort((a, b) => b.netAmount - a.netAmount)
}

function pensionItems(mode) {
  const rows = rowsByPensionMode(mode)
    .slice(0, 10)

  return rows.map((row, index) => ({
    rank: index + 1,
    name: row.name,
    sub: mode === 'buyStreak'
      ? `${row.ticker} · ${row.buyStreak}일`
      : mode === 'buyToMarketCap'
        ? `${row.ticker} · 시총 ${row.marketCapLabel || '-'}`
        : row.ticker,
    href: `https://finance.naver.com/item/main.naver?code=${row.ticker}`,
    value: mode === 'buyToMarketCap' ? formatPercentRatio(row.buyToMarketCap) : `${formatMoney(row.netAmount)}원`,
    tone: mode === 'sell' ? 'down' : 'up',
    trend: stockTrend(row),
  }))
}

function marketSummaryItems() {
  const groups = new Map()

  stockMetaItems().forEach((item) => {
    const market = item.market || '기타'
    if (!['KOSPI', 'KOSDAQ'].includes(market)) return
    if (!groups.has(market)) {
      groups.set(market, { market, count: 0, up: 0, down: 0, marketCap: 0, amount: 0 })
    }
    const group = groups.get(market)
    group.count += 1
    group.marketCap += item.marketCap || 0
    group.amount += item.amount || 0
    if (item.changeRate > 0) group.up += 1
    if (item.changeRate < 0) group.down += 1
  })

  const marketItems = [...groups.values()]
    .sort((a, b) => b.marketCap - a.marketCap)
    .map((group, index) => ({
      rank: index + 1,
      name: group.market,
      sub: `상승 ${group.up} · 하락 ${group.down} · ${group.count}종목`,
      value: formatMarketCap(group.marketCap),
      tone: group.up >= group.down ? 'up' : 'down',
      trend: marketTrend(group.market),
    }))

  const indexItems = state.marketIndex.map((item, index) => ({
    rank: marketItems.length + index + 1,
    name: item.name,
    sub: `${item.change} · ${item.unit}`,
    value: item.value,
    tone: item.tone,
    trend: [],
  }))

  return [...marketItems, ...indexItems]
}

function marketRankingItems(mode) {
  if (mode === 'amount') {
    const naverItems = naverDomesticRankItems('tradingAmount').slice(0, 10)
    if (naverItems.length > 0) {
      return naverItems.map((item, index) => {
        const changeRate = stockPeriodChangeRate(item)
        return {
          rank: item.rank ?? index + 1,
          name: item.name,
          sub: `${item.ticker} · ${item.market || 'KRX'} · ${formatPrice(item.price)}`,
          href: `https://finance.naver.com/item/main.naver?code=${item.ticker}`,
          value: formatMoney(item.amount || 0),
          tone: toneForValue(changeRate),
          trend: stockTrend(item),
        }
      })
    }
  }

  const items = stockMetaItems()
    .filter((item) => item.name && item.ticker)
    .sort((a, b) => {
      if (mode === 'up') return compareNullableDesc(stockPeriodChangeRate(a), stockPeriodChangeRate(b))
      if (mode === 'down') return compareNullableAsc(stockPeriodChangeRate(a), stockPeriodChangeRate(b))
      return (b.amount ?? 0) - (a.amount ?? 0)
    })
    .slice(0, 10)

  return items.map((item, index) => {
    const changeRate = stockPeriodChangeRate(item)
    return {
      rank: index + 1,
      name: item.name,
      sub: `${item.ticker} · ${item.market || 'KRX'} · ${formatPrice(item.price)}`,
      href: `https://finance.naver.com/item/main.naver?code=${item.ticker}`,
      value: mode === 'amount' ? formatMoney(item.amount || 0) : formatSignedPercent(changeRate),
      tone: mode === 'down' ? 'down' : toneForValue(changeRate),
      trend: stockTrend(item),
    }
  })
}

function marketSearchItems() {
  const naverItems = naverDomesticRankItems('searchTop').slice(0, 10)
  if (naverItems.length > 0) {
    return naverItems.map((item, index) => {
      const changeRate = stockPeriodChangeRate(item)
      return {
        rank: item.rank ?? index + 1,
        name: item.name,
        sub: `${item.ticker} · 조회 ${formatNumber(item.viewCount || 0)}`,
        href: `https://finance.naver.com/item/main.naver?code=${item.ticker}`,
        value: formatSignedPercent(changeRate),
        tone: toneForValue(changeRate),
        trend: stockTrend(item),
      }
    })
  }

  return stockMetaItems()
    .filter((item) => item.name && item.ticker)
    .sort((a, b) => (b.amount ?? 0) + (b.marketCap ?? 0) * 0.001 - ((a.amount ?? 0) + (a.marketCap ?? 0) * 0.001))
    .slice(0, 10)
    .map((item, index) => {
      const changeRate = stockPeriodChangeRate(item)
      return {
        rank: index + 1,
        name: item.name,
        sub: `${item.ticker} · 검색상위 후보`,
        href: `https://finance.naver.com/item/main.naver?code=${item.ticker}`,
        value: formatSignedPercent(changeRate),
        tone: toneForValue(changeRate),
        trend: stockTrend(item),
      }
    })
}

function marketStockSearchResults() {
  const query = state.marketQuery.trim().toLowerCase()
  if (!query) return []

  if (isUsMarketView()) {
    const usUniverse = new Map(usStockUniverse.map((item) => [item.symbol, item]))
    Object.values(state.naverMarket?.us ?? {}).flat().forEach((item) => {
      const enriched = enrichUsRankItem(item)
      if (enriched.symbol) usUniverse.set(enriched.symbol, { ...enriched, ...usUniverse.get(enriched.symbol) })
    })

    return [...usUniverse.values()]
      .filter((item) => {
        const name = String(item.name ?? '').toLowerCase()
        const symbol = String(item.symbol ?? '').toLowerCase()
        const naverCode = String(item.naverCode ?? '').toLowerCase()
        const sector = String(item.sector ?? '').toLowerCase()
        return name.includes(query) || symbol.includes(query) || naverCode.includes(query) || sector.includes(query)
      })
      .sort((a, b) => marketSearchScore({ name: a.name, ticker: a.symbol }, query) - marketSearchScore({ name: b.name, ticker: b.symbol }, query)
        || parseAbbrevValue(b.amount) - parseAbbrevValue(a.amount)
        || parseAbbrevValue(b.marketCap) - parseAbbrevValue(a.marketCap))
      .slice(0, 8)
  }

  return stockMetaItems()
    .filter((item) => {
      const name = String(item.name ?? '').toLowerCase()
      const ticker = String(item.ticker ?? '')
      return name.includes(query) || ticker.includes(query)
    })
    .sort((a, b) => marketSearchScore(a, query) - marketSearchScore(b, query)
      || (b.amount ?? 0) - (a.amount ?? 0)
      || (b.marketCap ?? 0) - (a.marketCap ?? 0))
    .slice(0, 8)
}

function isDomesticMarketView() {
  return state.view === 'stock' && state.stockCountry === 'kr' && state.krStockSection === 'market'
}

function isUsMarketView() {
  return state.view === 'stock' && state.stockCountry === 'us' && state.usStockSection === 'market'
}

function isStockMarketSearchView() {
  return isDomesticMarketView() || isUsMarketView()
}

function isPensionView() {
  return state.view === 'stock' && state.stockCountry === 'kr' && state.krStockSection === 'pension'
}

function setPanelActive(panel, active) {
  panel.classList.toggle('active', active)
  panel.hidden = !active
}

function syncControlBar() {
  document.querySelector('#stockCountryTabs').hidden = state.view !== 'stock'
  document.querySelector('#krStockSubTabs').hidden = state.view !== 'stock' || state.stockCountry !== 'kr'
  document.querySelector('#usStockSubTabs').hidden = state.view !== 'stock' || state.stockCountry !== 'us'
  document.querySelector('#pensionSubTabs').hidden = !isPensionView()
  document.querySelector('#etfSubTabs').hidden = state.view !== 'etf'
  document.querySelector('#marketSearchControl').hidden = !isStockMarketSearchView()
  const searchLabel = document.querySelector('#marketSearchControl span')
  const searchInput = document.querySelector('#marketSearch')
  if (searchLabel) searchLabel.textContent = isUsMarketView() ? '미국 종목 검색' : '종목 검색'
  if (searchInput) searchInput.placeholder = isUsMarketView() ? '미국 종목명 또는 티커' : '종목명 또는 코드'
  updateMarketSearchResults()
}

function updateMarketSearchResults() {
  const container = document.querySelector('#marketSearchResults')
  const query = state.marketQuery.trim()

  if (!isStockMarketSearchView() || !query) {
    container.hidden = true
    container.innerHTML = ''
    if (isStockMarketSearchView()) updateResultStatus(0)
    return
  }

  const matches = marketStockSearchResults()
  container.hidden = false
  if (matches.length === 0) {
    container.innerHTML = '<div class="search-result-head"><span>검색 결과 없음</span></div>'
    updateResultStatus(0)
    return
  }
  updateResultStatus(matches.length)

  container.innerHTML = `
    <div class="search-result-head">
      <span>검색 결과</span>
      <b>${matches.length}개 표시</b>
    </div>
    <ol class="search-result-list market-result-list">
      ${matches.map((item) => {
        const isUsItem = isUsMarketView()
        const changeAmount = stockChangeAmount(item)
        const changeRate = stockPeriodChangeRate(item)
        const tone = toneForValue(changeAmount ?? changeRate)
        const changeLabel = changeAmount < 0 ? '하락폭' : changeAmount > 0 ? '상승폭' : '등락폭'
        const ticker = isUsItem ? item.symbol : item.ticker
        const marketLabel = isUsItem ? (item.sector || 'US') : (item.market || 'KRX')
        const priceLabel = isUsItem ? formatUsd(item.price) : formatPrice(item.price)
        const capLabel = isUsItem ? formatUsdCompact(parseAbbrevValue(item.marketCap)) : (item.marketCapLabel || formatMarketCap(item.marketCap))
        const amountLabel = isUsItem ? formatUsdCompact(parseAbbrevValue(item.amount)) : `${formatMoney(item.amount || 0)}원`
        const changeAmountLabel = isUsItem ? formatUsd(changeAmount) : formatSignedPrice(changeAmount)
        return `
          <li>
            <div>
              <button type="button" data-market-search-ticker="${escapeHtml(ticker)}">${escapeHtml(item.name)}</button>
              <small>${escapeHtml(ticker)} · ${escapeHtml(marketLabel)}</small>
            </div>
            <span class="market-search-metrics">
              <span class="metric"><small>현재가</small><b>${escapeHtml(priceLabel)}</b></span>
              <span class="metric"><small>시가총액</small><b>${escapeHtml(capLabel)}</b></span>
              <span class="metric"><small>거래대금</small><b>${escapeHtml(amountLabel)}</b></span>
              <span class="metric"><small>${changeLabel}</small><b class="${tone}">${escapeHtml(changeAmountLabel)}<em>${escapeHtml(formatSignedPercent(changeRate))}</em></b></span>
            </span>
            ${sparkline(stockTrend(item), tone)}
          </li>
        `
      }).join('')}
    </ol>
  `
}

function marketPopularItems() {
  return [...state.rows]
    .sort((a, b) => Math.abs(b.netAmount) + b.buyAmount + b.sellAmount - (Math.abs(a.netAmount) + a.buyAmount + a.sellAmount))
    .slice(0, 10)
    .map((row, index) => ({
      rank: index + 1,
      name: row.name,
      sub: `${row.ticker} · 연기금 수급/거래 관심`,
      href: `https://finance.naver.com/item/main.naver?code=${row.ticker}`,
      value: `${formatMoney(row.netAmount)}원`,
      tone: row.netAmount >= 0 ? 'up' : 'down',
      trend: stockTrend(row),
    }))
}

function usStockItems(mode) {
  const naverKeyMap = {
    marketCap: 'marketCap',
    amount: 'tradingAmount',
    volume: 'volume',
    search: 'searchTop',
  }
  const naverItems = naverUsRankItems(naverKeyMap[mode]).map(enrichUsRankItem).slice(0, 10)
  if (naverItems.length > 0) {
    return naverItems
      .map((item) => {
        const changeRate = stockPeriodChangeRate(item)
        return {
          name: item.name,
          sub: `${item.symbol} · ${item.sector || 'US'}`,
          href: naverWorldStockUrl(item.naverCode ?? item.symbol),
          value: mode === 'marketCap'
            ? formatUsdCompact(item.marketCap)
            : mode === 'volume'
              ? formatShareVolume(item.volume || item.latestCandle?.volume || 0)
              : mode === 'search'
                ? '조회 상위'
                : formatUsdCompact(item.amount),
          tone: toneForValue(changeRate),
          trend: stockTrend(item),
          sortValue: mode === 'marketCap'
            ? parseAbbrevValue(item.marketCap)
            : mode === 'amount'
              ? parseAbbrevValue(item.amount)
              : mode === 'volume'
                ? Number(item.volume) || 0
                : changeRate,
        }
      })
      .sort((a, b) => compareNullableDesc(a.sortValue, b.sortValue))
      .map((item, index) => ({ ...item, rank: index + 1 }))
  }

  return [...usStockUniverse]
    .sort((a, b) => {
      if (mode === 'marketCap') return parseAbbrevValue(b.marketCap) - parseAbbrevValue(a.marketCap)
      if (mode === 'amount') return parseAbbrevValue(b.amount) - parseAbbrevValue(a.amount)
      if (mode === 'volume') return (b.latestCandle?.volume ?? 0) - (a.latestCandle?.volume ?? 0)
      if (mode === 'search') return b.popularity - a.popularity
      return b.popularity + parseAbbrevValue(b.amount) / 1_000_000_000 - (a.popularity + parseAbbrevValue(a.amount) / 1_000_000_000)
    })
    .slice(0, 10)
    .map((item, index) => {
      const changeRate = stockPeriodChangeRate(item)
      return {
        rank: index + 1,
        name: item.name,
        sub: `${item.symbol} · ${item.sector}`,
        href: naverWorldStockUrl(item.naverCode ?? item.symbol),
        value: mode === 'marketCap'
          ? `$${item.marketCap}`
          : mode === 'amount'
            ? `$${item.amount}`
            : mode === 'volume'
              ? formatShareVolume(item.latestCandle?.volume ?? 0)
              : `${item.popularity}점`,
        tone: toneForValue(changeRate),
        trend: stockTrend(item),
      }
    })
}

function renderListPanel({ title, meta, items }) {
  return `
    <article class="list-panel">
      <div class="panel-head">
        <div><p>${escapeHtml(meta)}</p><h2>${escapeHtml(title)}</h2></div>
        <span class="panel-meta">${items.length}개</span>
      </div>
      <ol class="rank-list">
        ${items.length === 0 ? '<li class="empty-state">표시할 데이터가 없습니다.</li>' : items.map((item) => `
          <li class="rank-item">
            <span class="rank">${item.rank}</span>
            <div class="item-main">
              ${item.action ? `<button class="inline-action" type="button" data-action="${escapeHtml(item.action)}" data-value="${escapeHtml(item.actionValue)}">${escapeHtml(item.name)}</button>` : item.href ? `<a href="${item.href}" target="_blank" rel="noreferrer">${escapeHtml(item.name)}</a>` : `<strong>${escapeHtml(item.name)}</strong>`}
              <small>${escapeHtml(item.sub)}</small>
            </div>
            <span class="value ${item.tone}">${escapeHtml(item.value)}</span>
            ${sparkline(item.trend, item.tone)}
          </li>
        `).join('')}
      </ol>
    </article>
  `
}

function renderThemeSections() {
  if (naverThemeUniverse().length) {
    const panels = [
      { title: '상승중인 테마', meta: 'Naver 테마', items: periodThemeRankItems((item) => item.rate > 0).slice(0, 10) },
      { title: '하락중인 테마', meta: 'Naver 테마', items: periodThemeRankItems((item) => item.rate < 0, 'rate', 'asc').slice(0, 10) },
      { title: '현재 핫한 테마', meta: '누적 거래대금', items: periodThemeRankItems((item) => item.amount > 0, 'amount').slice(0, 10) },
    ]
    if (!panels.some((panel) => panel.items.some((item) => item.actionValue === state.selectedTheme))) {
      state.selectedTheme = panels[0].items[0]?.actionValue ?? themeUp[0][0]
    }
    document.querySelector('#themeSectionGrid').innerHTML = panels.map(renderListPanel).join('')
    renderThemeDetail()
    return
  }

  const panels = [
    { title: '상승중인 테마', meta: '테마 상승', items: staticItems(themeUp, 'up') },
    { title: '하락중인 테마', meta: '테마 하락', items: staticItems(themeDown, 'down', (value) => `${value}%`, 'asc') },
    { title: '현재 핫한 테마', meta: '관심 테마', items: staticItems(hotThemes, 'up', (value) => `3일 ${value}%`) },
  ]

  document.querySelector('#themeSectionGrid').innerHTML = panels.map(renderListPanel).join('')
  renderThemeDetail()
}

function renderThemeDetail() {
  const themeName = state.selectedTheme ?? themeUp[0][0]
  const rows = themeStocks(themeName)
    .map((row) => ({ ...row, periodChangeRate: stockPeriodChangeRate(row) }))
    .sort((a, b) => compareNullableDesc(a.periodChangeRate, b.periodChangeRate))
  document.querySelector('#themeDetail').innerHTML = `
    <div class="panel-head">
      <div>
        <p>테마 구성</p>
        <h2>${escapeHtml(themeName)}</h2>
      </div>
      <span class="panel-meta">${rows.length.toLocaleString('ko-KR')}종목</span>
    </div>
    <ol class="theme-stock-list">
      ${rows.map((row, index) => {
        const changeRate = row.periodChangeRate
        const tone = toneForValue(changeRate)
        return `
          <li>
            <span class="rank-pill">${index + 1}</span>
            <div class="stock-name">
              <a href="https://finance.naver.com/item/main.naver?code=${row.ticker}" target="_blank" rel="noreferrer">${escapeHtml(row.name)}</a>
              <small>${escapeHtml(row.ticker)} · ${escapeHtml(row.market ?? 'KRX')} · ${escapeHtml((row.tags ?? []).join(', '))}</small>
            </div>
            <b>${formatPrice(row.price)}</b>
            <b class="value ${tone}">${formatSignedPercent(changeRate)}</b>
            <b>${escapeHtml(row.marketCapLabel || '-')}</b>
            <b>${formatMoney(row.amount || 0)}원</b>
            ${sparkline(row.trend, tone)}
          </li>
        `
      }).join('')}
    </ol>
  `
}

function renderMarketInsights() {
  const panels = [
    { title: '시장 요약', meta: 'KRX/Naver 집계', items: marketSummaryItems() },
    { title: '거래대금 상위', meta: 'Naver 거래대금', items: marketRankingItems('amount') },
  ]

  document.querySelector('#marketInsightGrid').innerHTML = panels.map(renderListPanel).join('')

  const rankingPanels = [
    { title: '시가총액 상위', meta: 'Naver 시총', items: marketCapItems() },
    { title: '검색 상위', meta: 'Naver 조회수', items: marketSearchItems() },
    { title: '연기금 관심', meta: 'KRX 연기금', items: marketPopularItems() },
  ]

  document.querySelector('#marketRankingGrid').innerHTML = rankingPanels.map(renderListPanel).join('')
  updateMarketSearchResults()
}

function renderUsMarket() {
  const panels = [
    { title: '미국 시가총액', meta: 'Naver 미국', items: usStockItems('marketCap') },
    { title: '거래대금 상위', meta: 'Naver 거래대금', items: usStockItems('amount') },
    { title: '검색 상위', meta: 'Naver 조회수', items: usStockItems('search') },
    { title: '거래량 상위', meta: 'Naver 거래량', items: usStockItems('volume') },
  ]

  document.querySelector('#usMarketGrid').innerHTML = panels.map(renderListPanel).join('')
}

function usThemeGroups() {
  const groups = new Map()
  usStockUniverse.forEach((stock) => {
    const sector = stock.sector || '기타'
    if (!groups.has(sector)) groups.set(sector, [])
    groups.get(sector).push(stock)
  })

  return [...groups.entries()].map(([name, stocks]) => {
    const trend = aggregateStockTrend(stocks)
    const rate = seriesChangeRate(trend)
    const amount = stocks.reduce((sum, stock) => sum + parseAbbrevValue(stock.amount), 0)
    return { name, stocks, trend, rate, amount }
  })
}

function usThemeRankItems(predicate = () => true, sortKey = 'rate', direction = 'desc') {
  return usThemeGroups()
    .filter(predicate)
    .sort((a, b) => {
      const result = sortKey === 'amount' ? a.amount - b.amount : compareNullableAsc(a.rate, b.rate)
      return direction === 'asc' ? result : -result
    })
    .slice(0, 10)
    .map((theme, index) => ({
      rank: index + 1,
      name: theme.name,
      sub: `${theme.stocks.length.toLocaleString('ko-KR')}종목 · ${theme.stocks[0]?.name ?? 'US'}`,
      value: sortKey === 'amount' ? formatUsdCompact(theme.amount) : formatSignedPercent(theme.rate),
      tone: toneForValue(theme.rate),
      trend: theme.trend,
      action: 'us-theme-detail',
      actionValue: theme.name,
    }))
}

function renderUsThemeSections() {
  const panels = [
    { title: '상승중인 테마', meta: '미국 섹터', items: usThemeRankItems((item) => item.rate > 0) },
    { title: '하락중인 테마', meta: '미국 섹터', items: usThemeRankItems((item) => item.rate < 0, 'rate', 'asc') },
    { title: '현재 핫한 테마', meta: '누적 거래대금', items: usThemeRankItems((item) => item.amount > 0, 'amount') },
  ]

  if (!panels.some((panel) => panel.items.some((item) => item.actionValue === state.selectedUsTheme))) {
    state.selectedUsTheme = panels[0].items[0]?.actionValue ?? usThemeGroups()[0]?.name ?? null
  }

  document.querySelector('#usThemeGrid').innerHTML = panels.map(renderListPanel).join('')
  renderUsThemeDetail()
}

function renderUsThemeDetail() {
  const themeName = state.selectedUsTheme ?? usThemeGroups()[0]?.name ?? '미국 테마'
  const rows = usStockUniverse
    .filter((stock) => (stock.sector || '기타') === themeName)
    .map((stock) => ({ ...stock, periodChangeRate: stockPeriodChangeRate(stock) }))
    .sort((a, b) => compareNullableDesc(a.periodChangeRate, b.periodChangeRate))

  document.querySelector('#usThemeDetail').innerHTML = `
    <div class="panel-head">
      <div>
        <p>미국 테마 구성</p>
        <h2>${escapeHtml(themeName)}</h2>
      </div>
      <span class="panel-meta">${rows.length.toLocaleString('ko-KR')}종목</span>
    </div>
    <ol class="theme-stock-list">
      ${rows.map((row, index) => {
        const changeRate = row.periodChangeRate
        const tone = toneForValue(changeRate)
        return `
          <li>
            <span class="rank-pill">${index + 1}</span>
            <div class="stock-name">
              <a href="${naverWorldStockUrl(row.naverCode ?? row.symbol)}" target="_blank" rel="noreferrer">${escapeHtml(row.name)}</a>
              <small>${escapeHtml(row.symbol)} · ${escapeHtml(row.sector ?? 'US')}</small>
            </div>
            <b>${escapeHtml(formatUsd(row.price))}</b>
            <b class="value ${tone}">${formatSignedPercent(changeRate)}</b>
            <b>${escapeHtml(formatUsdCompact(parseAbbrevValue(row.marketCap)))}</b>
            <b>${escapeHtml(formatUsdCompact(parseAbbrevValue(row.amount)))}</b>
            ${sparkline(stockTrend(row), tone)}
          </li>
        `
      }).join('')}
    </ol>
  `
}

function usFlowItems(mode) {
  return [...usStockUniverse]
    .map((stock) => ({
      ...stock,
      periodChangeRate: stockPeriodChangeRate(stock),
      amountValue: parseAbbrevValue(stock.amount),
      volumeValue: Number(stock.latestCandle?.volume ?? stock.volume ?? 0),
    }))
    .sort((a, b) => {
      if (mode === 'buy') return (b.periodChangeRate ?? -Infinity) - (a.periodChangeRate ?? -Infinity) || b.amountValue - a.amountValue
      if (mode === 'sell') return (a.periodChangeRate ?? Infinity) - (b.periodChangeRate ?? Infinity) || b.amountValue - a.amountValue
      if (mode === 'volume') return b.volumeValue - a.volumeValue
      return b.amountValue - a.amountValue
    })
    .slice(0, 10)
    .map((stock, index) => ({
      rank: index + 1,
      name: stock.name,
      sub: `${stock.symbol} · ${stock.sector || 'US'} · 가격·거래대금 기반`,
      href: naverWorldStockUrl(stock.naverCode ?? stock.symbol),
      value: mode === 'volume' ? formatShareVolume(stock.volumeValue) : mode === 'amount' ? formatUsdCompact(stock.amountValue) : formatSignedPercent(stock.periodChangeRate),
      tone: mode === 'sell' ? 'down' : toneForValue(stock.periodChangeRate),
      trend: stockTrend(stock),
    }))
}

function renderUsFlowSections() {
  const panels = [
    { title: '매수 관심 상위', meta: '미국 수급 추정', items: usFlowItems('buy') },
    { title: '매도 압력 상위', meta: '미국 수급 추정', items: usFlowItems('sell') },
    { title: '거래대금 집중', meta: 'Naver/Yahoo', items: usFlowItems('amount') },
    { title: '거래량 상위', meta: 'Naver/Yahoo', items: usFlowItems('volume') },
  ]

  document.querySelector('#usFlowGrid').innerHTML = panels.map(renderListPanel).join('')
}

function renderPensionSections() {
  const panels = [
    { title: '순매수 상위', meta: '연기금 매수', items: pensionItems('buy') },
    { title: '순매도 상위', meta: '연기금 매도', items: pensionItems('sell') },
    { title: '연속 순매수', meta: '연속 매수', items: pensionItems('buyStreak') },
    { title: '시총대비 매수 집중', meta: '시총 대비', items: pensionItems('buyToMarketCap') },
  ]

  document.querySelector('#pensionSectionGrid').innerHTML = panels.map(renderListPanel).join('')
}

function etfPanelItems(mode) {
  if (mode === 'theme') {
    return etfThemes.map(([name, sub, value, trend]) => {
      const themeItems = etfUniverse.filter((item) => item.themes?.includes(name))
      const amountLeader = [...themeItems].sort((a, b) => etfPeriodAmount(b) - etfPeriodAmount(a))[0]
      const gainLeader = [...themeItems].sort((a, b) => compareNullableDesc(etfChangeRate(a), etfChangeRate(b)))[0]
      const themeValue = gainLeader ? etfChangeRate(gainLeader) : (state.chartPeriod === 1 ? value : null)

      return {
        name,
        sub: amountLeader?.name ?? sub,
        value: formatSignedPercent(themeValue),
        tone: toneForValue(themeValue),
        trend: amountLeader ? etfTrend(amountLeader) : trend,
        action: 'etf-theme',
        actionValue: name,
        sortValue: themeValue,
      }
    })
      .sort((a, b) => compareNullableDesc(a.sortValue, b.sortValue))
      .map((item, index) => ({ ...item, rank: index + 1 }))
  }

  return [...etfUniverse]
    .filter((item) => mode.startsWith('us') ? isUsListedEtf(item) : true)
    .sort((a, b) => {
      if (mode.endsWith('Up')) return compareNullableDesc(etfChangeRate(a), etfChangeRate(b))
      return etfPeriodAmount(b) - etfPeriodAmount(a)
    })
    .slice(0, 10)
    .map((item, index) => {
      const changeRate = etfChangeRate(item)
      return {
        rank: index + 1,
        name: item.name,
        sub: `${item.code} · ${item.issuer}`,
        value: mode.endsWith('Up') ? formatSignedPercent(changeRate) : formatMoney(etfPeriodAmount(item)),
        tone: toneForValue(changeRate),
        trend: etfTrend(item),
        action: 'etf-select',
        actionValue: item.code,
      }
    })
}

function isUsListedEtf(item) {
  return item.category === '국내상장 미국ETF'
}

function holdingKey(name, ticker) {
  return String(ticker || name || '').trim().toUpperCase()
}

function filteredEtfs() {
  const query = state.etfQuery.trim().toLowerCase()

  return etfUniverse.filter((item) => {
    if (state.etfSection === 'us' && !isUsListedEtf(item)) return false
    if (state.etfSection === 'theme' && state.etfTheme && !item.themes?.includes(state.etfTheme)) return false
    if (!query) return true
    const holdings = Array.isArray(item.holdings) ? item.holdings : []
    const holdingText = holdings.map(([name, ticker]) => `${name} ${ticker}`).join(' ').toLowerCase()
    const themeText = (item.themes ?? []).join(' ').toLowerCase()
    return String(item.name).toLowerCase().includes(query)
      || String(item.code).includes(query)
      || String(item.issuer).toLowerCase().includes(query)
      || String(item.category).toLowerCase().includes(query)
      || String(item.etfType ?? '').toLowerCase().includes(query)
      || themeText.includes(query)
      || holdingText.includes(query)
  })
}

function etfsByHolding(holdingName, holdingTicker) {
  const selectedKey = holdingKey(holdingName, holdingTicker)
  return etfUniverse
    .map((etf) => {
      const holdings = Array.isArray(etf.holdings) ? etf.holdings : []
      const holding = holdings.find(([name, ticker]) => holdingKey(name, ticker) === selectedKey)
      return holding ? { etf, ratio: holding[2] } : null
    })
    .filter(Boolean)
    .sort((a, b) => b.ratio - a.ratio)
}

function renderEtfSections() {
  const themePanels = [
    { title: '거래대금 많은 ETF', meta: '거래대금', items: etfPanelItems('amount') },
    { title: '가장 많이 오른 ETF', meta: '상승률', items: etfPanelItems('allUp') },
  ]
  const usPanels = [
    { title: '미국ETF 거래대금', meta: '국내상장 미국', items: etfPanelItems('usAmount') },
    { title: '미국ETF 상승', meta: '국내상장 미국', items: etfPanelItems('usUp') },
  ]

  document.querySelector('#etfThemeGrid').innerHTML = themePanels.map(renderListPanel).join('')
  document.querySelector('#etfUsGrid').innerHTML = usPanels.map(renderListPanel).join('')
  renderEtfList()
  renderEtfDetail()
}

function etfListTitle() {
  if (state.etfSection === 'search') return 'ETF 검색 결과'
  if (state.etfSection === 'us') return '국내상장 미국 ETF'
  return state.etfTheme ? `${state.etfTheme} ETF` : '테마 ETF'
}

function etfListMeta(items, visibleCount = items.length) {
  const countText = `${visibleCount.toLocaleString('ko-KR')} / ${items.length.toLocaleString('ko-KR')}개`
  if (state.etfSection === 'search') {
    const query = state.etfQuery.trim()
    return query ? `"${query}" · ${countText}` : countText
  }

  if (state.etfSection === 'us') return `국내상장 미국 ETF · ${countText}`
  return state.etfTheme
    ? `${state.etfTheme} · ${countText}`
    : countText
}

function renderEtfList() {
  const items = filteredEtfs()
  const selectedExists = items.some((item) => item.code === state.selectedEtfCode)
  if (!selectedExists) state.selectedEtfCode = items[0]?.code ?? null
  const selectedIndex = items.findIndex((item) => item.code === state.selectedEtfCode)
  if (selectedIndex >= state.etfVisibleLimit) {
    state.etfVisibleLimit = Math.ceil((selectedIndex + 1) / 20) * 20
  }
  const visibleItems = items.slice(0, state.etfVisibleLimit)

  document.querySelector('#etfListTitle').textContent = etfListTitle()
  document.querySelector('#etfListMeta').textContent = etfListMeta(items, visibleItems.length)
  if (items.length === 0) {
    document.querySelector('#etfList').innerHTML = '<li class="empty-state">조건에 맞는 ETF가 없습니다.</li>'
    document.querySelector('#etfLoadMoreButton').hidden = true
    updateResultStatus(0)
    return
  }

  document.querySelector('#etfList').innerHTML = visibleItems.map((item) => {
    const changeRate = etfChangeRate(item)
    return `
      <li>
        <button class="${item.code === state.selectedEtfCode ? 'active' : ''}" type="button" data-etf-code="${item.code}" aria-pressed="${item.code === state.selectedEtfCode ? 'true' : 'false'}">
          <span>
            <strong>${escapeHtml(item.name)}</strong>
            <small>${escapeHtml(item.code)} · ${escapeHtml(item.issuer)} · ${escapeHtml(item.category)}</small>
          </span>
          <b class="${toneForValue(changeRate)}">${formatSignedPercent(changeRate)}</b>
        </button>
      </li>
    `
  }).join('')

  const remaining = Math.max(items.length - visibleItems.length, 0)
  const loadMoreButton = document.querySelector('#etfLoadMoreButton')
  loadMoreButton.hidden = remaining === 0
  loadMoreButton.textContent = `아래로 20개 더 보기 ↓ (${remaining.toLocaleString('ko-KR')}개 남음)`
  updateResultStatus(visibleItems.length)
}

function renderEtfDetail() {
  const item = etfUniverse.find((etf) => etf.code === state.selectedEtfCode) ?? etfUniverse[0]
  if (!item || !filteredEtfs().some((etf) => etf.code === item.code)) {
    document.querySelector('#etfDetail').innerHTML = `
      <div class="panel-head">
        <div><p>ETF</p><h2>선택 가능한 ETF가 없습니다</h2></div>
      </div>
    `
    return
  }
  const holdings = Array.isArray(item.holdings) ? item.holdings : []
  const selectedHolding = holdings.some(([name, ticker]) => holdingKey(name, ticker) === state.selectedHolding)
    ? state.selectedHolding
    : (holdings[0] ? holdingKey(holdings[0][0], holdings[0][1]) : null)
  state.selectedHolding = selectedHolding
  const selectedHoldingRow = holdings.find(([name, ticker]) => holdingKey(name, ticker) === selectedHolding)
  const holdingName = selectedHoldingRow?.[0] ?? selectedHolding
  const related = selectedHolding ? etfsByHolding(holdingName, selectedHolding) : []
  const hasHoldings = holdings.length > 0
  const changeRate = etfChangeRate(item)
  const tone = toneForValue(changeRate)

  document.querySelector('#etfDetail').innerHTML = `
    <div class="panel-head">
      <div>
        <p>${escapeHtml(item.code)} · ${escapeHtml(item.issuer)}</p>
        <h2>${escapeHtml(item.name)}</h2>
      </div>
      <span class="panel-meta">${escapeHtml(item.category)}</span>
    </div>
    <div class="etf-metrics">
      <div><span>가격</span><strong>${formatPrice(item.price)}</strong></div>
      <div><span>등락률</span><strong class="${tone}">${formatSignedPercent(changeRate)}</strong></div>
      <div><span>시가총액</span><strong>${formatMarketCap(item.marketCap)}</strong></div>
      <div><span>거래대금</span><strong>${formatMoney(etfPeriodAmount(item))}</strong></div>
    </div>
    <div class="chart-card">${sparkline(etfTrend(item), tone)}</div>
    <div class="holding-grid">
      <section>
        <h3>구성종목</h3>
        ${hasHoldings ? `
          <ol class="holding-list">
            ${holdings.map(([name, ticker, ratio]) => `
              <li>
                <button class="${holdingKey(name, ticker) === selectedHolding ? 'active' : ''}" type="button" data-holding-key="${escapeHtml(holdingKey(name, ticker))}" aria-pressed="${holdingKey(name, ticker) === selectedHolding ? 'true' : 'false'}">
                  <span>${escapeHtml(name)}<small>${escapeHtml(ticker || '종목코드 미확인')}</small></span>
                  <b>${Number(ratio).toFixed(1)}%</b>
                </button>
              </li>
            `).join('')}
          </ol>
        ` : '<p class="empty-state">구성종목 데이터는 ETF명·테마 기반 추정 가능 종목부터 확장 중입니다.</p>'}
      </section>
      <section>
        <h3>${hasHoldings ? `${escapeHtml(holdingName)} 포함 ETF` : '데이터 출처'}</h3>
        ${hasHoldings ? `
          <ol class="holding-list related">
            ${related.map(({ etf, ratio }) => `
              <li>
                <button type="button" data-etf-code="${etf.code}">
                  <span>${escapeHtml(etf.name)}<small>${escapeHtml(etf.issuer)}</small></span>
                  <b>${Number(ratio).toFixed(1)}%</b>
                </button>
              </li>
            `).join('')}
          </ol>
        ` : `<p class="empty-state">${escapeHtml(item.source ?? 'Naver/KRX 기반 로컬 ETF 데이터')}</p>`}
      </section>
    </div>
  `
}

function renderSummary() {
  renderDataStatus()
}

function updateResultStatus(count) {
  const el = document.getElementById('resultStatus')
  if (!el) return
  el.textContent = `${count.toLocaleString('ko-KR')}개 결과가 표시되었습니다.`
}

function renderMobileStockState(message, tone = 'muted') {
  const container = document.getElementById('mobileStockList')
  if (!container) return

  container.innerHTML = `
    <div class="mobile-stock-card mobile-stock-card--${escapeHtml(tone)}">
      <div class="mobile-stock-card__name">${escapeHtml(message)}</div>
    </div>
  `
}

function renderMobileStockList(rows) {
  const container = document.getElementById('mobileStockList')
  if (!container) return

  if (!Array.isArray(rows) || rows.length === 0) {
    renderMobileStockState('표시할 종목이 없습니다.', 'empty')
    return
  }

  container.innerHTML = rows.slice(0, 30).map((row, index) => {
    const rank = row.absoluteRank || row.rank || index + 1
    const name = row.name || row.stockName || '-'
    const code = row.code || row.ticker || '-'
    const netBuy = row.netBuyText || row.netBuy || row.pensionNetBuy || `${formatMoney(row.netAmount ?? 0)}원`
    const streak = row.streakText || row.streak || streakLabel(row)
    const strength = row.strengthText || row.marketCapBuyRatio || formatPercentRatio(row.buyToMarketCap)
    const change = row.changeRateText || formatSignedPercent(row.changeRate)
    const tone = row.netAmount < 0 ? 'down' : 'up'

    return `
      <article class="mobile-stock-card">
        <div class="mobile-stock-card__head">
          <div>
            <div class="mobile-stock-card__rank">#${escapeHtml(String(rank))}</div>
            <a class="mobile-stock-card__name" href="https://finance.naver.com/item/main.naver?code=${escapeHtml(String(code))}" target="_blank" rel="noreferrer">${escapeHtml(String(name))}</a>
            <div class="mobile-stock-card__code">${escapeHtml(String(code))}</div>
          </div>
          ${sparkline(stockTrend(row), tone)}
        </div>

        <div class="mobile-stock-card__metrics">
          <div class="mobile-stock-card__metric">
            <span class="mobile-stock-card__label">연기금 순매수</span>
            <span class="mobile-stock-card__value ${tone}">${escapeHtml(String(netBuy))}</span>
          </div>
          <div class="mobile-stock-card__metric">
            <span class="mobile-stock-card__label">연속 매수</span>
            <span class="mobile-stock-card__value">${escapeHtml(String(streak))}</span>
          </div>
          <div class="mobile-stock-card__metric">
            <span class="mobile-stock-card__label">수급 강도</span>
            <span class="mobile-stock-card__value">${escapeHtml(String(strength))}</span>
          </div>
          <div class="mobile-stock-card__metric">
            <span class="mobile-stock-card__label">등락률</span>
            <span class="mobile-stock-card__value">${escapeHtml(String(change))}</span>
          </div>
        </div>
      </article>
    `
  }).join('')
}

function sortedRows(rows) {
  return [...rows].sort((a, b) => {
    if (state.sortKey === 'netSell') return a.netAmount - b.netAmount
    if (state.sortKey === 'buyStreak') return b.buyStreak - a.buyStreak || b.netAmount - a.netAmount
    if (state.sortKey === 'sellStreak') return b.sellStreak - a.sellStreak || a.netAmount - b.netAmount
    if (state.sortKey === 'buyToMarketCap') return (b.buyToMarketCap ?? -1) - (a.buyToMarketCap ?? -1) || b.netAmount - a.netAmount
    if (state.sortKey === 'marketCapAsc') return (a.marketCap ?? Number.MAX_SAFE_INTEGER) - (b.marketCap ?? Number.MAX_SAFE_INTEGER)
    return b.netAmount - a.netAmount
  })
}

function rowsForSort() {
  const rows = activePensionRows()
  if (state.sortKey === 'netSell' || state.sortKey === 'sellStreak') return rows.filter((row) => row.netAmount < 0)
  if (state.sortKey === 'marketCapAsc') return rows.filter((row) => row.netAmount > 0 && row.marketCap)
  return rows.filter((row) => row.netAmount > 0)
}

function sortLabel() {
  const labels = {
    netBuy: '순매수금액',
    netSell: '순매도금액',
    buyStreak: '연속 순매수',
    sellStreak: '연속 순매도',
    buyToMarketCap: '시총대비 매수금액',
    marketCapAsc: '시가총액 작은순',
  }
  return labels[state.sortKey] ?? '순매수금액'
}

function streakLabel(row) {
  if (state.sortKey === 'sellStreak' || row.netAmount < 0) return `${row.sellStreak || 0}일`
  return `${row.buyStreak || 0}일`
}

function rankingMetaText(visibleCount, totalCount) {
  const tradeDays = state.meta?.files?.length ?? state.dates.length
  const marketCapCount = state.stockMeta.size
  const periodDays = pensionPeriodDates().length
  return [
    state.currentDate ? `${formatDateId(state.currentDate)} 기준` : '기준일 확인 중',
    `${sortLabel()} · ${visibleCount.toLocaleString('ko-KR')} / ${totalCount.toLocaleString('ko-KR')}개`,
    periodDays ? `최근 ${periodDays.toLocaleString('ko-KR')}거래일 누적` : `누적 ${tradeDays.toLocaleString('ko-KR')}거래일`,
    `시총 ${marketCapCount.toLocaleString('ko-KR')}개`,
  ].join(' · ')
}

function rankedRowsForCurrentSort() {
  return sortedRows(rowsForSort()).map((row, index) => ({ ...row, absoluteRank: index + 1 }))
}

function updateStockTable() {
  const query = state.query.trim().toLowerCase()
  const rankedRows = rankedRowsForCurrentSort()
  state.filteredRows = query
    ? rankedRows.filter((row) => row.name.toLowerCase().includes(query) || row.ticker.includes(query))
    : rankedRows

  const tbody = document.querySelector('#stockTableBody')
  if (state.filteredRows.length === 0) {
    const message = query ? '검색 결과가 없습니다.' : '표시할 데이터가 없습니다.'
    renderTableState(tbody, message, { tone: 'empty' })
    renderMobileStockState(message, 'empty')
    document.querySelector('#rankingMeta').textContent = rankingMetaText(0, 0)
    document.querySelector('#loadMoreButton').hidden = true
    updateResultStatus(0)
    return
  }

  const visibleRows = state.filteredRows.slice(0, state.visibleLimit)
  tbody.innerHTML = visibleRows.map((row) => `
    <tr>
      <td data-label="순위"><span class="rank-pill">${row.absoluteRank}</span></td>
      <td data-label="종목">
        <div class="stock-name">
          <a href="https://finance.naver.com/item/main.naver?code=${row.ticker}" target="_blank" rel="noreferrer">${escapeHtml(row.name)}</a>
          <small>${escapeHtml(row.ticker)} · ${escapeHtml(row.investor)}</small>
        </div>
      </td>
      <td data-label="수급금액" class="value ${row.netAmount >= 0 ? 'up' : 'down'}">${formatMoney(row.netAmount)}원<small>${sortLabel()}</small></td>
      <td data-label="수급수량">${formatNumber(row.netVolume)}주</td>
      <td data-label="매수금액">${formatMoney(row.buyAmount)}원</td>
      <td data-label="시가총액">${escapeHtml(row.marketCapLabel || '-')}</td>
      <td data-label="매수/시총">${formatPercentRatio(row.buyToMarketCap)}</td>
      <td data-label="연속일">${streakLabel(row)}</td>
      <td data-label="미니 차트">${sparkline(stockTrend(row), row.netAmount >= 0 ? 'up' : 'down')}</td>
    </tr>
  `).join('')

  const remaining = Math.max(state.filteredRows.length - visibleRows.length, 0)
  const loadMoreButton = document.querySelector('#loadMoreButton')
  document.querySelector('#rankingMeta').textContent = rankingMetaText(visibleRows.length, state.filteredRows.length)
  loadMoreButton.hidden = remaining === 0
  loadMoreButton.textContent = `아래로 20개 더 보기 ↓ (${remaining.toLocaleString('ko-KR')}개 남음)`
  renderMobileStockList(visibleRows)
  updateResultStatus(visibleRows.length)
}

function updateSearchResults() {
  const container = document.querySelector('#searchResults')
  const query = state.query.trim().toLowerCase()

  if (!query) {
    container.hidden = true
    container.innerHTML = ''
    updateResultStatus(state.filteredRows.length)
    return
  }

  const matches = rankedRowsForCurrentSort()
    .filter((row) => row.name.toLowerCase().includes(query) || row.ticker.includes(query))
    .slice(0, 8)

  container.hidden = false
  if (matches.length === 0) {
    container.innerHTML = '<div class="search-result-head"><span>검색 결과 없음</span></div>'
    updateResultStatus(0)
    return
  }
  updateResultStatus(matches.length)

  container.innerHTML = `
    <div class="search-result-head">
      <span>검색 결과</span>
      <b>${matches.length}개 표시</b>
    </div>
    <ol class="search-result-list">
      ${matches.map((row) => `
        <li>
          <div>
            <button type="button" data-search-ticker="${row.ticker}">${escapeHtml(row.name)}</button>
            <small>${row.absoluteRank}위 · ${escapeHtml(row.ticker)} · ${row.netAmount >= 0 ? '순매수' : '순매도'} · ${row.netAmount >= 0 ? row.buyStreak : row.sellStreak}일</small>
          </div>
          <b class="${row.netAmount >= 0 ? 'value up' : 'value down'}">${formatMoney(row.netAmount)}원</b>
          ${sparkline(stockTrend(row), row.netAmount >= 0 ? 'up' : 'down')}
        </li>
      `).join('')}
    </ol>
  `
}

function renderStockViews() {
  if (!state.meta) return
  renderThemeSections()
  renderMarketInsights()
  renderPensionSections()
  renderUsMarket()
  renderUsThemeSections()
  renderUsFlowSections()
  updateSearchResults()
  updateStockTable()
}

function setPensionSection(section) {
  state.pensionSection = section
  state.visibleLimit = 20

  document.querySelectorAll('#pensionSubTabs button').forEach((item) => {
    setActiveState(item, item.dataset.pensionSection === section)
  })
  document.querySelectorAll('[data-pension-pane]').forEach((pane) => {
    setPanelActive(pane, pane.dataset.pensionPane === section)
  })

  syncControlBar()
  updateSearchResults()
  updateStockTable()
}

function setEtfSection(section) {
  state.etfSection = section
  state.selectedHolding = null
  state.etfVisibleLimit = 20

  if (section === 'theme') {
    state.etfQuery = ''
    state.etfTheme ||= etfThemes[0][0]
  } else {
    state.etfTheme = null
    if (section === 'us') state.etfQuery = ''
  }

  document.querySelector('#etfSearch').value = state.etfQuery
  document.querySelectorAll('#etfSubTabs button').forEach((item) => {
    setActiveState(item, item.dataset.etfSection === section)
  })
  document.querySelectorAll('[data-etf-pane]').forEach((pane) => {
    setPanelActive(pane, pane.dataset.etfPane === section)
  })
  syncControlBar()
  renderEtfList()
  renderEtfDetail()
}

function selectEtfFromPanel(code) {
  state.selectedEtfCode = code
  state.selectedHolding = null

  if (!filteredEtfs().some((item) => item.code === code)) {
    state.etfSection = 'search'
    state.etfTheme = null
    state.etfQuery = ''
    setEtfSection('search')
    state.selectedEtfCode = code
  }

  renderEtfList()
  renderEtfDetail()
  document.querySelector('.etf-layout').scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}

function setActiveState(button, active) {
  button.classList.toggle('active', active)
  if (button.getAttribute('role') === 'tab') {
    button.setAttribute('aria-selected', active ? 'true' : 'false')
    return
  }
  button.setAttribute('aria-pressed', active ? 'true' : 'false')
}

function bindControls() {
  document.querySelector('#viewTabs').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-view]')
    if (!button) return
    state.view = button.dataset.view
    document.querySelectorAll('#viewTabs button').forEach((item) => setActiveState(item, item === button))
    document.querySelectorAll('.view').forEach((view) => setPanelActive(view, view.id === `${button.dataset.view}View`))
    syncControlBar()
  })

  document.querySelector('#chartPeriodTabs').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-chart-period]')
    if (!button) return
    state.chartPeriod = Number(button.dataset.chartPeriod)
    state.visibleLimit = 20
    document.querySelectorAll('#chartPeriodTabs button').forEach((item) => setActiveState(item, item === button))
    renderEtfSections()
    renderStockViews()
  })

  document.querySelector('#stockCountryTabs').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-stock-country]')
    if (!button) return
    state.stockCountry = button.dataset.stockCountry
    document.querySelectorAll('#stockCountryTabs button').forEach((item) => setActiveState(item, item === button))
    document.querySelectorAll('[data-stock-country-pane]').forEach((pane) => {
      setPanelActive(pane, pane.dataset.stockCountryPane === state.stockCountry)
    })
    syncControlBar()
  })

  document.querySelector('#krStockSubTabs').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-kr-stock-section]')
    if (!button) return
    state.krStockSection = button.dataset.krStockSection
    document.querySelectorAll('#krStockSubTabs button').forEach((item) => setActiveState(item, item === button))
    document.querySelectorAll('[data-kr-stock-pane]').forEach((pane) => {
      setPanelActive(pane, pane.dataset.krStockPane === state.krStockSection)
    })
    syncControlBar()
  })

  document.querySelector('#usStockSubTabs').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-us-stock-section]')
    if (!button) return
    state.usStockSection = button.dataset.usStockSection
    document.querySelectorAll('#usStockSubTabs button').forEach((item) => setActiveState(item, item === button))
    document.querySelectorAll('[data-us-stock-pane]').forEach((pane) => {
      setPanelActive(pane, pane.dataset.usStockPane === state.usStockSection)
    })
    syncControlBar()
  })

  document.querySelector('#pensionSubTabs').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-pension-section]')
    if (!button) return
    setPensionSection(button.dataset.pensionSection)
  })

  document.querySelector('#themeSectionGrid').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action="theme-detail"]')
    if (!button) return
    state.selectedTheme = button.dataset.value
    renderThemeDetail()
    document.querySelector('#themeDetail').scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  })

  document.querySelector('#usThemeGrid').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action="us-theme-detail"]')
    if (!button) return
    state.selectedUsTheme = button.dataset.value
    renderUsThemeDetail()
    document.querySelector('#usThemeDetail').scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  })

  document.querySelector('#marketSearch').addEventListener('input', (event) => {
    state.marketQuery = event.target.value
    updateMarketSearchResults()
  })

  document.querySelector('#marketSearchResults').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-market-search-ticker]')
    if (!button) return
    const item = isUsMarketView()
      ? usStockUniverse.find((stock) => stock.symbol === button.dataset.marketSearchTicker)
      : stockMetaItems().find((stock) => stock.ticker === button.dataset.marketSearchTicker)
    if (!item) return
    state.marketQuery = item.name
    document.querySelector('#marketSearch').value = item.name
    updateMarketSearchResults()
  })

  document.querySelector('#stockSearch').addEventListener('input', (event) => {
    state.query = event.target.value
    state.visibleLimit = 20
    updateSearchResults()
    updateStockTable()
  })

  document.querySelector('#sortRow').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-sort]')
    if (!button) return
    state.sortKey = button.dataset.sort
    state.visibleLimit = 20
    document.querySelectorAll('#sortRow button').forEach((item) => setActiveState(item, item === button))
    updateSearchResults()
    updateStockTable()
  })

  document.querySelector('#searchResults').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-search-ticker]')
    if (!button) return
    const row = rankedRowsForCurrentSort().find((item) => item.ticker === button.dataset.searchTicker)
    if (!row) return
    state.query = row.name
    state.visibleLimit = 20
    document.querySelector('#stockSearch').value = row.name
    updateSearchResults()
    updateStockTable()
  })

  document.querySelector('#loadMoreButton').addEventListener('click', () => {
    state.visibleLimit += 20
    updateStockTable()
  })

  document.querySelector('#etfSubTabs').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-etf-section]')
    if (!button) return
    setEtfSection(button.dataset.etfSection)
  })

  document.querySelector('#etfSearch').addEventListener('input', (event) => {
    state.etfQuery = event.target.value
    state.selectedHolding = null
    state.etfVisibleLimit = 20
    renderEtfList()
    renderEtfDetail()
  })

  document.querySelector('#etfThemeGrid').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]')
    if (!button) return
    if (button.dataset.action === 'etf-theme') {
      state.etfTheme = button.dataset.value
      state.etfQuery = ''
      state.selectedHolding = null
      state.etfVisibleLimit = 20
      document.querySelector('#etfSearch').value = ''
      renderEtfList()
      renderEtfDetail()
      document.querySelector('.etf-layout').scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      return
    }
    if (button.dataset.action === 'etf-select') selectEtfFromPanel(button.dataset.value)
  })

  document.querySelector('#etfUsGrid').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action="etf-select"]')
    if (!button) return
    selectEtfFromPanel(button.dataset.value)
  })

  document.querySelector('#etfList').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-etf-code]')
    if (!button) return
    state.selectedEtfCode = button.dataset.etfCode
    state.selectedHolding = null
    renderEtfList()
    renderEtfDetail()
  })

  document.querySelector('#etfLoadMoreButton').addEventListener('click', () => {
    state.etfVisibleLimit += 20
    renderEtfList()
  })

  document.querySelector('#etfDetail').addEventListener('click', (event) => {
    const holdingButton = event.target.closest('button[data-holding-key]')
    if (holdingButton) {
      state.selectedHolding = holdingButton.dataset.holdingKey
      renderEtfDetail()
      return
    }

    const etfButton = event.target.closest('button[data-etf-code]')
    if (etfButton) {
      selectEtfFromPanel(etfButton.dataset.etfCode)
    }
  })

  syncControlBar()
}

async function loadKrxData() {
  const indexResponse = await fetch(withCacheBust(DATA_INDEX_URL), { cache: 'no-store' })
  if (!indexResponse.ok) throw new Error(`KRX index load failed: ${indexResponse.status}`)
  const index = await indexResponse.json()
  const files = [...(index.files ?? [])].sort((a, b) => b.date.localeCompare(a.date))
  const latest = index.latest || files[0]?.date
  if (!latest || files.length === 0) throw new Error('KRX CSV file is missing from index.json')

  state.stockMeta = await loadStockMeta()

  const parsedEntries = await Promise.all(files.map(async (fileMeta) => {
    const csvResponse = await fetch(withCacheBust(`${DATA_BASE_URL}/${fileMeta.file}`), { cache: 'no-store' })
    if (!csvResponse.ok) throw new Error(`KRX CSV load failed: ${csvResponse.status}`)
    return [fileMeta.date, parseKrxCsv(await csvResponse.text())]
  }))

  state.meta = { ...index, latest }
  state.dates = parsedEntries.map(([date]) => date)
  state.currentDate = latest
  state.rowsByDate = new Map(parsedEntries.map(([date, rows]) => [date, new Map(rows.map((row) => [row.ticker, row]))]))
  const latestRows = parsedEntries.find(([date]) => date === latest)?.[1] ?? parsedEntries[0][1]
  state.rows = enrichRows(latestRows)
  const expectedLatest = currentDataStatus.expectedKrxLatest
  const isKrxStale = expectedLatest && latest < expectedLatest
  if (isKrxStale) {
    recordDataWarning('krx', `KRX 기준일이 예상 거래일보다 늦습니다: latest=${latest}, expected=${expectedLatest}`)
  }
  setDataSource('krx', {
    state: isKrxStale ? 'warning' : 'live',
    detail: `${formatDateId(latest)} 기준${expectedLatest ? ` · 예상 ${formatDateId(expectedLatest)}` : ''} · ${files.length.toLocaleString('ko-KR')}거래일 · 최신 ${latestRows.length.toLocaleString('ko-KR')}행`,
  })
}

async function loadMarketIndex() {
  try {
    const response = await fetch(withCacheBust(MARKET_INDEX_URL), { cache: 'no-store' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const payload = await response.json()
    if (!Array.isArray(payload) || payload.length === 0) throw new Error('시장지표 배열이 비어 있습니다')
    const updatedAt = latestTimestamp(payload.map((item) => item.updatedAt))
    setDataSource('marketIndex', {
      state: 'live',
      detail: `${payload.length.toLocaleString('ko-KR')}개 지표${updatedAt ? ` · 갱신 ${formatDateTime(updatedAt)}` : ''}`,
    })
    return payload
  } catch (error) {
    recordDataFallback('market-index', error)
    setDataSource('marketIndex', {
      state: 'fallback',
      detail: `시장지표 로딩 실패: ${error.message}. 내장 백업 ${fallbackMarketIndex.length.toLocaleString('ko-KR')}개 사용`,
    })
    return fallbackMarketIndex
  }
}

async function loadNaverMarket() {
  try {
    const response = await fetch(withCacheBust(NAVER_MARKET_URL), { cache: 'no-store' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const payload = await response.json()
    if (!payload || typeof payload !== 'object') throw new Error('응답이 객체가 아닙니다')
    const domesticCount = Object.values(payload.domestic ?? {}).reduce((sum, items) => sum + (Array.isArray(items) ? items.length : 0), 0)
    const themeCount = Object.values(payload.themes ?? {}).reduce((sum, items) => sum + (Array.isArray(items) ? items.length : 0), 0)
    const usCount = Object.values(payload.us ?? {}).reduce((sum, items) => sum + (Array.isArray(items) ? items.length : 0), 0)
    setDataSource('naverMarket', {
      state: 'live',
      detail: `국내 ${domesticCount.toLocaleString('ko-KR')}개 · 테마 ${themeCount.toLocaleString('ko-KR')}개 · 미국 ${usCount.toLocaleString('ko-KR')}개 · 생성 ${formatDateTime(payload.generatedAt) ?? '-'}`,
    })
    return payload
  } catch (error) {
    recordDataFallback('naver-market', error)
    setDataSource('naverMarket', {
      state: 'fallback',
      detail: `Naver 마켓 로딩 실패: ${error.message}. KRX/내장 백업 랭킹 사용`,
    })
    return null
  }
}

async function loadStockMeta() {
  const meta = builtinStockMeta()

  try {
    const response = await fetch(withCacheBust(STOCK_META_URL), { cache: 'no-store' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const payload = await response.json()
    const entries = Array.isArray(payload) ? payload : Object.entries(payload).map(([ticker, value]) => ({ ticker, ...value }))
    if (entries.length === 0) throw new Error('종목 메타데이터 없음')

    let loadedCount = 0
    let latestTradeDate = null
    let latestUpdatedAt = null
    entries.forEach((item) => {
      if (!item.ticker || !item.marketCap) return
      const marketCap = Number(item.marketCap)
      if (!marketCap) return
      const ticker = String(item.ticker).padStart(6, '0')
      const priceHistory = Array.isArray(item.priceHistory) ? item.priceHistory : []
      const amountHistory = Array.isArray(item.amountHistory) ? item.amountHistory : []
      const dayTrend = Array.isArray(item.dayTrend) ? item.dayTrend.map(Number).filter(Number.isFinite) : []
      const historyPrice = priceHistory.length > 0 ? Number(priceHistory.at(-1)?.[1]) : null
      meta.set(ticker, {
        ...item,
        ticker,
        name: item.name ?? meta.get(ticker)?.name,
        market: item.market ?? meta.get(ticker)?.market,
        sector: item.sector ?? meta.get(ticker)?.sector,
        marketCap,
        marketCapLabel: item.marketCapLabel ?? formatMarketCap(marketCap),
        price: Number(item.price) || historyPrice || null,
        changeRate: Number(item.changeRate) || 0,
        volume: Number(item.volume) || 0,
        amount: Number(item.amount) || 0,
        listedShares: Number(item.listedShares) || 0,
        priceHistory,
        amountHistory,
        dayTrend,
        latestCandle: item.latestCandle ?? null,
        chartSource: item.chartSource,
      })
      loadedCount += 1
      if (item.tradeDate && (!latestTradeDate || String(item.tradeDate) > latestTradeDate)) latestTradeDate = String(item.tradeDate)
      const updatedAtTime = Date.parse(item.updatedAt)
      if (Number.isFinite(updatedAtTime) && (!latestUpdatedAt || updatedAtTime > Date.parse(latestUpdatedAt))) latestUpdatedAt = item.updatedAt
    })

    if (loadedCount === 0) throw new Error('종목 메타데이터 없음')
    setDataSource('stockMeta', {
      state: 'live',
      detail: `${loadedCount.toLocaleString('ko-KR')}개 종목${latestTradeDate ? ` · 기준 ${formatDateId(latestTradeDate)}` : ''}${latestUpdatedAt ? ` · 생성 ${formatDateTime(latestUpdatedAt)}` : ''}`,
    })
  } catch (error) {
    recordDataWarning('stock-meta', error)
    setDataSource('stockMeta', {
      state: 'sample',
      detail: `종목 메타데이터 없음: ${error.message}. 내장 샘플 ${meta.size.toLocaleString('ko-KR')}개로 시총/차트 제한`,
    })
    return meta
  }

  return meta
}

async function loadUsStocks() {
  try {
    const response = await fetch(withCacheBust(US_STOCKS_URL), { cache: 'no-store' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const payload = await response.json()
    if (!Array.isArray(payload.stocks) || payload.stocks.length === 0) throw new Error('미국 주식 배열이 비어 있습니다')
    usStockUniverse = payload.stocks.map(normalizeLoadedUsStock).filter((item) => item.symbol && item.name)
    setDataSource('usStocks', {
      state: 'live',
      detail: `${usStockUniverse.length.toLocaleString('ko-KR')}개 종목 · 생성 ${formatDateTime(payload.generatedAt) ?? '-'}`,
    })
  } catch (error) {
    usStockUniverse = usStocks.map(normalizeLoadedUsStock)
    recordDataFallback('us-stocks', error)
    setDataSource('usStocks', {
      state: 'sample',
      detail: `미국 주식 로딩 실패: ${error.message}. 내장 샘플 ${usStockUniverse.length.toLocaleString('ko-KR')}개 사용`,
    })
  }
}

async function loadEtfUniverse() {
  try {
    const response = await fetch(withCacheBust(ETF_UNIVERSE_URL), { cache: 'no-store' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const payload = await response.json()
    if (!Array.isArray(payload.etfs) || payload.etfs.length === 0) throw new Error('ETF 배열이 비어 있습니다')

    etfUniverse = payload.etfs
      .map(normalizeLoadedEtf)
      .filter((item) => item.code && item.name)

    if (!etfUniverse.some((item) => item.code === state.selectedEtfCode)) {
      state.selectedEtfCode = etfUniverse[0]?.code ?? null
    }
    setDataSource('etfs', {
      state: 'live',
      detail: `${etfUniverse.length.toLocaleString('ko-KR')}개 ETF · 구성종목 ${Number(payload.holdingCount ?? 0).toLocaleString('ko-KR')}개 · 생성 ${formatDateTime(payload.generatedAt) ?? '-'}`,
    })
  } catch (error) {
    etfUniverse = fallbackEtfUniverse.map(normalizeLoadedEtf)
    recordDataFallback('etf-universe', error)
    setDataSource('etfs', {
      state: 'sample',
      detail: `ETF 로딩 실패: ${error.message}. 내장 샘플 ${etfUniverse.length.toLocaleString('ko-KR')}개 사용`,
    })
  }
}

async function loadUpdateStatus() {
  try {
    const response = await fetch(withCacheBust(UPDATE_STATUS_URL), { cache: 'no-store' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const payload = await response.json()
    if (!payload || typeof payload !== 'object') throw new Error('자동갱신 상태 응답이 객체가 아닙니다')
    mergeLoadedDataStatus(currentDataStatus, { updateStatus: payload })
    currentDataStatus.updateWorkflowGeneratedAt = payload.generatedAt || currentDataStatus.updateWorkflowGeneratedAt
    if (payload.status === 'error') {
      addDataError(currentDataStatus, 'update-status', new Error(payload.error || '최근 자동갱신 실패'))
    } else if (payload.status === 'partial') {
      addDataWarning(currentDataStatus, 'update-status', '최근 자동갱신에서 일부 선택 작업을 건너뜀')
    }
    setDataSource('updateStatus', {
      state: payload.status === 'partial' ? 'warning' : payload.status === 'error' ? 'error' : 'live',
      detail: `상태 ${payload.status ?? 'ok'}${payload.generatedAt ? ` · 생성 ${formatDateTime(payload.generatedAt)}` : ''}${payload.expectedKrxLatestTradeDate ? ` · KRX 예상 ${formatDateId(payload.expectedKrxLatestTradeDate)}` : ''}`,
    })
    return payload
  } catch (error) {
    recordDataWarning('update-status', error)
    setDataSource('updateStatus', {
      state: 'warning',
      detail: `자동갱신 상태 확인 실패: ${error.message}`,
    })
    return null
  }
}

async function main() {
  currentDataStatus = createInitialDataStatus()
  appDataStatus = currentDataStatus
  try {
    initAdminDataStatusToggle()
    bindControls()
    renderDataStatus()
    renderTableState(document.querySelector('#stockTableBody'), '데이터를 불러오는 중입니다.')
    renderMobileStockState('데이터를 불러오는 중입니다.')
    await loadUpdateStatus()
    await loadUsStocks()
    await loadEtfUniverse()
    renderEtfSections()
    state.marketIndex = await loadMarketIndex()
    state.naverMarket = await loadNaverMarket()
    await loadKrxData()
    mergeLoadedDataStatus(currentDataStatus, {
      krxIndex: state.meta,
      naverMarket: state.naverMarket,
      marketIndex: state.marketIndex,
    })
    renderSummary()
    renderThemeSections()
    renderMarketInsights()
    renderPensionSections()
    renderUsMarket()
    renderUsThemeSections()
    renderUsFlowSections()
    updateStockTable()
  } catch (error) {
    recordDataError('app-init', error)
    currentDataStatus.hasFatalError = true
    setDataSource('krx', {
      state: 'error',
      detail: `핵심 데이터 로딩 실패: ${error.message}`,
    })
    document.querySelector('#themeSectionGrid').innerHTML = renderListPanel({ title: '데이터 오류', meta: 'error', items: [] })
    document.querySelector('#marketInsightGrid').innerHTML = ''
    document.querySelector('#marketRankingGrid').innerHTML = ''
    document.querySelector('#pensionSectionGrid').innerHTML = ''
    document.querySelector('#usMarketGrid').innerHTML = ''
    renderTableState(document.querySelector('#stockTableBody'), '데이터를 불러오지 못했습니다. 잠시 후 다시 시도하세요.', { tone: 'error' })
    renderMobileStockState('데이터를 불러오지 못했습니다. 잠시 후 다시 시도하세요.', 'error')
  } finally {
    finalizeDataStatus(currentDataStatus, {
      krxIndex: state.meta,
      naverMarket: state.naverMarket,
      marketIndex: state.marketIndex,
    })
    updateDataStatusPanel(currentDataStatus)
    initAdminDataStatusToggle()
  }
}

main()
