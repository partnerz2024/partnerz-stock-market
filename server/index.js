const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/build')));

// 데이터베이스 초기화
const db = new sqlite3.Database('./stock_market.db');

// 테이블 생성
db.serialize(() => {
  // 조별 주가 테이블
  db.run(`CREATE TABLE IF NOT EXISTS stock_prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL,
    team_name TEXT NOT NULL,
    current_price REAL NOT NULL,
    previous_price REAL,
    change_percent REAL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 투자 기록 테이블
  db.run(`CREATE TABLE IF NOT EXISTS investments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 8개 조 초기 데이터 삽입 (티커 코드로 변경)
  const teams = [
    { id: 1, name: 'TJR', price: 1000 },
    { id: 2, name: 'HZMB', price: 1000 },
    { id: 3, name: 'KHH', price: 1000 },
    { id: 4, name: 'JCPK', price: 1000 },
    { id: 5, name: 'JMAI', price: 1000 },
    { id: 6, name: '6조', price: 1000 },
    { id: 7, name: 'FKR', price: 1000 },
    { id: 8, name: 'YWSH', price: 1000 }
  ];

  teams.forEach(team => {
    db.run(`INSERT OR IGNORE INTO stock_prices (team_id, team_name, current_price, previous_price, change_percent) 
            VALUES (?, ?, ?, ?, ?)`, 
            [team.id, team.name, team.price, team.price, 0]);
  });
});

// 주가 변동 함수 (랜덤)

// 투자 입력 API
app.post('/api/invest', (req, res) => {
  const { teamId, amount } = req.body;
  
  if (!teamId || !amount || amount <= 0) {
    return res.status(400).json({ error: '잘못된 투자 정보입니다.' });
  }

  // 투자 기록 저장
  db.run('INSERT INTO investments (team_id, amount) VALUES (?, ?)', [teamId, amount], function(err) {
    if (err) {
      return res.status(500).json({ error: '투자 기록 저장 실패' });
    }

    // 투자한 조만 주가 랜덤 변동 (더 큰 변동)
    const changePercent = (Math.random() - 0.5) * 0.4; // -20% ~ +20%
    
    db.get('SELECT current_price FROM stock_prices WHERE team_id = ?', [teamId], (err, row) => {
      if (err) {
        return res.status(500).json({ error: '주가 조회 실패' });
      }

      const currentPrice = row.current_price;
      const newPrice = currentPrice * (1 + changePercent);
      
      // 투자한 조의 주가만 업데이트
      db.run(`UPDATE stock_prices 
              SET previous_price = current_price, 
                  current_price = ?, 
                  change_percent = ?,
                  timestamp = CURRENT_TIMESTAMP
              WHERE team_id = ?`, 
              [newPrice, changePercent * 100, teamId], (err) => {
        if (err) {
          return res.status(500).json({ error: '주가 업데이트 실패' });
        }

        // 모든 클라이언트에게 실시간 업데이트 전송
        getUpdatedData().then(data => {
          io.emit('stockUpdate', data);
        });

        res.json({ 
          success: true, 
          newPrice: newPrice.toFixed(2),
          changePercent: (changePercent * 100).toFixed(2)
        });
      });
    });
  });
});

// 현재 주가 데이터 조회
app.get('/api/stocks', (req, res) => {
  getUpdatedData().then(data => {
    res.json(data);
  });
});

// 투자 통계 조회
app.get('/api/stats', (req, res) => {
  db.all(`
    SELECT 
      sp.team_id,
      sp.team_name,
      sp.current_price,
      sp.change_percent,
      COALESCE(SUM(inv.amount), 0) as total_investment,
      COUNT(inv.id) as investment_count
    FROM stock_prices sp
    LEFT JOIN investments inv ON sp.team_id = inv.team_id
    GROUP BY sp.team_id, sp.team_name, sp.current_price, sp.change_percent
    ORDER BY total_investment DESC
  `, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: '통계 조회 실패' });
    }
    res.json(rows);
  });
});

// 투자 히스토리 조회
app.get('/api/history', (req, res) => {
  db.all(`
    SELECT 
      i.id,
      i.team_id,
      sp.team_name,
      i.amount,
      i.timestamp,
      sp.current_price as price_at_investment
    FROM investments i
    JOIN stock_prices sp ON i.team_id = sp.team_id
    ORDER BY i.timestamp DESC
    LIMIT 50
  `, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: '히스토리 조회 실패' });
    }
    // 중복 제거를 위해 고유한 키 생성
    const uniqueRows = rows.map((row, index) => ({
      ...row,
      uniqueKey: `${row.id}_${row.timestamp}_${index}`
    }));
    res.json(uniqueRows);
  });
});

// 업데이트된 데이터 조회 함수
function getUpdatedData() {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT 
        sp.team_id,
        sp.team_name,
        sp.current_price,
        sp.previous_price,
        sp.change_percent,
        COALESCE((
          SELECT SUM(amount) 
          FROM investments 
          WHERE team_id = sp.team_id
        ), 0) as total_investment
      FROM stock_prices sp
      ORDER BY sp.team_id
    `, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// Socket.io 연결 처리
io.on('connection', (socket) => {
  console.log('클라이언트 연결됨:', socket.id);
  
  // 연결 시 현재 데이터 전송
  getUpdatedData().then(data => {
    socket.emit('stockUpdate', data);
  });

  socket.on('disconnect', () => {
    console.log('클라이언트 연결 해제:', socket.id);
  });
});

// React 앱 서빙
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});

server.listen(PORT, HOST, () => {
  console.log(`파트너즈 증권 거래소 서버가 http://${HOST}:${PORT} 에서 실행 중입니다.`);
});

