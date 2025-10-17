import React, { useState, useEffect } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Link } from 'react-router-dom';
import './App.css';
import { supabase } from './config';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface StockData {
  team_id: number;
  team_name: string;
  current_price: number;
  previous_price: number;
  change_percent: number;
  total_investment: number;
}

interface InvestmentForm {
  teamId: number;
  amount: number;
}

interface InvestmentHistory {
  id: number;
  team_id: number;
  team_name: string;
  amount: number;
  timestamp: string;
  price_at_investment: number;
  uniqueKey?: string;
}

const AdminPage: React.FC = () => {
  const [stocks, setStocks] = useState<StockData[]>([]);
  const [investmentForms, setInvestmentForms] = useState<InvestmentForm[]>([]);
  const [investmentHistory, setInvestmentHistory] = useState<InvestmentHistory[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [modalAmount, setModalAmount] = useState<number>(0);
  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const pushToast = (message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  // 8개 조의 투자 폼 초기화
  useEffect(() => {
    const initialForms = Array.from({ length: 8 }, (_, i) => ({
      teamId: i + 1,
      amount: 0
    }));
    setInvestmentForms(initialForms);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      // 초기 데이터 로드
      fetchStocks();
      fetchHistory();

      // Supabase Realtime 구독
      const subscription = supabase
        .channel('admin_stock_prices')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'stock_prices' },
          () => {
            console.log('주가 데이터 변경됨');
            fetchStocks();
          }
        )
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'investments' },
          () => {
            console.log('투자 데이터 변경됨');
            fetchStocks();
            fetchHistory();
          }
        )
        .subscribe((status) => {
          setIsConnected(status === 'SUBSCRIBED');
          console.log('Supabase 연결 상태:', status);
        });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [isAuthenticated]);

  const fetchStocks = async () => {
    try {
      // 서버 API 사용
      const response = await fetch('http://localhost:3001/api/stocks');
      if (!response.ok) {
        throw new Error('서버에서 데이터를 가져올 수 없습니다.');
      }
      
      const data = await response.json();
      setStocks(data);
    } catch (error) {
      console.error('주가 데이터 로드 실패:', error);
      pushToast('주가 데이터를 불러오지 못했습니다.');
    }
  };

  const fetchHistory = async () => {
    try {
      // 서버 API 사용
      const response = await fetch('http://localhost:3001/api/history');
      if (!response.ok) {
        throw new Error('서버에서 히스토리 데이터를 가져올 수 없습니다.');
      }
      
      const data = await response.json();
      setInvestmentHistory(data);
    } catch (error) {
      console.error('히스토리 데이터 로드 실패:', error);
      pushToast('투자 히스토리를 불러오지 못했습니다.');
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'admin123') { // 간단한 암호
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('잘못된 암호입니다.');
    }
  };

  const handleInvestmentChange = (teamId: number, amount: number) => {
    setInvestmentForms(prev => 
      prev.map(form => 
        form.teamId === teamId ? { ...form, amount } : form
      )
    );
  };

  const handleInvestment = async (teamId: number, amount: number) => {
    if (amount <= 0) {
      pushToast('투자 금액을 올바르게 입력해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      // 서버 API를 사용한 투자
      const response = await fetch('http://localhost:3001/api/invest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          teamId: teamId,
          amount: amount
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '투자에 실패했습니다.');
      }

      const result = await response.json();
      pushToast(`${teamId}조 투자 완료! 새로운 주가: ${result.newPrice}원 (${result.changePercent}%)`);
      
      // 데이터 새로고침
      await fetchStocks();
      await fetchHistory();
      
      // 해당 조의 투자 금액 초기화
      handleInvestmentChange(teamId, 0);
      setModalAmount(0);
      setSelectedTeamId(null);
      
    } catch (error) {
      console.error('투자 실패:', error);
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
      pushToast(`투자 중 오류가 발생했습니다: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const openTeamModal = (teamId: number, presetAmount?: number) => {
    setSelectedTeamId(teamId);
    setModalAmount(presetAmount ?? 0);
  };

  const closeTeamModal = () => {
    setSelectedTeamId(null);
    setModalAmount(0);
  };

  const handleModalInvestment = async () => {
    if (selectedTeamId !== null) {
      await handleInvestment(selectedTeamId, modalAmount);
      closeTeamModal();
    }
  };

  // 차트 데이터 준비
  const chartData = {
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
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: '파트너즈 증권 거래소 - 관리자',
        font: {
          size: 20,
          weight: 'bold' as const,
          family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        },
        color: '#ffffff'
      },
      legend: {
        display: false
      }
    },
    scales: {
      y: {
        beginAtZero: false,
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

  if (!isAuthenticated) {
    return (
      <div className="App">
        <div className="login-container">
          <div className="login-box">
            <Link to="/" className="login-close-button">×</Link>
            <h1>관리자 로그인</h1>
            <form onSubmit={handlePasswordSubmit} className="login-form">
              <div className="form-group">
                <label htmlFor="password">암호:</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="관리자 암호를 입력하세요"
                  required
                />
              </div>
              {error && <div className="error-message">{error}</div>}
              <button type="submit" className="login-button">
                로그인
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const selectedTeam = stocks.find(stock => stock.team_id === selectedTeamId);

  return (
    <div className="App">
      <header className="app-header">
        <h1>관리자 - 파트너즈 증권 거래소</h1>
        <div className="header-actions">
          <button 
            onClick={() => {
              setShowHistory(!showHistory);
              if (!showHistory) {
                fetchHistory(); // 히스토리 버튼 클릭 시 데이터 새로고침
              }
            }}
            className="history-button"
          >
            {showHistory ? '차트 보기' : '히스토리'}
          </button>
          <Link to="/" className="logout-link">나가기</Link>
          <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '연결됨' : '연결 끊김'}
          </div>
        </div>
      </header>

      <main className="app-main">
        {!showHistory ? (
          <>
            {/* 주가 차트 */}
            <section className="chart-section">
              <div className="chart-container">
                <Line data={chartData} options={chartOptions} />
              </div>
            </section>

            {/* 조별 투자 입력 */}
            <section className="investment-section">
              <h2>조별 투자 입력</h2>
              <div className="team-investment-grid">
                {stocks.map((stock, index) => (
                  <div 
                    key={stock.team_id} 
                    className="team-investment-card"
                    onClick={() => openTeamModal(stock.team_id)}
                  >
                    <h3>{stock.team_name}</h3>
                    <div className="current-info">
                      <div className="price">현재: {stock.current_price.toFixed(2)}원</div>
                      <div className={`change ${stock.change_percent >= 0 ? 'positive' : 'negative'}`}>
                        {stock.change_percent >= 0 ? '+' : ''}{stock.change_percent.toFixed(2)}%
                      </div>
                    </div>
                    <div className="investment-form">
                      <input
                        type="number"
                        min="0"
                        value={investmentForms[index]?.amount || ''}
                        onChange={(e) => handleInvestmentChange(stock.team_id, parseInt(e.target.value) || 0)}
                        onFocus={(e) => {
                          if (e.target.value === '0') {
                            e.target.value = '';
                            handleInvestmentChange(stock.team_id, 0);
                          }
                        }}
                        onBlur={(e) => {
                          if (e.target.value === '') {
                            e.target.value = '0';
                            handleInvestmentChange(stock.team_id, 0);
                          }
                        }}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleInvestment(stock.team_id, investmentForms[index]?.amount || 0);
                          }
                        }}
                        placeholder="투자 금액"
                        className="amount-input"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInvestment(stock.team_id, investmentForms[index]?.amount || 0);
                        }}
                        className="invest-button"
                        disabled={!investmentForms[index]?.amount || isLoading || investmentForms[index]?.amount <= 0}
                      >
                        {isLoading ? '처리 중...' : '투자'}
                      </button>
                    </div>
                    <div className="total-investment">
                      총 투자: {stock.total_investment.toLocaleString()}원
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : (
          /* 투자 히스토리 */
          <section className="history-section">
            <h2>투자 히스토리 (총 {investmentHistory.length}개)</h2>
            <div className="history-table">
              <table>
                <thead>
                  <tr>
                    <th>시간</th>
                    <th>조</th>
                    <th>투자 금액</th>
                    <th>투자 시 주가</th>
                  </tr>
                </thead>
                <tbody>
                  {investmentHistory.map((record) => (
                    <tr key={record.uniqueKey || record.id}>
                      <td className="timestamp">
                        {new Date(record.timestamp).toLocaleString('ko-KR')}
                      </td>
                      <td className="team-name">{record.team_name}</td>
                      <td className="amount">{record.amount.toLocaleString()}원</td>
                      <td className="price">{record.price_at_investment.toFixed(2)}원</td>
                    </tr>
                  ))}
                  {investmentHistory.length === 0 && (
                    <tr>
                      <td colSpan={4} className="no-data">투자 기록이 없습니다.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 토스트 알림 */}
        {toasts.map(toast => (
          <div key={toast.id} className="toast-notification success">
            {toast.message}
          </div>
        ))}

        {/* 투자 모달 */}
        {selectedTeamId !== null && selectedTeam && (
          <div className="modal-overlay" onClick={closeTeamModal}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{selectedTeam.team_name} ({selectedTeam.team_id}조) 투자</h2>
                <button onClick={closeTeamModal} className="modal-close-button">×</button>
              </div>
              
              <div className="modal-current-info">
                <div className="info-item">
                  <span className="label">현재 주가</span>
                  <span className="price">{selectedTeam.current_price.toFixed(2)}원</span>
                </div>
                <div className="info-item">
                  <span className="label">변동률</span>
                  <span className={`change ${selectedTeam.change_percent >= 0 ? 'positive' : 'negative'}`}>
                    {selectedTeam.change_percent >= 0 ? '+' : ''}{selectedTeam.change_percent.toFixed(2)}%
                  </span>
                </div>
                <div className="info-item">
                  <span className="label">총 투자액</span>
                  <span className="investment">{selectedTeam.total_investment.toLocaleString()}원</span>
                </div>
              </div>

              <div className="modal-form">
                <label htmlFor="modal-amount">투자 금액</label>
                <input
                  id="modal-amount"
                  type="number"
                  min="0"
                  value={modalAmount === 0 ? '' : modalAmount}
                  onChange={(e) => setModalAmount(parseInt(e.target.value) || 0)}
                  onFocus={(e) => { if (e.target.value === '0') e.target.value = ''; }}
                  onBlur={(e) => { if (e.target.value === '') setModalAmount(0); }}
                  placeholder="투자 금액을 입력하세요"
                />
              </div>

              <div className="modal-actions">
                <button onClick={closeTeamModal} className="modal-cancel">취소</button>
                <button 
                  onClick={handleModalInvestment} 
                  type="submit"
                  disabled={modalAmount <= 0 || isLoading}
                >
                  {isLoading ? '처리 중...' : '투자하기'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminPage;