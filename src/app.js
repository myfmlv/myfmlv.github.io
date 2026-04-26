const DATA_INDEX_URL = './data/krx/index.json'
const DATA_BASE_URL = './data/krx'

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

const state = {
  view: 'stock',
  rows: [],
  filteredRows: [],
  rowsByDate: new Map(),
  dates: [],
  currentDate: null,
  stockMeta: new Map(),
  marketIndex: fallbackMarketIndex,
  stockCountry: 'kr',
  krStockSection: 'market',
  pensionSection: 'trend',
  selectedTheme: themeUp[0][0],
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
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

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
  return Number(String(value ?? '').replace(/[^0-9.-]/g, '')) || 0
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
  return value.toLocaleString('ko-KR')
}

function formatPercentRatio(value) {
  if (value === null || value === undefined) return '-'
  return `${(value * 100).toFixed(3)}%`
}

function formatSignedPercent(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  const sign = number > 0 ? '+' : ''
  return `${sign}${number.toFixed(2)}%`
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

function formatUsd(value) {
  if (!value) return '-'
  return `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
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
  const source = (Array.isArray(values) ? values : [0]).map(Number).filter(Number.isFinite)
  const period = Number(state.chartPeriod) || 5
  if (source.length === 0) return [0, 0]
  if (period === 1) return source.slice(-2)
  if (source.length > period) return source.slice(-period)
  return source
}

function sparkline(values, tone = 'neutral') {
  const chartData = chartValues(values)
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
    latestCandle: item.latestCandle ?? null,
    holdings: Array.isArray(item.holdings) ? item.holdings : [],
    source: String(item.source ?? '로컬 ETF 데이터'),
  }
}

function etfTrend(item) {
  if (state.chartPeriod === 1 && Array.isArray(item.dayTrend) && item.dayTrend.length >= 2) {
    return item.dayTrend
  }

  return item.trend
}

function historyValues(item) {
  if (!Array.isArray(item?.priceHistory)) return []
  return item.priceHistory
    .map((entry) => Array.isArray(entry) ? Number(entry[1]) : Number(entry))
    .filter(Number.isFinite)
}

function stockTrend(item) {
  if (state.chartPeriod === 1 && Array.isArray(item?.dayTrend) && item.dayTrend.length >= 2) {
    return item.dayTrend.map(Number).filter(Number.isFinite)
  }

  const history = historyValues(item)
  if (history.length > 0) return history
  if (Array.isArray(item?.trend) && item.trend.length > 0) return item.trend
  return seedTrend(item?.ticker ?? item?.symbol ?? item?.name ?? '', Number(item?.changeRate) < 0 ? 'down' : 'up')
}

function stockChangeAmount(item) {
  const history = historyValues(item)
  if (history.length >= 2) {
    return Math.round((history.at(-1) - history.at(-2)) * 100) / 100
  }

  if (Array.isArray(item?.dayTrend) && item.dayTrend.length >= 2) {
    const values = item.dayTrend.map(Number).filter(Number.isFinite)
    return Math.round((values.at(-1) - values[0]) * 100) / 100
  }

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
  return state.pensionSection === 'search' ? aggregatePensionRowsForPeriod() : state.rows
}

function staticItems(items, tone = 'up', formatter = (value) => `${value}%`) {
  return items.map(([name, value, trend], index) => ({
    rank: index + 1,
    name,
    sub: `${themeStockSeeds[name]?.length ?? 0}종목`,
    value: formatter(value),
    tone: value < 0 ? 'down' : tone,
    trend,
    action: 'theme-detail',
    actionValue: name,
  }))
}

function themeStocks(themeName) {
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

function marketCapItems() {
  const items = stockMetaItems()
    .filter((item) => item.marketCap && item.name)
    .sort((a, b) => b.marketCap - a.marketCap)
    .slice(0, 10)

  if (items.length > 0) {
    return items.map((item, index) => ({
      rank: index + 1,
      name: item.name,
      sub: `${item.ticker} · ${item.market || 'KRX'}`,
      href: `https://finance.naver.com/item/main.naver?code=${item.ticker}`,
      value: item.marketCapLabel ?? formatMarketCap(item.marketCap),
      tone: item.changeRate > 0 ? 'up' : item.changeRate < 0 ? 'down' : 'neutral',
      trend: stockTrend(item),
    }))
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
  if (mode === 'sell') {
    return [...state.rows]
      .filter((row) => row.netAmount < 0)
      .sort((a, b) => a.netAmount - b.netAmount)
  }

  if (mode === 'buyStreak') {
    return [...state.rows]
      .filter((row) => row.netAmount > 0)
      .sort((a, b) => b.buyStreak - a.buyStreak || b.netAmount - a.netAmount)
  }

  if (mode === 'buyToMarketCap') {
    return [...state.rows]
      .filter((row) => row.netAmount > 0 && row.buyToMarketCap !== null)
      .sort((a, b) => b.buyToMarketCap - a.buyToMarketCap || b.netAmount - a.netAmount)
  }

  return [...state.rows]
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
      trend: seedTrend(group.market, group.up >= group.down ? 'up' : 'down'),
    }))

  const indexItems = state.marketIndex.map((item, index) => ({
    rank: marketItems.length + index + 1,
    name: item.name,
    sub: `${item.change} · ${item.unit}`,
    value: item.value,
    tone: item.tone,
    trend: seedTrend(item.name, item.tone === 'down' ? 'down' : 'up'),
  }))

  return [...marketItems, ...indexItems]
}