// 주기적 랜덤 주가 변동 (30초마다)
setInterval(async () => {
  try {
    // 모든 조의 현재 주가 조회
    const stocks = await new Promise((resolve, reject) => {
      db.all(`
        SELECT team_id, current_price 
        FROM stock_prices 
        ORDER BY team_id
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // 주가 변동 알고리즘 개선 - 균등한 경쟁을 위한 변동
    const totalStocks = stocks.length;
    
    // 주가 순위 계산
    const sortedStocks = [...stocks].sort((a, b) => b.current_price - a.current_price);
    const stockRank = new Map();
    sortedStocks.forEach((stock, index) => {
      stockRank.set(stock.team_id, index + 1);
    });
    
    // 각 조에 대해 균등한 경쟁을 위한 변동 적용
    for (let i = 0; i < stocks.length; i++) {
      const stock = stocks[i];
      const rank = stockRank.get(stock.team_id);
      
      // 기본 변동률 (더 큰 범위)
      let changePercent = (Math.random() - 0.5) * 15; // -7.5% ~ +7.5%
      
      // 순위에 따른 균등화 압력 (1등일수록 하락 압력, 하위권일수록 상승 압력)
      if (rank === 1) {
        // 1등은 강한 하락 압력
        changePercent -= Math.random() * 8 + 2; // -2% ~ -10% 추가 하락
      } else if (rank === 2) {
        // 2등은 약한 하락 압력
        changePercent -= Math.random() * 4 + 1; // -1% ~ -5% 추가 하락
      } else if (rank >= totalStocks - 1) {
        // 하위권은 상승 압력
        changePercent += Math.random() * 6 + 2; // +2% ~ +8% 추가 상승
      } else if (rank >= totalStocks - 2) {
        // 중하위권은 약한 상승 압력
        changePercent += Math.random() * 3 + 1; // +1% ~ +4% 추가 상승
      }
      
      // 상대적 성과에 따른 강한 변동 (다른 팀들과 비교)
      const otherStocks = stocks.filter((_, index) => index !== i);
      const avgOtherPrice = otherStocks.reduce((sum, s) => sum + s.current_price, 0) / otherStocks.length;
      const relativePerformance = (stock.current_price - avgOtherPrice) / avgOtherPrice;
      
      // 상대적으로 높은 주가는 강한 하락 압력, 낮은 주가는 강한 상승 압력
      if (relativePerformance > 0.05) {
        changePercent -= Math.random() * 6 + 2; // -2% ~ -8% 하락 압력
      } else if (relativePerformance < -0.05) {
        changePercent += Math.random() * 6 + 2; // +2% ~ +8% 상승 압력
      }
      
      // 투자액에 따른 변동 (투자액이 많을수록 변동성 증가)
      // 투자액은 별도로 조회해야 함
      const investmentData = await new Promise((resolve, reject) => {
        db.get(`
          SELECT COALESCE(SUM(amount), 0) as total_investment
          FROM investments 
          WHERE team_id = ?
        `, [stock.team_id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      
      const investmentRatio = Math.min(investmentData.total_investment / 50000, 1); // 최대 5만원 기준
      changePercent *= (1 + investmentRatio * 0.8);
      
      // 랜덤 이벤트 (10% 확률로 큰 변동)
      if (Math.random() < 0.1) {
        changePercent += (Math.random() - 0.5) * 25; // -12.5% ~ +12.5% 추가 변동
      }
      
      // 극단적 변동 방지 (한 번에 너무 큰 변동 제한)
      changePercent = Math.max(-20, Math.min(20, changePercent));
      
      const newPrice = stock.current_price * (1 + changePercent / 100);
      
      // 최소 10원, 최대 10000원 범위로 제한
      const finalPrice = Math.max(10, Math.min(10000, newPrice));
      
      // 이전 가격을 현재 가격으로 업데이트하고, 새로운 가격으로 설정
      const changePercentFinal = ((finalPrice - stock.current_price) / stock.current_price) * 100;
      
      await new Promise((resolve, reject) => {
        db.run(`
          UPDATE stock_prices 
          SET previous_price = current_price,
              current_price = ?,
              change_percent = ?,
              timestamp = CURRENT_TIMESTAMP
          WHERE team_id = ?
        `, [finalPrice, changePercentFinal, stock.team_id], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    // 업데이트된 데이터를 모든 클라이언트에게 전송
    const updatedData = await getUpdatedData();
    io.emit('stockUpdate', updatedData);
    
    console.log(`주가 랜덤 변동 완료 - ${new Date().toLocaleTimeString()}`);
  } catch (error) {
    console.error('주가 변동 중 오류:', error);
  }
}, 15000); // 15초마다 실행

process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});
