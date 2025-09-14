import { describe, it, expect, beforeEach } from "vitest";
import { stringAsciiCV, uintCV, principalCV, optionalCV, boolCV, listCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_ACTION_TYPE = 101;
const ERR_INVALID_DONATION_ID = 102;
const ERR_INVALID_NONPROFIT_ID = 103;
const ERR_INVALID_DETAILS = 104;
const ERR_LOG_ID_NOT_FOUND = 105;
const ERR_PAGINATION_INVALID = 106;
const ERR_QUERY_LIMIT_EXCEEDED = 107;

interface LogEntry {
  actionType: string;
  donationId: number;
  nonprofitId: number;
  details: string;
  timestamp: number;
  status: boolean;
  verifier?: string;
  evidenceHash?: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class TransparencyLogMock {
  state: {
    logCounter: number;
    maxLogsPerQuery: number;
    queryLimit: number;
    adminPrincipal: string | null;
    logs: Map<number, LogEntry>;
    logIndexes: Map<number, number[]>;
    nonprofitIndexes: Map<number, number[]>;
    actionTypeIndexes: Map<number, number[]>;
  } = {
    logCounter: 0,
    maxLogsPerQuery: 50,
    queryLimit: 1000,
    adminPrincipal: null,
    logs: new Map(),
    logIndexes: new Map(),
    nonprofitIndexes: new Map(),
    actionTypeIndexes: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  authorizedContracts: Set<string> = new Set(["ST1TEST", "donation-manager", "fund-allocator", "spending-submitter", "auditor-verifier"]);

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      logCounter: 0,
      maxLogsPerQuery: 50,
      queryLimit: 1000,
      adminPrincipal: null,
      logs: new Map(),
      logIndexes: new Map(),
      nonprofitIndexes: new Map(),
      actionTypeIndexes: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.authorizedContracts = new Set(["ST1TEST", "donation-manager", "fund-allocator", "spending-submitter", "auditor-verifier"]);
  }

  setAdminPrincipal(principal: string): Result<boolean> {
    if (!this.state.adminPrincipal) return { ok: false, value: false };
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: false };
    this.state.adminPrincipal = principal;
    return { ok: true, value: true };
  }

  setMaxLogsPerQuery(newMax: number): Result<boolean> {
    if (!this.state.adminPrincipal) return { ok: false, value: false };
    if (newMax <= 0 || newMax > 100) return { ok: false, value: false };
    this.state.maxLogsPerQuery = newMax;
    return { ok: true, value: true };
  }

  logAction(
    actionType: string,
    donationId: number,
    nonprofitId: number,
    details: string,
    evidenceHash?: string
  ): Result<number> {
    if (!this.authorizedContracts.has(this.caller)) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (!["donation-received", "fund-allocated", "spending-submitted", "spending-verified", "spending-rejected", "audit-completed"].includes(actionType)) {
      return { ok: false, value: ERR_INVALID_ACTION_TYPE };
    }
    if (donationId <= 0) return { ok: false, value: ERR_INVALID_DONATION_ID };
    if (nonprofitId <= 0) return { ok: false, value: ERR_INVALID_NONPROFIT_ID };
    if (details.length > 256) return { ok: false, value: ERR_INVALID_DETAILS };

    const id = this.state.logCounter;
    const logEntry: LogEntry = {
      actionType,
      donationId,
      nonprofitId,
      details,
      timestamp: this.blockHeight,
      status: true,
      ...(evidenceHash && { evidenceHash }),
    };
    this.state.logs.set(id, logEntry);
    this.updateIndexes(id, actionType, donationId, nonprofitId);
    this.state.logCounter++;
    return { ok: true, value: id };
  }

  updateLogStatus(logId: number, newStatus: boolean, verifier: string): Result<boolean> {
    const logEntry = this.state.logs.get(logId);
    if (!logEntry) return { ok: false, value: false };
    if (!this.authorizedContracts.has(this.caller)) return { ok: false, value: false };
    if (logEntry.status === newStatus) return { ok: false, value: false };
    logEntry.status = newStatus;
    logEntry.verifier = verifier;
    this.state.logs.set(logId, logEntry);
    return { ok: true, value: true };
  }

  private updateIndexes(id: number, actionType: string, donationId: number, nonprofitId: number) {
    this.appendToIndex(this.state.logIndexes, donationId, id);
    this.appendToIndex(this.state.nonprofitIndexes, nonprofitId, id);
    const actionKey = actionType.charCodeAt(0); 
    this.appendToIndex(this.state.actionTypeIndexes, actionKey, id);
  }

  private appendToIndex(indexes: Map<number, number[]>, key: number, value: number) {
    let list = indexes.get(key) || [];
    if (list.length >= 200) return;
    list.push(value);
    indexes.set(key, list);
  }

  getLog(logId: number): LogEntry | null {
    return this.state.logs.get(logId) || null;
  }

  getLogsByDonation(donationId: number, start: number, limit: number): Result<LogEntry[]> {
    if (start < 0 || limit > 50) return { ok: false, value: [] };
    const index = this.state.logIndexes.get(donationId) || [];
    const adjustedLimit = Math.min(limit, this.state.maxLogsPerQuery);
    const paginated = index.slice(start, start + adjustedLimit).map(id => this.getLog(id)).filter(Boolean) as LogEntry[];
    return { ok: true, value: paginated };
  }

  getLogsByNonprofit(nonprofitId: number, start: number, limit: number): Result<LogEntry[]> {
    if (start < 0 || limit > 50) return { ok: false, value: [] };
    const index = this.state.nonprofitIndexes.get(nonprofitId) || [];
    const adjustedLimit = Math.min(limit, this.state.maxLogsPerQuery);
    const paginated = index.slice(start, start + adjustedLimit).map(id => this.getLog(id)).filter(Boolean) as LogEntry[];
    return { ok: true, value: paginated };
  }

  getLogsByActionType(actionType: string, start: number, limit: number): Result<LogEntry[]> {
    if (start < 0 || limit > 50) return { ok: false, value: [] };
    const actionKey = actionType.charCodeAt(0); 
    const index = this.state.actionTypeIndexes.get(actionKey) || [];
    const adjustedLimit = Math.min(limit, this.state.maxLogsPerQuery);
    const paginated = index.slice(start, start + adjustedLimit).map(id => this.getLog(id)).filter(Boolean) as LogEntry[];
    return { ok: true, value: paginated };
  }

  getTotalLogs(): Result<number> {
    return { ok: true, value: this.state.logCounter };
  }

  getLogCountByDonation(donationId: number): Result<number> {
    return { ok: true, value: this.state.logIndexes.get(donationId)?.length || 0 };
  }

  getLogCountByNonprofit(nonprofitId: number): Result<number> {
    return { ok: true, value: this.state.nonprofitIndexes.get(nonprofitId)?.length || 0 };
  }

  getLogCountByActionType(actionType: string): Result<number> {
    const actionKey = actionType.charCodeAt(0); 
    return { ok: true, value: this.state.actionTypeIndexes.get(actionKey)?.length || 0 };
  }
}

describe("TransparencyLog", () => {
  let contract: TransparencyLogMock;

  beforeEach(() => {
    contract = new TransparencyLogMock();
    contract.reset();
  });

  it("logs an action successfully", () => {
    contract.authorizedContracts.add("test-caller");
    contract.caller = "test-caller";
    const result = contract.logAction("donation-received", 1, 100, "Donation of 10 STX received", "abc123hash");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);

    const log = contract.getLog(0);
    expect(log?.actionType).toBe("donation-received");
    expect(log?.donationId).toBe(1);
    expect(log?.nonprofitId).toBe(100);
    expect(log?.details).toBe("Donation of 10 STX received");
    expect(log?.evidenceHash).toBe("abc123hash");
    expect(log?.status).toBe(true);
    expect(contract.getTotalLogs().value).toBe(1);
  });

  it("rejects unauthorized log action", () => {
    contract.caller = "unauthorized";
    const result = contract.logAction("fund-allocated", 1, 100, "Funds allocated to project");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("rejects invalid action type", () => {
    contract.authorizedContracts.add("test-caller");
    contract.caller = "test-caller";
    const result = contract.logAction("invalid-type", 1, 100, "Invalid");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_ACTION_TYPE);
  });

  it("rejects invalid donation ID", () => {
    contract.authorizedContracts.add("test-caller");
    contract.caller = "test-caller";
    const result = contract.logAction("donation-received", 0, 100, "Invalid ID");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_DONATION_ID);
  });

  it("updates log status successfully", () => {
    contract.authorizedContracts.add("test-caller");
    contract.caller = "test-caller";
    contract.logAction("spending-submitted", 1, 100, "Spending submitted");
    const result = contract.updateLogStatus(0, false, "ST2TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);

    const log = contract.getLog(0);
    expect(log?.status).toBe(false);
    expect(log?.verifier).toBe("ST2TEST");
  });

  it("rejects update for non-existent log", () => {
    contract.authorizedContracts.add("test-caller");
    contract.caller = "test-caller";
    const result = contract.updateLogStatus(999, true, "ST2TEST");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("retrieves logs by donation with pagination", () => {
    contract.authorizedContracts.add("test-caller");
    contract.caller = "test-caller";
    contract.logAction("donation-received", 1, 100, "Log1");
    contract.logAction("fund-allocated", 1, 100, "Log2");
    contract.logAction("spending-verified", 1, 100, "Log3");

    const result = contract.getLogsByDonation(1, 0, 2);
    expect(result.ok).toBe(true);
    expect(result.value.length).toBe(2);
    expect(result.value[0]?.details).toBe("Log1");
    expect(result.value[1]?.details).toBe("Log2");
  });

  it("retrieves logs by nonprofit", () => {
    contract.authorizedContracts.add("test-caller");
    contract.caller = "test-caller";
    contract.logAction("donation-received", 1, 100, "Log1");
    contract.logAction("fund-allocated", 2, 100, "Log2");

    const result = contract.getLogsByNonprofit(100, 0, 10);
    expect(result.ok).toBe(true);
    expect(result.value.length).toBe(2);
  });

  it("gets log count by donation", () => {
    contract.authorizedContracts.add("test-caller");
    contract.caller = "test-caller";
    contract.logAction("donation-received", 1, 100, "Log1");
    contract.logAction("fund-allocated", 1, 100, "Log2");

    const result = contract.getLogCountByDonation(1);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("rejects pagination with invalid params", () => {
    const result = contract.getLogsByDonation(1, -1, 60);
    expect(result.ok).toBe(false);
    expect(result.value).toEqual([]);
  });
});