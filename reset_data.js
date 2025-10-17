const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 데이터베이스 파일 경로
const dbPath = path.join(__dirname, 'stock_market.db');

// 데이터베이스 연결
const db = new sqlite3.Database(dbPath);

console.log('데이터베이스 리셋을 시작합니다...');

// 모든 투자 기록 삭제
db.run('DELETE FROM investments', (err) => {
  if (err) {
    console.error('투자 기록 삭제 실패:', err);
  } else {
    console.log('투자 기록이 삭제되었습니다.');
  }
});

// 주가를 초기값으로 리셋
const initialPrices = [
  { team_id: 1, team_name: 'TJR', price: 1000 },
  { team_id: 2, team_name: 'HZMB', price: 1000 },
  { team_id: 3, team_name: 'KHH', price: 1000 },
  { team_id: 4, team_name: 'JCPK', price: 1000 },
  { team_id: 5, team_name: 'JMAI', price: 1000 },
  { team_id: 6, team_name: '6조', price: 1000 },
  { team_id: 7, team_name: 'FKR', price: 1000 },
  { team_id: 8, team_name: 'YWSH', price: 1000 }
];

let completed = 0;
initialPrices.forEach(team => {
  db.run(`
    UPDATE stock_prices 
    SET current_price = ?, 
        previous_price = ?, 
        change_percent = 0,
        timestamp = CURRENT_TIMESTAMP
    WHERE team_id = ?
  `, [team.price, team.price, team.team_id], (err) => {
    if (err) {
      console.error(`${team.team_name} 주가 리셋 실패:`, err);
    } else {
      console.log(`${team.team_name} 주가가 1000원으로 리셋되었습니다.`);
    }
    
    completed++;
    if (completed === initialPrices.length) {
      console.log('데이터베이스 리셋이 완료되었습니다!');
      db.close();
    }
  });
});