function marketRankingItems(mode) {
  const items = stockMetaItems()
    .filter((item) => item.name && item.ticker)
    .sort((a, b) => {
      if (mode === 'up') return (b.changeRate ?? -Infinity) - (a.changeRate ?? -Infinity)
      if (mode === 'down') return (a.changeRate ?? Infinity) - (b.changeRate ?? Infinity)
      return (b.amount ?? 0) - (a.amount ?? 0)
    })
    .slice(0, 10)

  return items.map((item, index) => ({
    rank: index + 1,
    name: item.name,
    sub: `${item.ticker} · ${item.market || 'KRX'} · ${formatPrice(item.price)}`,
    href: `https://finance.naver.com/item/main.naver?code=${item.ticker}`,
    value: mode === 'amount' ? formatMoney(item.amount || 0) : formatSignedPercent(item.changeRate),
    tone: mode === 'down' || item.changeRate < 0 ? 'down' : item.changeRate > 0 ? 'up' : 'neutral',
    trend: stockTrend(item),
  }))
}

function marketSearchItems() {
  return stockMetaItems()
    .filter((item) => item.name && item.ticker)
    .sort((a, b) => (b.amount ?? 0) + (b.marketCap ?? 0) * 0.001 - ((a.amount ?? 0) + (a.marketCap ?? 0) * 0.001))
    .slice(0, 10)
    .map((item, index) => ({
      rank: index + 1,
      name: item.name,
      sub: `${item.ticker} · 검색상위 후보`,
      href: `https://finance.naver.com/item/main.naver?code=${item.ticker}`,
      value: formatSignedPercent(item.changeRate),
      tone: item.changeRate > 0 ? 'up' : item.changeRate < 0 ? 'down' : 'neutral',
      trend: stockTrend(item),
    }))
}

