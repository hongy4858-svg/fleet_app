# 기업 차량 운영 관리 및 친환경차 전환 경제성 분석 시스템
> **Fleet Operation & Green Transition Economic Evaluation System**  
> 산업공학과 데이터베이스 및 경제성공학(Engineering Economy) 융합 실무 과제 웹 애플리케이션  
> **클라우드 데이터베이스: Supabase (PostgreSQL 15+, Supabase Auth, Row Level Security)**

---

## 1. 프로젝트 개요

본 시스템은 기업의 차량 담당자가 보유 업무용 차량의 **운행 거리, 주유 및 전기/수소 충전 영수증, 정비 내역을 통합 관리**하고, 노후/기존 내연기관 차량을 계속 보유·운영하는 대안과 최신 친환경 차량(전기차/수소차/하이브리드 등)으로 신규 교체하는 대안 간의 **수명주기 총비용을 현재가치(Present Worth / Net Present Value of Cost) 기준으로 정밀 비교**하여 데이터 기반의 의사결정을 지원하는 웹 시스템입니다.

### 핵심 학술 및 데이터베이스 설계 의의
1. **산업공학(경제성공학) 대안 비교**:
   - **매몰비용(Sunk Cost)의 엄격한 배제**: 기존 차량의 과거 장부 구매가는 과거 의사결정으로 이미 지출된 금액이므로 현재 시점의 유지 vs 교체 비교 의사결정에 가산하지 않습니다.
   - **기회비용(Opportunity Cost) 반영**: 기존 차량을 지금 처분할 때 발생하는 중고 시장 매각가($S_0$)를 신차 구입에 필요한 초기 현금 유출에서 공제합니다.
   - **감가상각비의 이중 계상 방지**: 현금흐름 기준의 순현재가치(PV) 분석이므로 취득 원가와 잔존가치를 직접 반영하고 감가상각비를 연간 운영비에 다시 더하지 않습니다.
   - **할인율 0% 및 양수($i \ge 0$) 완벽 처리**: 균등 일련비용 계수 $(P/A, i, n)$와 일시불 계수 $(P/F, i, n)$의 분모 0 발산 문제를 예외 처리하여 할인율 0%에서도 산술 합계로 정상 동작합니다.
2. **Supabase 클라우드 DB 관계형 모델링 & RLS 보안**:
   - **Row Level Security (RLS)**: 로그인한 사용자의 고유 UUID(`auth.uid()`)를 기준으로 모든 테이블의 조회·추가·수정·삭제를 엄격히 격리합니다.
   - **타 사용자 차량 연결 방지 (복합 외래키)**: 운행(`trip_logs`), 주유·충전(`energy_logs`), 정비(`maintenance_logs`) 테이블이 `(vehicle_id, owner_id)` 복합 외래키를 참조하도록 설계되어, DB 레벨에서 타인의 차량을 연결하는 것을 원천 차단합니다.
   - **불변 스냅샷(Immutable Snapshot)**: 저장된 분석 이력은 당시의 모든 입력값과 산출 결과를 `JSONB` 스냅샷으로 영구 보관하여, 향후 차량 정보나 에너지가격이 변경되더라도 과거 분석 결과가 오염되지 않습니다.

---

## 2. 화면 구성 및 주요 기능

