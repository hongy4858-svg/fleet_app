import {
  Vehicle,
  TripLog,
  EnergyLog,
  MaintenanceLog,
  ReplacementCandidate,
  AnalysisRecord,
} from '../types';
import {
  DEMO_OWNER_ID,
  INITIAL_VEHICLES,
  INITIAL_TRIP_LOGS,
  INITIAL_ENERGY_LOGS,
  INITIAL_MAINTENANCE_LOGS,
  INITIAL_REPLACEMENT_CANDIDATES,
} from '../data/mockData';

export interface VehicleDeletionCheck {
  canDelete: boolean;
  tripCount: number;
  energyCount: number;
  maintCount: number;
  analysisCount: number;
  totalRelatedCount: number;
}

export interface IFleetRepository {
  // 차량 관리
  getVehicles(): Promise<Vehicle[]>;
  getVehicleById(id: string): Promise<Vehicle | null>;
  createVehicle(data: Omit<Vehicle, 'id' | 'created_at' | 'updated_at'>): Promise<Vehicle>;
  updateVehicle(id: string, data: Partial<Vehicle>): Promise<Vehicle>;
  checkVehicleDeletion(id: string): Promise<VehicleDeletionCheck>;
  deleteVehicle(id: string, cascade?: boolean): Promise<void>;

  // 운행 기록
  getTripLogs(vehicleId?: string): Promise<TripLog[]>;
  createTripLog(data: Omit<TripLog, 'id' | 'created_at'>): Promise<TripLog>;
  updateTripLog(id: string, data: Partial<TripLog>): Promise<TripLog>;
  deleteTripLog(id: string): Promise<void>;

  // 주유·충전 기록
  getEnergyLogs(vehicleId?: string): Promise<EnergyLog[]>;
  createEnergyLog(data: Omit<EnergyLog, 'id' | 'created_at'>): Promise<EnergyLog>;
  updateEnergyLog(id: string, data: Partial<EnergyLog>): Promise<EnergyLog>;
  deleteEnergyLog(id: string): Promise<void>;

  // 정비 기록
  getMaintenanceLogs(vehicleId?: string): Promise<MaintenanceLog[]>;
  createMaintenanceLog(data: Omit<MaintenanceLog, 'id' | 'created_at'>): Promise<MaintenanceLog>;
  updateMaintenanceLog(id: string, data: Partial<MaintenanceLog>): Promise<MaintenanceLog>;
  deleteMaintenanceLog(id: string): Promise<void>;

  // 교체 후보 차량
  getReplacementCandidates(): Promise<ReplacementCandidate[]>;
  createReplacementCandidate(
    data: Omit<ReplacementCandidate, 'id' | 'created_at'>
  ): Promise<ReplacementCandidate>;
  updateReplacementCandidate(
    id: string,
    data: Partial<ReplacementCandidate>
  ): Promise<ReplacementCandidate>;
  deleteReplacementCandidate(id: string): Promise<void>;

  // 분석 이력
  getAnalyses(): Promise<AnalysisRecord[]>;
  getAnalysisById(id: string): Promise<AnalysisRecord | null>;
  saveAnalysis(data: Omit<AnalysisRecord, 'id' | 'created_at'>): Promise<AnalysisRecord>;
  deleteAnalysis(id: string): Promise<void>;

  // 데모 초기화 및 시연 데이터 생성
  seedDemoDataForUser?(): Promise<void>;
  resetToDemoData(): Promise<void>;
}

const STORAGE_KEYS = {
  VEHICLES: 'fleet_demo_vehicles_v1',
  TRIP_LOGS: 'fleet_demo_trips_v1',
  ENERGY_LOGS: 'fleet_demo_energy_v1',
  MAINT_LOGS: 'fleet_demo_maint_v1',
  CANDIDATES: 'fleet_demo_candidates_v1',
  ANALYSES: 'fleet_demo_analyses_v1',
  INITIALIZED: 'fleet_demo_initialized_v1',
};

export class LocalStorageFleetRepository implements IFleetRepository {
  constructor() {
    this.ensureInitialized();
  }

  private ensureInitialized(): void {
    if (typeof window === 'undefined') return;
    const isInit = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
    if (!isInit) {
      this.seedInitialData();
    }
  }