function marketStockSearchResults() {
  const query = state.marketQuery.trim().toLowerCase()
  if (!query) return []

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

function isPensionView() {
  return state.view === 'stock' && state.stockCountry === 'kr' && state.krStockSection === 'pension'
}

function syncControlBar() {
  document.querySelector('#stockCountryTabs').hidden = state.view !== 'stock'
  document.querySelector('#krStockSubTabs').hidden = state.view !== 'stock' || state.stockCountry !== 'kr'
  document.querySelector('#pensionSubTabs').hidden = !isPensionView()
  document.querySelector('#etfSubTabs').hidden = state.view !== 'etf'
  document.querySelector('#marketSearchControl').hidden = !isDomesticMarketView()
  updateMarketSearchResults()
}

function updateMarketSearchResults() {
  const container = document.querySelector('#marketSearchResults')
  const query = state.marketQuery.trim()

  if (!isDomesticMarketView() || !query) {
    container.hidden = true
    container.innerHTML = ''
    return
  }

  const matches = marketStockSearchResults()
  container.hidden = false
  if (matches.length === 0) {
    container.innerHTML = '<div class="search-result-head"><span>검색 결과 없음</span></div>'
    return
  }

  container.innerHTML = `
    <div class="search-result-head">
      <span>검색 결과</span>
      <b>${matches.length}개 표시</b>
    </div>
    <ol class="search-result-list market-result-list">
      ${matches.map((item) => {
        const changeAmount = stockChangeAmount(item)
        const tone = changeAmount < 0 ? 'down' : changeAmount > 0 ? 'up' : 'neutral'
        const changeLabel = changeAmount < 0 ? '하락폭' : changeAmount > 0 ? '상승폭' : '등락폭'
        return `
          <li>
            <div>
              <button type="button" data-market-search-ticker="${escapeHtml(item.ticker)}">${escapeHtml(item.name)}</button>
              <small>${escapeHtml(item.ticker)} · ${escapeHtml(item.market || 'KRX')} · ${escapeHtml(formatPrice(item.price))}</small>
            </div>
            <span class="market-search-metrics">
              <span class="metric"><small>시가총액</small><b>${escapeHtml(item.marketCapLabel || formatMarketCap(item.marketCap))}</b></span>
              <span class="metric"><small>거래대금</small><b>${escapeHtml(formatMoney(item.amount || 0))}원</b></span>
              <span class="metric"><small>${changeLabel}</small><b class="${tone}">${escapeHtml(formatSignedPrice(changeAmount))}<em>${escapeHtml(formatSignedPercent(item.changeRate))}</em></b></span>
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
  return [...usStockUniverse]
    .sort((a, b) => {
      if (mode === 'marketCap') return parseAbbrevValue(b.marketCap) - parseAbbrevValue(a.marketCap)
      if (mode === 'amount') return parseAbbrevValue(b.amount) - parseAbbrevValue(a.amount)
      if (mode === 'search') return b.popularity - a.popularity
      return b.popularity + parseAbbrevValue(b.amount) / 1_000_000_000 - (a.popularity + parseAbbrevValue(a.amount) / 1_000_000_000)
    })
    .slice(0, 10)
    .map((item, index) => ({
      rank: index + 1,
      name: item.name,
      sub: `${item.symbol} · ${item.sector}`,
      href: `https://stock.naver.com/worldstock/stock/${item.naverCode ?? item.symbol}/total`,
      value: mode === 'marketCap'
        ? `$${item.marketCap}`
        : mode === 'amount'
          ? `$${item.amount}`
          : `${item.popularity}점`,
      tone: item.changeRate > 0 ? 'up' : item.changeRate < 0 ? 'down' : 'neutral',
      trend: stockTrend(item),
    }))
}

function renderListPanel({ title, meta, items }) {
  return `
    <article class="list-panel">
      <div class="panel-head">
        <div><p>${escapeHtml(meta)}</p><h2>${escapeHtml(title)}</h2></div>
        <span class="panel-meta">${items.length}개</span>
      </div>
      <ol class="rank-list">
        ${items.map((item) => `
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
  const panels = [
    { title: '상승중인 테마', meta: '테마 상승', items: staticItems(themeUp, 'up') },
    { title: '하락중인 테마', meta: '테마 하락', items: staticItems(themeDown, 'down') },
    { title: '현재 핫한 테마', meta: '관심 테마', items: staticItems(hotThemes, 'up', (value) => `3일 ${value}%`) },
  ]

  document.querySelector('#themeSectionGrid').innerHTML = panels.map(renderListPanel).join('')
  renderThemeDetail()
}

function renderThemeDetail() {
  const themeName = state.selectedTheme ?? themeUp[0][0]
  const rows = themeStocks(themeName)
  document.querySelector('#themeDetail').innerHTML = `
    <div class="panel-head">
      <div>
        <p>테마 구성</p>
        <h2>${escapeHtml(themeName)}</h2>
      </div>
      <span class="panel-meta">${rows.length.toLocaleString('ko-KR')}종목</span>
    </div>
    <ol class="theme-stock-list">
      ${rows.map((row, index) => `
        <li>
          <span class="rank-pill">${index + 1}</span>
          <div class="stock-name">
            <a href="https://finance.naver.com/item/main.naver?code=${row.ticker}" target="_blank" rel="noreferrer">${escapeHtml(row.name)}</a>
            <small>${escapeHtml(row.ticker)} · ${escapeHtml(row.market ?? 'KRX')} · ${escapeHtml((row.tags ?? []).join(', '))}</small>
          </div>
          <b>${formatPrice(row.price)}</b>
          <b class="${row.changeRate >= 0 ? 'value up' : 'value down'}">${formatSignedPercent(row.changeRate)}</b>
          <b>${escapeHtml(row.marketCapLabel || '-')}</b>
          <b>${formatMoney(row.amount || 0)}원</b>
          ${sparkline(row.trend, row.changeRate < 0 ? 'down' : 'up')}
        </li>
      `).join('')}
    </ol>
  `
}

function renderMarketInsights() {
  const panels = [
    { title: '시장 요약', meta: '국내 시장', items: marketSummaryItems() },
    { title: '거래대금 상위', meta: '거래대금', items: marketRankingItems('amount') },
  ]

  document.querySelector('#marketInsightGrid').innerHTML = panels.map(renderListPanel).join('')

  const rankingPanels = [
    { title: '시가총액 상위', meta: '시가총액', items: marketCapItems() },
    { title: '검색 상위', meta: '검색 관심', items: marketSearchItems() },
    { title: '인기 종목', meta: '수급 관심', items: marketPopularItems() },
  ]

  document.querySelector('#marketRankingGrid').innerHTML = rankingPanels.map(renderListPanel).join('')
  updateMarketSearchResults()
}

function renderUsMarket() {
  const panels = [
    { title: '미국 시가총액', meta: '시가총액', items: usStockItems('marketCap') },
    { title: '거래대금 상위', meta: '거래대금', items: usStockItems('amount') },
    { title: '검색 상위', meta: '검색 관심', items: usStockItems('search') },
    { title: '인기 종목', meta: '관심 종목', items: usStockItems('popular') },
  ]

  document.querySelector('#usMarketGrid').innerHTML = panels.map(renderListPanel).join('')
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
    return etfThemes.map(([name, sub, value, trend], index) => {
      const themeItems = etfUniverse.filter((item) => item.themes?.includes(name))
      const amountLeader = [...themeItems].sort((a, b) => b.amount - a.amount)[0]
      const gainLeader = [...themeItems].sort((a, b) => b.changeRate - a.changeRate)[0]
      const themeValue = gainLeader?.changeRate ?? value

      return {
        rank: index + 1,
        name,
        sub: amountLeader?.name ?? sub,
        value: formatSignedPercent(themeValue),
        tone: themeValue >= 0 ? 'up' : 'down',
        trend: amountLeader ? etfTrend(amountLeader) : trend,
        action: 'etf-theme',
        actionValue: name,
      }
    })
  }

  return [...etfUniverse]
    .filter((item) => mode.startsWith('us') ? isUsListedEtf(item) : true)
    .sort((a, b) => {
      if (mode.endsWith('Up')) return b.changeRate - a.changeRate
      return b.amount - a.amount
    })
    .slice(0, 10)
    .map((item, index) => ({
      rank: index + 1,
      name: item.name,
      sub: `${item.code} · ${item.issuer}`,
      value: mode.endsWith('Up') ? formatSignedPercent(item.changeRate) : formatMoney(item.amount),
      tone: item.changeRate >= 0 ? 'up' : 'down',
      trend: etfTrend(item),
      action: 'etf-select',
      actionValue: item.code,
    }))
}

