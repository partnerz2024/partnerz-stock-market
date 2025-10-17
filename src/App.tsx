import React, { useState, useEffect } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import AdminPage from './AdminPage';
import './App.css';
import { supabase } from './config';
import io from 'socket.io-client';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface StockData {
  team_id: number;
  team_name: string;
  current_price: number;
  previous_price: number;
  change_percent: number;
  total_investment: number;
}

const MainPage: React.FC = () => {
  const [stocks, setStocks] = useState<StockData[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isHeaderShrunk, setIsHeaderShrunk] = useState(false);
  const [socket, setSocket] = useState<any>(null);
  const [chartType, setChartType] = useState<'teams' | 'timeline'>('teams');
  const [chartTimeData, setChartTimeData] = useState<string[]>([]);
  const [priceHistory, setPriceHistory] = useState<{[key: number]: number[]}>({});
  const [isAutoSwitch, setIsAutoSwitch] = useState(false);
  const [autoSwitchInterval, setAutoSwitchInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 초기 데이터 로드
    fetchStocks();

    // Socket.IO 연결 설정
    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

    // Socket.IO 이벤트 리스너
    newSocket.on('connect', () => {
      console.log('Socket.IO 서버에 연결됨');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket.IO 서버 연결 끊김');
      setIsConnected(false);
    });

    newSocket.on('stockUpdate', (data: StockData[]) => {
      console.log('실시간 주가 업데이트 받음:', data);
      setStocks(data);
      
      // 시간축 차트를 위한 데이터 업데이트
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      
      setChartTimeData(prev => {
        const newTimeData = [...prev, currentTime];
        return newTimeData.length > 20 ? newTimeData.slice(-20) : newTimeData;
      });
      
      // 주가 히스토리 업데이트 - 모든 팀의 주가를 동시에 추가
      setPriceHistory(prev => {
        const newHistory = { ...prev };
        
        // 모든 팀의 주가를 현재 시간에 맞춰 추가
        data.forEach((stock: StockData) => {
          if (!newHistory[stock.team_id]) {
            newHistory[stock.team_id] = [];
          }
          newHistory[stock.team_id] = [
            ...newHistory[stock.team_id], 
            stock.current_price
          ].slice(-20); // 최대 20개 데이터 포인트 유지
        });
        
        return newHistory;
      });
    });

    // Supabase Realtime 구독 (백업용)
    const subscription = supabase
      .channel('stock_prices')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'stock_prices' },
        () => {
          console.log('주가 데이터 변경됨 (Supabase)');
          fetchStocks();
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'investments' },
        () => {
          console.log('투자 데이터 변경됨 (Supabase)');
          fetchStocks();
        }
      )
      .subscribe((status) => {
        console.log('Supabase 연결 상태:', status);
      });

    return () => {
      newSocket.disconnect();
      subscription.unsubscribe();
      // 자동 전환 정리
      if (autoSwitchInterval) {
        clearInterval(autoSwitchInterval);
      }
    };
  }, []);

  // 전체화면 모드에서 ESC 키로 나가기
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    if (isFullscreen) {
      document.addEventListener('keydown', handleKeyPress);
      return () => document.removeEventListener('keydown', handleKeyPress);
    }
  }, [isFullscreen]);

  // 스크롤 시 헤더 축소 상태 제어
  useEffect(() => {
    const handleScroll = () => {
      const shouldShrink = window.scrollY > 10;
      if (shouldShrink !== isHeaderShrunk) {
        setIsHeaderShrunk(shouldShrink);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // 초기 상태 동기화
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isHeaderShrunk]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const [countdown, setCountdown] = useState(10);

  const toggleAutoSwitch = () => {
    if (isAutoSwitch) {
      // 자동 전환 중지
      if (autoSwitchInterval) {
        clearInterval(autoSwitchInterval);
        setAutoSwitchInterval(null);
      }
      setIsAutoSwitch(false);
      setCountdown(10);
    } else {
      // 자동 전환 시작 (10초마다 전환)
      setCountdown(10);
      
      const interval = setInterval(() => {
        setChartType(prev => prev === 'teams' ? 'timeline' : 'teams');
        setCountdown(10); // 전환 후 카운트다운 리셋
      }, 10000);
      
      setAutoSwitchInterval(interval);
      setIsAutoSwitch(true);
    }
  };

  // 카운트다운 효과
  useEffect(() => {
    if (isAutoSwitch && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isAutoSwitch, countdown]);

  const fetchStocks = async () => {
    try {
      // 서버 API 사용
      const response = await fetch('http://localhost:3001/api/stocks');
      if (!response.ok) {
        throw new Error('서버에서 데이터를 가져올 수 없습니다.');
      }
      
      const data = await response.json();
      setStocks(data);
      
      // 초기 시간 데이터 설정
      const now = new Date();
      const initialTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      setChartTimeData([initialTime]);
      
      // 초기 주가 히스토리 설정
      const initialHistory: {[key: number]: number[]} = {};
      data.forEach((stock: StockData) => {
        initialHistory[stock.team_id] = [stock.current_price];
      });
      setPriceHistory(initialHistory);
    } catch (error) {
      console.error('주가 데이터 로드 실패:', error);
    }
  };

  // 차트 데이터 준비
  const chartData = chartType === 'teams' ? {
    // 팀별 주가 차트
    labels: stocks.map(stock => stock.team_name),
    datasets: [
      {
        label: '현재 주가',
        data: stocks.map(stock => stock.current_price),
        borderColor: '#007aff',
        backgroundColor: 'transparent',
        tension: 0,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2,
        fill: false,
        segment: {
          borderColor: (ctx: any) => {
            const index = ctx.p0.parsed.x;
            if (index === 0) return stocks[index].change_percent >= 0 ? '#30d158' : '#ff453a';
            const prevStock = stocks[index - 1];
            const currentStock = stocks[index];
            if (!prevStock || !currentStock) return '#007aff';
            return currentStock.current_price >= prevStock.current_price ? '#30d158' : '#ff453a';
          },
          backgroundColor: (ctx: any) => {
            const index = ctx.p0.parsed.x;
            if (index === 0) return stocks[index].change_percent >= 0 ? 'rgba(48, 209, 88, 0.1)' : 'rgba(255, 69, 58, 0.1)';
            const prevStock = stocks[index - 1];
            const currentStock = stocks[index];
            if (!prevStock || !currentStock) return 'transparent';
            return currentStock.current_price >= prevStock.current_price ? 'rgba(48, 209, 88, 0.1)' : 'rgba(255, 69, 58, 0.1)';
          },
        }
      }
    ]
  } : {
    // 시간축 주가 변화 차트
    labels: chartTimeData.length > 0 ? chartTimeData : ['현재'],
    datasets: stocks.map((stock, index) => {
      const historyData = priceHistory[stock.team_id] || [];
      const dataLength = Math.max(historyData.length, chartTimeData.length);
      
      // 시간축과 주가 데이터 길이를 맞춤
      const paddedData = [];
      for (let i = 0; i < dataLength; i++) {
        if (i < historyData.length) {
          paddedData.push(historyData[i]);
        } else {
          // 부족한 데이터는 현재 주가로 채움
          paddedData.push(stock.current_price);
        }
      }
      
      return {
        label: `${stock.team_name} (${stock.team_id}조)`,
        data: paddedData,
        borderColor: [
          '#ff4444', '#ff8800', '#ffdd00', '#88ff00', 
          '#00ff88', '#0088ff', '#8800ff', '#ff0088'
        ][index % 8],
        backgroundColor: 'transparent',
        tension: 0.1,
        pointRadius: 2,
        pointHoverRadius: 6,
        borderWidth: 2,
        fill: false,
      };
    })
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: false
      },
      legend: {
        display: chartType === 'timeline',
        position: 'top' as const,
        labels: {
          color: '#ffffff',
          font: {
            size: 10
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: false,
        title: {
          display: chartType === 'timeline',
          text: '주가 (원)',
          color: '#ffffff'
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
          drawBorder: false
        },
        ticks: {
          color: '#8e8e93',
          font: {
            size: 12,
            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          }
        }
      },
      x: {
        title: {
          display: chartType === 'timeline',
          text: '시간',
          color: '#ffffff'
        },
        grid: {
          display: false
        },
        ticks: {
          color: '#8e8e93',
          font: {
            size: 12,
            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          }
        }
      }
    }
  };

  return (
    <div className="App">
      <header className={`app-header ${isHeaderShrunk ? 'shrink' : ''}`}>
        <div className="logo-container">
          <img src={`/PRX_LOGO.png?t=${Date.now()}`} alt="PRX" className="logo" />
        </div>
        <div className="header-actions">
          <button 
            onClick={() => setChartType(chartType === 'teams' ? 'timeline' : 'teams')}
            className="chart-toggle-button"
            disabled={isAutoSwitch}
          >
            {chartType === 'teams' ? '시간축 차트' : '팀별 차트'}
          </button>
          <button 
            onClick={toggleAutoSwitch}
            className={`auto-switch-button ${isAutoSwitch ? 'active' : ''}`}
          >
            {isAutoSwitch ? '자동전환 중지' : '자동전환 시작'}
          </button>
          <button 
            onClick={toggleFullscreen}
            className="fullscreen-button"
          >
            {isFullscreen ? '전체화면 종료' : '전체화면'}
          </button>
          <Link to="/admin" className="admin-link">관리자</Link>
          <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '연결됨' : '연결 끊김'}
          </div>
        </div>
      </header>

      <main className={`app-main ${isFullscreen ? 'fullscreen-mode' : ''}`}>
        {/* 주가 차트 */}
        <section className="chart-section">
          <div className="chart-header">
            <h2>
              {chartType === 'teams' ? '팀별 주가 비교' : '시간별 주가 변화'}
              {isAutoSwitch && <span className="auto-indicator"> (자동 전환 중)</span>}
            </h2>
            {isAutoSwitch && (
              <div className="switch-timer">
                다음 전환까지: <span>{countdown}</span>초
              </div>
            )}
          </div>
          <div className="chart-container">
            <Line data={chartData} options={chartOptions} />
          </div>
        </section>

        {/* 주가 테이블 */}
        <section className="stocks-table-section">
          <h2>실시간 주가 현황</h2>
          <div className="stocks-table">
            <table>
              <thead>
                <tr>
                  <th>종목 코드</th>
                  <th>종목명</th>
                  <th>현재 주가</th>
                  <th>변동률</th>
                  <th>총 투자액</th>
                </tr>
              </thead>
              <tbody>
                {stocks.map(stock => {
                  const getCompanyName = (ticker: string) => {
                    const nameMap: { [key: string]: string } = {
                      'TJR': 'TeamJR',
                      'HZMB': '헌터좀비',
                      'KHH': 'TeamKHH',
                      'JCPK': '전차박',
                      'JMAI': 'jamAI',
                      '6조': '6조',
                      'FKR': 'FAKER',
                      'YWSH': 'YHAN_WORKSHOP'
                    };
                    return nameMap[ticker] || ticker;
                  };

                  return (
                    <tr key={stock.team_id}>
                      <td>{stock.team_name}</td>
                      <td>{getCompanyName(stock.team_name)}</td>
                      <td className="price">{stock.current_price.toFixed(2)}원</td>
                      <td className={`change ${stock.change_percent >= 0 ? 'positive' : 'negative'}`}>
                        {stock.change_percent >= 0 ? '+' : ''}{stock.change_percent.toFixed(2)}%
                      </td>
                      <td className="investment">{stock.total_investment.toLocaleString()}원</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </Router>
  );
};

export default App;