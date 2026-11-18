import { FuelType } from '../types';

/**
 * 금액(원) 포맷 (천 단위 콤마)
 */
export function formatCurrency(amount: number): string {
  return `${Math.round(amount).toLocaleString('ko-KR')}원`;
}

/**
 * 거리(km) 포맷
 */
export function formatDistance(distance: number): string {
  return `${distance.toLocaleString('ko-KR')} km`;
}

/**
 * 연료 종류 한글 라벨
 */
export function getFuelTypeLabel(fuelType: FuelType): string {
  switch (fuelType) {
    case 'gasoline':
      return '가솔린';
    case 'diesel':
      return '디젤';
    case 'hybrid':
      return '하이브리드';
    case 'electric':
      return '전기(EV)';
    case 'hydrogen':
      return '수소(FCEV)';
    default:
      return fuelType;
  }
}

/**
 * 연료 종류별 주입량 단위 (L, kWh, kg)
 */
export function getFuelUnit(fuelType: FuelType): string {
  switch (fuelType) {
    case 'gasoline':
    case 'diesel':
    case 'hybrid':
      return 'L';
    case 'electric':
      return 'kWh';
    case 'hydrogen':
      return 'kg';
    default:
      return '단위';
  }
}

/**
 * 연료 종류별 연비 단위 (km/L, km/kWh, km/kg)
 */
export function getEfficiencyUnit(fuelType: FuelType): string {
  return `km/${getFuelUnit(fuelType)}`;
}

/**
 * 연료 종류별 단가 단위 (원/L, 원/kWh, 원/kg)
 */
export function getEnergyPriceUnit(fuelType: FuelType): string {
  return `원/${getFuelUnit(fuelType)}`;
}

/**
 * UTF-8 BOM 인코딩을 적용하여 엑셀에서 한글이 깨지지 않는 CSV 다운로드 함수
 */
export function exportToCsv(filename: string, rows: (string | number)[][]): void {
  const processCell = (cell: string | number) => {
    let str = cell === null || cell === undefined ? '' : String(cell);
    // 큰따옴표 이스케이프 및 콤마 처리
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      str = `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvContent = rows.map((row) => row.map(processCell).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