| 화면 | 주요 기능 및 특징 |
| :--- | :--- |
| **1. 대시보드** | • 등록 차량 수, 친환경차 보유 대수 요약<br>• 기간 필터(1개월, 3개월, 6개월, 1년, 전체, 직접설정)<br>• 선택 기간 총주행거리, 주유·충전비, 정비비 KPI 카드<br>• 차량별 km당 운영단가(`(에너지비+정비비)/주행거리`) Recharts 수평 막대 차트 및 요약 테이블<br>• 주행거리 0km 예외 처리 및 시점 불일치 학술 유의사항 배너 |
| **2. 차량 관리** | • 차량 등록·조회·수정·삭제 (CRUD)<br>• 5대 연료 지원: 가솔린, 디젤, 하이브리드, 전기(EV), 수소(FCEV)<br>• 사용자 계정별 차량번호 중복 방지 제약조건<br>• 연관 데이터(운행/주유/정비/분석) 삭제 영향도 경고 및 차량번호 타이핑 2차 확인 모달 |
| **3. 운행·비용 기록** | • 3대 탭 인터페이스: A.운행 기록, B.주유·충전 기록, C.정비 기록<br>• 연료 종류에 따른 주유·충전 단위 자동 표기 (가솔린/디젤/HEV: `L`, 전기: `kWh`, 수소: `kg`)<br>• 결제금액과 주입량에 따른 환산 단가 자동 계산<br>• 차량별/기간별/검색어 필터링 제공 |
| **4. 유지·교체 비교** | • 기존 차량 선택 시 과거 DB 누적 실적(연비, 에너지단가, 정비비)을 **참고값**으로 제안<br>• 사용자가 향후 분석 기간($N$), 연간 주행거리, 할인율($i$) 및 미래 예상값을 직접 확인·수정<br>• 친환경 신차 후보(아이오닉6, EV6, 넥쏘 등) 선택 및 보조금/부대비용/잔존가치 반영<br>• 유지 대안 $PV_{\text{keep}}$ vs 교체 대안 $PV_{\text{replace}}$ 실시간 계산 및 유리한 대안 판정<br>• Recharts 비용 구성 항목별 PV 분해 비교 차트 및 상세 명세표<br>• 현재 분석 결과 스냅샷 저장 기능 |
| **5. 분석 이력** | • 저장된 분석 이력 목록 및 검색<br>• 분석 당시의 완전한 스냅샷을 열람하는 상세 모달<br>• 과거 분석을 불러와 조건을 수정하고 새 분석으로 저장하는 **[복제하여 재분석]** 지원<br>• 한국어 엑셀 호환 **UTF-8 BOM 인코딩 CSV 파일 내보내기** |

---

## 3. 기술 스택 및 아키텍처

- **Frontend Core**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS (Navy `#0F172A` 주조색, Teal `#0D9488` 포인트 컬러)
- **Data Visualization & Icons**: `recharts`, `lucide-react`
- **Backend & Database**: **Supabase (PostgreSQL 15+, Supabase Auth, Row Level Security)**
- **Architecture Pattern**: **Repository Pattern**
  - UI 컴포넌트는 `IFleetRepository` 인터페이스에 의존하며, `SupabaseFleetRepository`가 비동기로 Supabase PostgreSQL과 통신합니다.
  - 클라우드 연결 오류 발생 시 오류를 은폐하거나 로컬 저장소로 자동 fallback하지 않고 화면에 명확한 에러 원인을 표시합니다.
  - 기존 로컬 저장소 코드(`LocalStorageFleetRepository`)는 독립적으로 보존되어 있습니다.

---

## 4. 경제성공학 계산 공식

### 1) 현가 환산 계수
- **균등 일련비용 현재가치 계수 $(P/A, i, n)$**:
  $$
  (P/A, i, n) = \begin{cases} 
  \dfrac{(1 + i)^n - 1}{i(1 + i)^n} & \text{if } i > 0 \\
  n & \text{if } i = 0 
  \end{cases}
  $$
- **일시불 현재가치 계수 $(P/F, i, n)$**:
  $$
  (P/F, i, n) = \begin{cases} 
  (1 + i)^{-n} & \text{if } i > 0 \\
  1 & \text{if } i = 0 
  \end{cases}
  $$

### 2) 대안별 총비용 현재가치 (PV)
- **연간 에너지비용**:
  $$\text{Annual Energy Cost} = \frac{\text{Annual Distance (km)}}{\text{Efficiency (km/unit)}} \times \text{Energy Unit Price (원/unit)}$$
- **연간 총 운영비 $A$**:
  $$A = \text{Annual Energy Cost} + \text{Annual Maintenance} + \text{Annual Tax} + \text{Annual Insurance}$$
- **대안 1: 기존 차량 유지 ($PV_{\text{keep}}$)**:
  $$PV_{\text{keep}} = A_{\text{keep}} \times (P/A, i, n) - S_{n,\text{keep}} \times (P/F, i, n)$$
- **대안 2: 신규 차량 교체 ($PV_{\text{replace}}$)**:
  $$\text{Initial Outlay} = P_{\text{new}} + C_{\text{incidental}} - B_{\text{subsidy}} - S_0$$
  $$PV_{\text{replace}} = \text{Initial Outlay} + A_{\text{replace}} \times (P/A, i, n) - S_{n,\text{replace}} \times (P/F, i, n)$$
- **순현재가치 차이**:
  $$\Delta PV = PV_{\text{replace}} - PV_{\text{keep}}$$
  - $\Delta PV < 0$: 신차 교체 대안이 경제적으로 유리
  - $\Delta PV > 0$: 기존 차량 유지 대안이 경제적으로 유리

---