function isUsListedEtf(item) {
  return item.category === '국내상장 미국ETF'
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

function etfsByHolding(holdingTicker) {
  return etfUniverse
    .map((etf) => {
      const holdings = Array.isArray(etf.holdings) ? etf.holdings : []
      const holding = holdings.find(([, ticker]) => ticker === holdingTicker)
      return holding ? { etf, ratio: holding[2] } : null
    })
    .filter(Boolean)
    .sort((a, b) => b.ratio - a.ratio)
}

function renderEtfSections() {
  const themePanels = [
    { title: 'ETF 상승 테마', meta: '테마', items: etfPanelItems('theme') },
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
    return
  }

  document.querySelector('#etfList').innerHTML = visibleItems.map((item) => `
    <li>
      <button class="${item.code === state.selectedEtfCode ? 'active' : ''}" type="button" data-etf-code="${item.code}">
        <span>
          <strong>${escapeHtml(item.name)}</strong>
          <small>${escapeHtml(item.code)} · ${escapeHtml(item.issuer)} · ${escapeHtml(item.category)}</small>
        </span>
        <b class="${item.changeRate >= 0 ? 'up' : 'down'}">${formatSignedPercent(item.changeRate)}</b>
      </button>
    </li>
  `).join('')

  const remaining = Math.max(items.length - visibleItems.length, 0)
  const loadMoreButton = document.querySelector('#etfLoadMoreButton')
  loadMoreButton.hidden = remaining === 0
  loadMoreButton.textContent = `아래로 20개 더 보기 ↓ (${remaining.toLocaleString('ko-KR')}개 남음)`
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
  const selectedHolding = state.selectedHolding ?? holdings[0]?.[1]
  const related = selectedHolding ? etfsByHolding(selectedHolding) : []
  const holdingName = holdings.find(([, ticker]) => ticker === selectedHolding)?.[0] ?? selectedHolding
  const hasHoldings = holdings.length > 0

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
      <div><span>등락률</span><strong class="${item.changeRate >= 0 ? 'up' : 'down'}">${formatSignedPercent(item.changeRate)}</strong></div>
      <div><span>시가총액</span><strong>${formatMarketCap(item.marketCap)}</strong></div>
      <div><span>거래대금</span><strong>${formatMoney(item.amount)}</strong></div>
    </div>
    <div class="chart-card">${sparkline(etfTrend(item), item.changeRate >= 0 ? 'up' : 'down')}</div>
    <div class="holding-grid">
      <section>
        <h3>구성종목</h3>
        ${hasHoldings ? `
          <ol class="holding-list">
            ${holdings.map(([name, ticker, ratio]) => `
              <li>
                <button class="${ticker === selectedHolding ? 'active' : ''}" type="button" data-holding-ticker="${ticker}">
                  <span>${escapeHtml(name)}<small>${escapeHtml(ticker)}</small></span>
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
  // 거래일 선택 UI는 제거하고 최신 거래일 기준만 사용한다.
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
  const periodDays = state.pensionSection === 'search' ? pensionPeriodDates().length : null
  return [
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
    tbody.innerHTML = '<tr><td colspan="9">검색 결과가 없습니다.</td></tr>'
    document.querySelector('#rankingMeta').textContent = rankingMetaText(0, 0)
    document.querySelector('#loadMoreButton').hidden = true
    return
  }

  const visibleRows = state.filteredRows.slice(0, state.visibleLimit)
  tbody.innerHTML = visibleRows.map((row) => `
    <tr>
      <td><span class="rank-pill">${row.absoluteRank}</span></td>
      <td>
        <div class="stock-name">
          <a href="https://finance.naver.com/item/main.naver?code=${row.ticker}" target="_blank" rel="noreferrer">${escapeHtml(row.name)}</a>
          <small>${escapeHtml(row.ticker)} · ${escapeHtml(row.investor)}</small>
        </div>
      </td>
      <td class="value ${row.netAmount >= 0 ? 'up' : 'down'}">${formatMoney(row.netAmount)}원<small>${sortLabel()}</small></td>
      <td>${formatNumber(row.netVolume)}주</td>
      <td>${formatMoney(row.buyAmount)}원</td>
      <td>${escapeHtml(row.marketCapLabel || '-')}</td>
      <td>${formatPercentRatio(row.buyToMarketCap)}</td>
      <td>${streakLabel(row)}</td>
      <td>${sparkline(stockTrend(row), row.netAmount >= 0 ? 'up' : 'down')}</td>
    </tr>
  `).join('')

  const remaining = Math.max(state.filteredRows.length - visibleRows.length, 0)
  const loadMoreButton = document.querySelector('#loadMoreButton')
  document.querySelector('#rankingMeta').textContent = rankingMetaText(visibleRows.length, state.filteredRows.length)
  loadMoreButton.hidden = remaining === 0
  loadMoreButton.textContent = `아래로 20개 더 보기 ↓ (${remaining.toLocaleString('ko-KR')}개 남음)`
}

function updateSearchResults() {
  const container = document.querySelector('#searchResults')
  const query = state.query.trim().toLowerCase()

  if (!query) {
    container.hidden = true
    container.innerHTML = ''
    return
  }

  const matches = rankedRowsForCurrentSort()
    .filter((row) => row.name.toLowerCase().includes(query) || row.ticker.includes(query))
    .slice(0, 8)

  container.hidden = false
  if (matches.length === 0) {
    container.innerHTML = '<div class="search-result-head"><span>검색 결과 없음</span></div>'
    return
  }

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
  updateSearchResults()
  updateStockTable()
}

function setPensionSection(section) {
  state.pensionSection = section
  state.visibleLimit = 20

  document.querySelectorAll('#pensionSubTabs button').forEach((item) => {
    item.classList.toggle('active', item.dataset.pensionSection === section)
  })
  document.querySelectorAll('[data-pension-pane]').forEach((pane) => {
    pane.classList.toggle('active', pane.dataset.pensionPane === section)
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
    item.classList.toggle('active', item.dataset.etfSection === section)
  })
  document.querySelectorAll('[data-etf-pane]').forEach((pane) => {
    pane.classList.toggle('active', pane.dataset.etfPane === section)
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

function bindControls() {
  document.querySelector('#viewTabs').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-view]')
    if (!button) return
    state.view = button.dataset.view
    document.querySelectorAll('#viewTabs button').forEach((item) => item.classList.toggle('active', item === button))
    document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === `${button.dataset.view}View`))
    syncControlBar()
  })

  document.querySelector('#chartPeriodTabs').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-chart-period]')
    if (!button) return
    state.chartPeriod = Number(button.dataset.chartPeriod)
    state.visibleLimit = 20
    document.querySelectorAll('#chartPeriodTabs button').forEach((item) => item.classList.toggle('active', item === button))
    renderEtfSections()
    renderStockViews()
  })

  document.querySelector('#stockCountryTabs').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-stock-country]')
    if (!button) return
    state.stockCountry = button.dataset.stockCountry
    document.querySelectorAll('#stockCountryTabs button').forEach((item) => item.classList.toggle('active', item === button))
    document.querySelectorAll('[data-stock-country-pane]').forEach((pane) => {
      pane.classList.toggle('active', pane.dataset.stockCountryPane === state.stockCountry)
    })
    syncControlBar()
  })

  document.querySelector('#krStockSubTabs').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-kr-stock-section]')
    if (!button) return
    state.krStockSection = button.dataset.krStockSection
    document.querySelectorAll('#krStockSubTabs button').forEach((item) => item.classList.toggle('active', item === button))
    document.querySelectorAll('[data-kr-stock-pane]').forEach((pane) => {
      pane.classList.toggle('active', pane.dataset.krStockPane === state.krStockSection)
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

  document.querySelector('#marketSearch').addEventListener('input', (event) => {
    state.marketQuery = event.target.value
    updateMarketSearchResults()
  })

  document.querySelector('#marketSearchResults').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-market-search-ticker]')
    if (!button) return
    const item = stockMetaItems().find((stock) => stock.ticker === button.dataset.marketSearchTicker)
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
    document.querySelectorAll('#sortRow button').forEach((item) => item.classList.toggle('active', item === button))
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
    const holdingButton = event.target.closest('button[data-holding-ticker]')
    if (holdingButton) {
      state.selectedHolding = holdingButton.dataset.holdingTicker
      renderEtfDetail()
      return
    }

    const etfButton = event.target.closest('button[data-etf-code]')
    if (etfButton) {
      state.selectedEtfCode = etfButton.dataset.etfCode
      state.selectedHolding = null
      renderEtfList()
      renderEtfDetail()
    }
  })

  syncControlBar()
}

