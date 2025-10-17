# 파트너즈 증권 거래소 🏦📈

실시간 주식 거래 시뮬레이션 게임 - PWA (Progressive Web App)

## 🚀 데모

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live-brightgreen)](https://username.github.io/partnerz-stock-market)

## ✨ 주요 기능

- 📊 **실시간 주가 차트**: Socket.IO를 통한 실시간 주가 업데이트
- 📱 **PWA 지원**: 모바일 앱처럼 설치 가능
- 🎮 **투자 시뮬레이션**: 8개 조별 주식 투자 게임
- 📈 **다양한 차트**: 팀별 차트와 시간축 차트 전환
- 🔄 **자동 전환 모드**: 차트 자동 셔플 기능
- 👨‍💼 **관리자 패널**: 투자 관리 및 통계 조회
- 📱 **반응형 디자인**: 모든 디바이스에서 최적화

## 🛠️ 기술 스택

### Frontend
- **React 18** - UI 프레임워크
- **TypeScript** - 타입 안전성
- **Chart.js** - 차트 라이브러리
- **Socket.IO Client** - 실시간 통신
- **PWA** - 모바일 앱 경험

### Backend
- **Node.js** - 서버 런타임
- **Express.js** - 웹 프레임워크
- **Socket.IO** - 실시간 통신
- **SQLite** - 데이터베이스
- **CORS** - 크로스 오리진 지원

## 🚀 설치 및 실행

### 개발 환경

```bash
# 저장소 클론
git clone https://github.com/username/partnerz-stock-market.git
cd partnerz-stock-market

# 의존성 설치
npm install
cd client && npm install && cd ..

# 개발 서버 실행
npm run dev
```

### 프로덕션 빌드

```bash
# 클라이언트 빌드
npm run build

# 서버 실행
npm start
```

## 📱 PWA 설치

1. 웹 브라우저에서 앱에 접속
2. 주소창의 설치 아이콘 클릭 (Chrome/Edge)
3. 또는 브라우저 메뉴에서 "홈 화면에 추가" 선택

## 🎮 게임 방법

1. **메인 화면**: 실시간 주가 차트 확인
2. **차트 전환**: 팀별 차트 ↔ 시간축 차트
3. **자동 전환**: 자동 셔플 모드 활성화
4. **관리자 모드**: 투자 및 통계 관리

## 📊 API 엔드포인트

- `GET /api/stocks` - 현재 주가 데이터
- `POST /api/invest` - 투자 실행
- `GET /api/history` - 투자 히스토리
- `GET /api/stats` - 투자 통계

## 🔧 환경 설정

```bash
# .env 파일 생성
PORT=3001
HOST=0.0.0.0
```

## 📦 배포

### GitHub Pages

```bash
# 자동 배포 (GitHub Actions)
git push origin main

# 수동 배포
npm run deploy
```

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## 👥 팀

**파트너즈 동아리** - 동아리 축제 프로젝트

## 📞 문의

프로젝트에 대한 문의사항이 있으시면 이슈를 생성해 주세요.

---

⭐ 이 프로젝트가 도움이 되었다면 스타를 눌러주세요!