## 5. Supabase 클라우드 설정 및 로컬 실행 가이드

### 1단계: Supabase 프로젝트에 SQL 스키마 적용
1. [Supabase 대시보드](https://supabase.com/dashboard)에 로그인하여 생성하신 프로젝트로 이동합니다.
2. 좌측 메뉴에서 **SQL Editor**를 클릭합니다.
3. 프로젝트 내 [`supabase/migrations/20240101000000_create_fleet_schema.sql`](./supabase/migrations/20240101000000_create_fleet_schema.sql) 파일의 전체 내용을 복사하여 SQL Editor에 붙여넣습니다.
4. 우측 하단의 **Run** 버튼을 눌러 스키마를 생성합니다. (6개 테이블, 복합 외래키, 인덱스, RLS 정책이 한 번에 생성됩니다.)

### 2단계: 로컬 환경변수 파일(`.env.local`) 생성
1. 프로젝트 루트(`c:\fleet_app`)에 `.env.local` 파일을 생성합니다.
2. Supabase 대시보드의 **Project Settings > API** 메뉴에서 **Project URL**과 **anon / public key**를 복사하여 아래와 같이 입력합니다:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```
*(주의: `service_role` 비밀 키는 브라우저 클라이언트에 절대 노출해서는 안 되며, `.env.local`은 `.gitignore`에 등록되어 있습니다.)*

### 3단계: 로컬 개발 서버 실행
```bash
npm run dev
```
브라우저에서 **`http://localhost:5173/`** 주소로 접속합니다.

### 4단계: 회원가입 및 시연 데이터 주입
1. 화면 우측 상단의 **[로그인 / 회원가입]** 버튼을 클릭합니다.
2. **회원가입** 탭에서 이메일과 비밀번호(6자 이상)를 입력하고 계정을 생성합니다.
3. 로그인 후 상단 헤더의 **[시연 데이터 생성]** 버튼을 누르면, 현재 로그인한 사용자 계정(`auth.uid()`)에 가상 시연 차량 5대와 최근 6개월간의 운행·주유·정비 기록이 중복 없이 생성됩니다.
4. 대시보드, 차량 관리, 운행 기록, 경제성 비교, 분석 이력의 모든 기능을 즉시 시연하실 수 있습니다.

---

## 6. 경제성 계산 검증 결과

계산 로직은 UI와 완벽히 분리되어 있으며, 손계산이 가능한 작은 수치 사례를 작성하여 자동 검증 스크립트([scripts/test-economics.cjs](./scripts/test-economics.cjs))로 검증을 완료했습니다:

```
1. 현가 계수 공식 검증:
   - P/A (i=0%, n=5) = 5 (손계산 기대치 5와 100% 일치)
   - P/F (i=0%, n=5) = 1 (손계산 기대치 1과 100% 일치)
   - P/A (i=10%, n=1) = 0.909091 (손계산 기대치 1/1.1과 100% 일치)

2. 손계산 사례 1 (할인율 0%, 2년, 주행 1만km):
   - 기존 유지 총비용 PV: 2,000,000원 (손계산 2,000,000원과 100% 일치)
   - 신차 교체 총비용 PV: 4,400,000원 (손계산 4,400,000원과 100% 일치)
   - 비용 차이 ΔPV: +2,400,000원 (기존 유지 유리 판정 일치)

3. 손계산 사례 2 (할인율 10%, 1년):
   - 기존 유지 총비용 PV: 1,000,000원 (손계산 1,000,000원과 100% 일치)
   - 신차 교체 총비용 PV: 700,000원 (손계산 700,000원과 100% 일치)
   - 비용 차이 ΔPV: -300,000원 (신차 교체 유리 판정 일치)
```

---

## 7. 설계 및 규칙 문서 안내
- [`docs/prd.md`](./docs/prd.md): 제품 요구사항 정의서 (목적, 사용자, 범위, 완료 기준)
- [`docs/design.md`](./docs/design.md): 화면 설계, ERD, 복합 외래키 무결성, RLS 정책, 계산 공식
- [`docs/tasks.md`](./docs/tasks.md): WBS 작업 분할 및 단계별 진행 상태
- [`docs/rules.md`](./docs/rules.md): 개발 규칙, 표준 단위 체계, 유효성 검증 규칙, 보안 원칙
- [`supabase/migrations/20240101000000_create_fleet_schema.sql`](./supabase/migrations/20240101000000_create_fleet_schema.sql): Supabase SQL Editor 실행용 전체 DDL 스크립트