async function loadKrxData() {
  const indexResponse = await fetch(DATA_INDEX_URL, { cache: 'no-store' })
  if (!indexResponse.ok) throw new Error(`KRX index load failed: ${indexResponse.status}`)
  const index = await indexResponse.json()
  const files = [...(index.files ?? [])].sort((a, b) => b.date.localeCompare(a.date))
  const latest = index.latest || files[0]?.date
  if (!latest || files.length === 0) throw new Error('KRX CSV file is missing from index.json')

  state.stockMeta = await loadStockMeta()

  const parsedEntries = await Promise.all(files.map(async (fileMeta) => {
    const csvResponse = await fetch(`${DATA_BASE_URL}/${fileMeta.file}`, { cache: 'no-store' })
    if (!csvResponse.ok) throw new Error(`KRX CSV load failed: ${csvResponse.status}`)
    return [fileMeta.date, parseKrxCsv(await csvResponse.text())]
  }))

  state.meta = { ...index, latest }
  state.dates = parsedEntries.map(([date]) => date)
  state.currentDate = latest
  state.rowsByDate = new Map(parsedEntries.map(([date, rows]) => [date, new Map(rows.map((row) => [row.ticker, row]))]))
  state.rows = enrichRows(parsedEntries.find(([date]) => date === latest)?.[1] ?? parsedEntries[0][1])
}

