export type AmlSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AmlRuleId =
  | 'VELOCITY_DEPOSIT'
  | 'VELOCITY_WITHDRAWAL'
  | 'UNUSUAL_AMOUNT'
  | 'RAPID_ROUND_TRIP'
  | 'MULTI_ACCOUNT_DEVICE'
  | 'MULTI_ACCOUNT_IP'
  | 'COUNTRY_BLOCKED'
  | 'COUNTRY_MISMATCH'
  | 'IP_RISK'
  | 'STRUCTURING';

export interface TxEvent {
  userId: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER' | 'BET' | 'PAYOUT';
  amount: number;
  currency: string;
  ip?: string;
  deviceFingerprint?: string;
  countryCode?: string;
  at?: Date;
}

export interface AmlFinding {
  rule: AmlRuleId;
  severity: AmlSeverity;
  summary: string;
  evidence: Record<string, unknown>;
  /** If true, hold funds / block operation pending manual review */
  blockOperation: boolean;
}

export interface RiskContext {
  userId: string;
  kycStatus: string;
  accountAgeHours: number;
  countryCode?: string;
  ipCountry?: string;
  deviceFingerprint?: string;
  ip?: string;
}