  private seedInitialData(): void {
    localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(INITIAL_VEHICLES));
    localStorage.setItem(STORAGE_KEYS.TRIP_LOGS, JSON.stringify(INITIAL_TRIP_LOGS));
    localStorage.setItem(STORAGE_KEYS.ENERGY_LOGS, JSON.stringify(INITIAL_ENERGY_LOGS));
    localStorage.setItem(STORAGE_KEYS.MAINT_LOGS, JSON.stringify(INITIAL_MAINTENANCE_LOGS));
    localStorage.setItem(
      STORAGE_KEYS.CANDIDATES,
      JSON.stringify(INITIAL_REPLACEMENT_CANDIDATES)
    );
    localStorage.setItem(STORAGE_KEYS.ANALYSES, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
  }

  private getItem<T>(key: string, defaultValue: T): T {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
      console.error(`Failed to load ${key} from localStorage:`, e);
      return defaultValue;
    }
  }

  private setItem<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error(`Failed to save ${key} to localStorage:`, e);
      throw new Error('로컬 저장소 공간이 부족하거나 저장에 실패했습니다.');
    }
  }

  // --- Vehicles ---
  async getVehicles(): Promise<Vehicle[]> {
    return this.getItem<Vehicle[]>(STORAGE_KEYS.VEHICLES, []);
  }

  async getVehicleById(id: string): Promise<Vehicle | null> {
    const list = await this.getVehicles();
    return list.find((v) => v.id === id) || null;
  }

  async createVehicle(
    data: Omit<Vehicle, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Vehicle> {
    const list = await this.getVehicles();
    // 차량번호 중복 검증
    const normalizedPlate = data.plate_number.replace(/\s+/g, '');
    const exists = list.some(
      (v) => v.plate_number.replace(/\s+/g, '') === normalizedPlate
    );
    if (exists) {
      throw new Error(`차량번호 "${data.plate_number}"는 이미 등록되어 있습니다.`);
    }

    const now = new Date().toISOString();
    const newVehicle: Vehicle = {
      ...data,
      id: `veh-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      owner_id: data.owner_id || DEMO_OWNER_ID,
      created_at: now,
      updated_at: now,
    };
    list.unshift(newVehicle);
    this.setItem(STORAGE_KEYS.VEHICLES, list);
    return newVehicle;
  }

  async updateVehicle(id: string, data: Partial<Vehicle>): Promise<Vehicle> {
    const list = await this.getVehicles();
    const index = list.findIndex((v) => v.id === id);
    if (index === -1) {
      throw new Error('해당 차량을 찾을 수 없습니다.');
    }

    // 수정 시 차량번호 중복 검증 (자신 제외)
    if (data.plate_number) {
      const normalizedPlate = data.plate_number.replace(/\s+/g, '');
      const exists = list.some(
        (v) => v.id !== id && v.plate_number.replace(/\s+/g, '') === normalizedPlate
      );
      if (exists) {
        throw new Error(`차량번호 "${data.plate_number}"는 이미 등록되어 있습니다.`);
      }
    }

    const updated: Vehicle = {
      ...list[index],
      ...data,
      updated_at: new Date().toISOString(),
    };
    list[index] = updated;
    this.setItem(STORAGE_KEYS.VEHICLES, list);
    return updated;
  }

  async checkVehicleDeletion(id: string): Promise<VehicleDeletionCheck> {
    const trips = (await this.getTripLogs()).filter((t) => t.vehicle_id === id);
    const energy = (await this.getEnergyLogs()).filter((e) => e.vehicle_id === id);
    const maint = (await this.getMaintenanceLogs()).filter((m) => m.vehicle_id === id);
    const analyses = (await this.getAnalyses()).filter(
      (a) => a.existing_vehicle_id === id
    );

    const total = trips.length + energy.length + maint.length + analyses.length;
    return {
      canDelete: total === 0,
      tripCount: trips.length,
      energyCount: energy.length,
      maintCount: maint.length,
      analysisCount: analyses.length,
      totalRelatedCount: total,
    };
  }

  async deleteVehicle(id: string, cascade: boolean = false): Promise<void> {
    const check = await this.checkVehicleDeletion(id);
    if (!check.canDelete && !cascade) {
      throw new Error(
        `연관된 기록(${check.totalRelatedCount}건)이 존재하여 바로 삭제할 수 없습니다.`
      );
    }

    // 1. 차량 삭제
    let vehicles = await this.getVehicles();
    vehicles = vehicles.filter((v) => v.id !== id);
    this.setItem(STORAGE_KEYS.VEHICLES, vehicles);

    // 2. Cascade 삭제 (운행, 주유, 정비)
    if (cascade) {
      let trips = await this.getTripLogs();
      trips = trips.filter((t) => t.vehicle_id !== id);
      this.setItem(STORAGE_KEYS.TRIP_LOGS, trips);

      let energy = await this.getEnergyLogs();
      energy = energy.filter((e) => e.vehicle_id !== id);
      this.setItem(STORAGE_KEYS.ENERGY_LOGS, energy);

      let maint = await this.getMaintenanceLogs();
      maint = maint.filter((m) => m.vehicle_id !== id);
      this.setItem(STORAGE_KEYS.MAINT_LOGS, maint);
    }
  }

  // --- Trip Logs ---
  async getTripLogs(vehicleId?: string): Promise<TripLog[]> {
    const list = this.getItem<TripLog[]>(STORAGE_KEYS.TRIP_LOGS, []);
    return vehicleId ? list.filter((t) => t.vehicle_id === vehicleId) : list;
  }

  async createTripLog(data: Omit<TripLog, 'id' | 'created_at'>): Promise<TripLog> {
    const list = await this.getTripLogs();
    const newLog: TripLog = {
      ...data,
      id: `trip-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      owner_id: data.owner_id || DEMO_OWNER_ID,
      created_at: new Date().toISOString(),
    };
    list.unshift(newLog);
    this.setItem(STORAGE_KEYS.TRIP_LOGS, list);
    return newLog;
  }

  async updateTripLog(id: string, data: Partial<TripLog>): Promise<TripLog> {
    const list = await this.getTripLogs();
    const index = list.findIndex((t) => t.id === id);
    if (index === -1) throw new Error('운행 기록을 찾을 수 없습니다.');
    const updated = { ...list[index], ...data };
    list[index] = updated;
    this.setItem(STORAGE_KEYS.TRIP_LOGS, list);
    return updated;
  }

  async deleteTripLog(id: string): Promise<void> {
    let list = await this.getTripLogs();
    list = list.filter((t) => t.id !== id);
    this.setItem(STORAGE_KEYS.TRIP_LOGS, list);
  }

  // --- Energy Logs ---
  async getEnergyLogs(vehicleId?: string): Promise<EnergyLog[]> {
    const list = this.getItem<EnergyLog[]>(STORAGE_KEYS.ENERGY_LOGS, []);
    return vehicleId ? list.filter((e) => e.vehicle_id === vehicleId) : list;
  }

  async createEnergyLog(data: Omit<EnergyLog, 'id' | 'created_at'>): Promise<EnergyLog> {
    const list = await this.getEnergyLogs();
    const newLog: EnergyLog = {
      ...data,
      id: `eng-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      owner_id: data.owner_id || DEMO_OWNER_ID,
      created_at: new Date().toISOString(),
    };
    list.unshift(newLog);
    this.setItem(STORAGE_KEYS.ENERGY_LOGS, list);
    return newLog;
  }

  async updateEnergyLog(id: string, data: Partial<EnergyLog>): Promise<EnergyLog> {
    const list = await this.getEnergyLogs();
    const index = list.findIndex((e) => e.id === id);
    if (index === -1) throw new Error('주유·충전 기록을 찾을 수 없습니다.');
    const updated = { ...list[index], ...data };
    list[index] = updated;
    this.setItem(STORAGE_KEYS.ENERGY_LOGS, list);
    return updated;
  }

  async deleteEnergyLog(id: string): Promise<void> {
    let list = await this.getEnergyLogs();
    list = list.filter((e) => e.id !== id);
    this.setItem(STORAGE_KEYS.ENERGY_LOGS, list);
  }

  // --- Maintenance Logs ---
  async getMaintenanceLogs(vehicleId?: string): Promise<MaintenanceLog[]> {
    const list = this.getItem<MaintenanceLog[]>(STORAGE_KEYS.MAINT_LOGS, []);
    return vehicleId ? list.filter((m) => m.vehicle_id === vehicleId) : list;
  }

  async createMaintenanceLog(
    data: Omit<MaintenanceLog, 'id' | 'created_at'>
  ): Promise<MaintenanceLog> {
    const list = await this.getMaintenanceLogs();
    const newLog: MaintenanceLog = {
      ...data,
      id: `maint-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      owner_id: data.owner_id || DEMO_OWNER_ID,
      created_at: new Date().toISOString(),
    };
    list.unshift(newLog);
    this.setItem(STORAGE_KEYS.MAINT_LOGS, list);
    return newLog;
  }

  async updateMaintenanceLog(
    id: string,
    data: Partial<MaintenanceLog>
  ): Promise<MaintenanceLog> {
    const list = await this.getMaintenanceLogs();
    const index = list.findIndex((m) => m.id === id);
    if (index === -1) throw new Error('정비 기록을 찾을 수 없습니다.');
    const updated = { ...list[index], ...data };
    list[index] = updated;
    this.setItem(STORAGE_KEYS.MAINT_LOGS, list);
    return updated;
  }

  async deleteMaintenanceLog(id: string): Promise<void> {
    let list = await this.getMaintenanceLogs();
    list = list.filter((m) => m.id !== id);
    this.setItem(STORAGE_KEYS.MAINT_LOGS, list);
  }

  // --- Replacement Candidates ---
  async getReplacementCandidates(): Promise<ReplacementCandidate[]> {
    return this.getItem<ReplacementCandidate[]>(STORAGE_KEYS.CANDIDATES, []);
  }

  async createReplacementCandidate(
    data: Omit<ReplacementCandidate, 'id' | 'created_at'>
  ): Promise<ReplacementCandidate> {
    const list = await this.getReplacementCandidates();
    const newCand: ReplacementCandidate = {
      ...data,
      id: `cand-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      owner_id: data.owner_id || DEMO_OWNER_ID,
      created_at: new Date().toISOString(),
    };
    list.unshift(newCand);
    this.setItem(STORAGE_KEYS.CANDIDATES, list);
    return newCand;
  }

  async updateReplacementCandidate(
    id: string,
    data: Partial<ReplacementCandidate>
  ): Promise<ReplacementCandidate> {
    const list = await this.getReplacementCandidates();
    const index = list.findIndex((c) => c.id === id);
    if (index === -1) throw new Error('교체 후보 차량을 찾을 수 없습니다.');
    const updated = { ...list[index], ...data };
    list[index] = updated;
    this.setItem(STORAGE_KEYS.CANDIDATES, list);
    return updated;
  }

  async deleteReplacementCandidate(id: string): Promise<void> {
    let list = await this.getReplacementCandidates();
    list = list.filter((c) => c.id !== id);
    this.setItem(STORAGE_KEYS.CANDIDATES, list);
  }

  // --- Analyses (Snapshot Records) ---
  async getAnalyses(): Promise<AnalysisRecord[]> {
    return this.getItem<AnalysisRecord[]>(STORAGE_KEYS.ANALYSES, []);
  }

  async getAnalysisById(id: string): Promise<AnalysisRecord | null> {
    const list = await this.getAnalyses();
    return list.find((a) => a.id === id) || null;
  }

  async saveAnalysis(
    data: Omit<AnalysisRecord, 'id' | 'created_at'>
  ): Promise<AnalysisRecord> {
    const list = await this.getAnalyses();
    // 깊은 복사를 통해 완벽한 스냅샷 불변성 보장
    const clonedInput = JSON.parse(JSON.stringify(data.input_snapshot));
    const clonedResult = JSON.parse(JSON.stringify(data.result_snapshot));

    const newRecord: AnalysisRecord = {
      id: `ana-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      owner_id: data.owner_id || DEMO_OWNER_ID,
      title: data.title,
      created_at: new Date().toISOString(),
      existing_vehicle_id: data.existing_vehicle_id,
      replacement_candidate_id: data.replacement_candidate_id,
      input_snapshot: clonedInput,
      result_snapshot: clonedResult,
    };
    list.unshift(newRecord);
    this.setItem(STORAGE_KEYS.ANALYSES, list);
    return newRecord;
  }

  async deleteAnalysis(id: string): Promise<void> {
    let list = await this.getAnalyses();
    list = list.filter((a) => a.id !== id);
    this.setItem(STORAGE_KEYS.ANALYSES, list);
  }

  // --- Reset Demo Data ---
  async resetToDemoData(): Promise<void> {
    this.seedInitialData();
  }
}

// 싱글톤 리포지토리 인스턴스 (Supabase 클라우드 DB 연결)
// 주의: 클라우드 연결 오류 시 자동으로 로컬 저장소로 fallback하지 않고 명확한 에러를 화면에 표시합니다.
import { supabaseFleetRepository } from './supabaseRepository';
export const fleetRepository: IFleetRepository = supabaseFleetRepository;