async function loadMarketIndex() {
  try {
    const response = await fetch('./data/market-index.json', { cache: 'no-store' })
    if (!response.ok) return fallbackMarketIndex
    return await response.json()
  } catch {
    return fallbackMarketIndex
  }
}

async function loadStockMeta() {
  const meta = builtinStockMeta()

  try {
    const response = await fetch('./data/stock-meta.json', { cache: 'no-store' })
    if (!response.ok) return meta
    const payload = await response.json()
    const entries = Array.isArray(payload) ? payload : Object.entries(payload).map(([ticker, value]) => ({ ticker, ...value }))

    entries.forEach((item) => {
      if (!item.ticker || !item.marketCap) return
      const marketCap = Number(item.marketCap)
      if (!marketCap) return
      const ticker = String(item.ticker).padStart(6, '0')
      const priceHistory = Array.isArray(item.priceHistory) ? item.priceHistory : []
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
        dayTrend,
        latestCandle: item.latestCandle ?? null,
        chartSource: item.chartSource,
      })
    })
  } catch {
    return meta
  }

  return meta
}

async function loadUsStocks() {
  try {
    const response = await fetch('./data/us-stocks.json', { cache: 'no-store' })
    if (!response.ok) return
    const payload = await response.json()
    if (!Array.isArray(payload.stocks) || payload.stocks.length === 0) return
    usStockUniverse = payload.stocks.map(normalizeLoadedUsStock).filter((item) => item.symbol && item.name)
  } catch {
    usStockUniverse = usStocks.map(normalizeLoadedUsStock)
  }
}

