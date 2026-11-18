import { EnergyLog, FuelType, MaintenanceLog, TripLog, Vehicle } from '../types';

export interface VehiclePeriodSummary {
  vehicle_id: string;
  plate_number: string;
  model_name: string;
  fuel_type: FuelType;
  total_distance_km: number;
  total_energy_cost: number;
  total_maintenance_cost: number;
  total_operating_cost: number;
  cost_per_km: number | null; // 주행거리 0이면 null
}

export interface FleetPeriodMetrics {
  total_vehicles: number;
  total_distance_km: number;
  total_energy_cost: number;
  total_maintenance_cost: number;
  total_operating_cost: number;
  average_cost_per_km: number | null;
  vehicle_summaries: VehiclePeriodSummary[];
}

/**
 * 특정 날짜가 시작일~종료일 구간 내에 포함되는지 검사 (YYYY-MM-DD)
 */
export function isDateInRange(dateStr: string, startDate?: string, endDate?: string): boolean {
  if (startDate && dateStr < startDate) return false;
  if (endDate && dateStr > endDate) return false;
  return true;
}

/**
 * 선택 기간 및 차량 조건에 따른 플릿 운영 지표 계산
 */
export function calculateFleetMetrics(
  vehicles: Vehicle[],
  tripLogs: TripLog[],
  energyLogs: EnergyLog[],
  maintenanceLogs: MaintenanceLog[],
  startDate?: string,
  endDate?: string
): FleetPeriodMetrics {
  const filteredTrips = tripLogs.filter((t) => isDateInRange(t.trip_date, startDate, endDate));
  const filteredEnergy = energyLogs.filter((e) => isDateInRange(e.log_date, startDate, endDate));
  const filteredMaintenance = maintenanceLogs.filter((m) =>
    isDateInRange(m.maintenance_date, startDate, endDate)
  );

  let grandTotalDistance = 0;
  let grandTotalEnergyCost = 0;
  let grandTotalMaintenanceCost = 0;

  const summaries: VehiclePeriodSummary[] = vehicles.map((v) => {
    const vTrips = filteredTrips.filter((t) => t.vehicle_id === v.id);
    const vEnergy = filteredEnergy.filter((e) => e.vehicle_id === v.id);
    const vMaint = filteredMaintenance.filter((m) => m.vehicle_id === v.id);

    const dist = vTrips.reduce((sum, t) => sum + t.distance_km, 0);
    const energyCost = vEnergy.reduce((sum, e) => sum + e.total_cost, 0);
    const maintCost = vMaint.reduce((sum, m) => sum + m.cost, 0);
    const opCost = energyCost + maintCost;
    const costPerKm = dist > 0 ? Math.round(opCost / dist) : null;

    grandTotalDistance += dist;
    grandTotalEnergyCost += energyCost;
    grandTotalMaintenanceCost += maintCost;

    return {
      vehicle_id: v.id,
      plate_number: v.plate_number,
      model_name: v.model_name,
      fuel_type: v.fuel_type,
      total_distance_km: dist,
      total_energy_cost: energyCost,
      total_maintenance_cost: maintCost,
      total_operating_cost: opCost,
      cost_per_km: costPerKm,
    };
  });

  const grandTotalOpCost = grandTotalEnergyCost + grandTotalMaintenanceCost;
  const avgCostPerKm = grandTotalDistance > 0 ? Math.round(grandTotalOpCost / grandTotalDistance) : null;

  return {
    total_vehicles: vehicles.length,
    total_distance_km: grandTotalDistance,
    total_energy_cost: grandTotalEnergyCost,
    total_maintenance_cost: grandTotalMaintenanceCost,
    total_operating_cost: grandTotalOpCost,
    average_cost_per_km: avgCostPerKm,
    vehicle_summaries: summaries,
  };
}

/**
 * 분석 입력 폼에서 기존 차량 선택 시 참고값(Reference Estimates)을 산출
 * (DB에 기록된 과거 데이터로부터 산출하되, 값이 없으면 공인연비 및 기본값 사용)
 */
export function getVehicleHistoricalEstimates(
  vehicle: Vehicle,
  tripLogs: TripLog[],
  energyLogs: EnergyLog[],
  maintenanceLogs: MaintenanceLog[]
) {
  const vTrips = tripLogs.filter((t) => t.vehicle_id === vehicle.id);
  const vEnergy = energyLogs.filter((e) => e.vehicle_id === vehicle.id);
  const vMaint = maintenanceLogs.filter((m) => m.vehicle_id === vehicle.id);

  const totalDist = vTrips.reduce((sum, t) => sum + t.distance_km, 0);
  const totalAmount = vEnergy.reduce((sum, e) => sum + e.amount, 0);
  const totalMaintCost = vMaint.reduce((sum, m) => sum + m.cost, 0);

  // 연비 참고값: 주행거리와 주입량이 모두 유의미하면 산출, 아니면 공인연비
  let estimatedEfficiency = vehicle.official_efficiency;
  if (totalDist > 0 && totalAmount > 0) {
    estimatedEfficiency = Number((totalDist / totalAmount).toFixed(1));
  }

  // 에너지 단가 참고값: 최근 주유/충전 단가
  let estimatedEnergyPrice = 1700; // 가솔린 기본
  if (vEnergy.length > 0) {
    // 가장 최근 날짜 순
    const sorted = [...vEnergy].sort((a, b) => b.log_date.localeCompare(a.log_date));
    estimatedEnergyPrice = sorted[0].unit_price;
  } else {
    if (vehicle.fuel_type === 'diesel') estimatedEnergyPrice = 1550;
    else if (vehicle.fuel_type === 'electric') estimatedEnergyPrice = 340;
    else if (vehicle.fuel_type === 'hydrogen') estimatedEnergyPrice = 9000;
    else if (vehicle.fuel_type === 'hybrid') estimatedEnergyPrice = 1700;
  }

  // 과거 정비비 총합을 연간으로 가늠 (기록이 있으면 그에 기반, 없으면 차종별 기본값)
  const annualMaint = totalMaintCost > 0 ? totalMaintCost : 800000;

  return {
    referenceEfficiency: estimatedEfficiency,
    referenceEnergyPrice: estimatedEnergyPrice,
    referenceAnnualMaintenance: annualMaint,
    totalTripCount: vTrips.length,
    totalLoggedDistance: totalDist,
  };
}