async function loadEtfUniverse() {
  try {
    const response = await fetch('./data/etf-universe.json', { cache: 'no-store' })
    if (!response.ok) return
    const payload = await response.json()
    if (!Array.isArray(payload.etfs) || payload.etfs.length === 0) return

    etfUniverse = payload.etfs
      .map(normalizeLoadedEtf)
      .filter((item) => item.code && item.name)

    if (!etfUniverse.some((item) => item.code === state.selectedEtfCode)) {
      state.selectedEtfCode = etfUniverse[0]?.code ?? null
    }
  } catch {
    etfUniverse = fallbackEtfUniverse.map(normalizeLoadedEtf)
  }
}

async function main() {
  bindControls()
  await loadUsStocks()
  await loadEtfUniverse()
  renderEtfSections()

  try {
    state.marketIndex = await loadMarketIndex()
    await loadKrxData()
    renderSummary()
    renderThemeSections()
    renderMarketInsights()
    renderPensionSections()
    renderUsMarket()
    updateStockTable()
  } catch (error) {
    document.querySelector('#themeSectionGrid').innerHTML = renderListPanel({ title: '데이터 오류', meta: 'error', items: [] })
    document.querySelector('#marketInsightGrid').innerHTML = ''
    document.querySelector('#marketRankingGrid').innerHTML = ''
    document.querySelector('#pensionSectionGrid').innerHTML = ''
    document.querySelector('#usMarketGrid').innerHTML = ''
    document.querySelector('#stockTableBody').innerHTML = `<tr><td colspan="9">${escapeHtml(error.message)}</td></tr>`
  }
}

main()
