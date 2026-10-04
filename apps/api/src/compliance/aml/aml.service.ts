import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { createHash } from 'crypto';
import { AmlAlert } from '../entities/aml-alert.entity';
import { DeviceFingerprint } from '../entities/device-fingerprint.entity';
import { evaluateVelocity } from './rules/velocity.rule';
import { evaluatePatterns } from './rules/patterns.rule';
import { evaluateMultiAccount } from './rules/multi-account.rule';
import { evaluateCountry } from './rules/country.rule';
import type { AmlFinding, RiskContext, TxEvent } from './aml.types';

/**
 * AML monitoring engine.
 * Evaluates every monetary event when REAL_MONEY_ENABLED.
 * Findings with blockOperation=true must stop the transaction
 * and open a manual review case — no automatic override API.
 */
@Injectable()
export class AmlService {
  private readonly logger = new Logger(AmlService.name);
  /** In-memory recent txs per user (supplement with DB in production) */
  private readonly recentTx = new Map<string, TxEvent[]>();

  constructor(
    @InjectRepository(AmlAlert)
    private readonly alertRepo: Repository<AmlAlert>,
    @InjectRepository(DeviceFingerprint)
    private readonly deviceRepo: Repository<DeviceFingerprint>,
  ) {}

  hashIp(ip: string): string {
    return createHash('sha256').update(ip).digest('hex').slice(0, 32);
  }

  async recordDevice(input: {
    userId: string;
    fingerprintHash: string;
    ip?: string;
    userAgent?: string;
    countryCode?: string;
    signals?: Record<string, unknown>;
  }) {
    let row = await this.deviceRepo.findOne({
      where: {
        userId: input.userId,
        fingerprintHash: input.fingerprintHash,
      },
    });
    if (row) {
      row.lastSeenAt = new Date();
      if (input.ip) row.ipHash = this.hashIp(input.ip);
      await this.deviceRepo.save(row);
      return row;
    }
    return this.deviceRepo.save(
      this.deviceRepo.create({
        userId: input.userId,
        fingerprintHash: input.fingerprintHash,
        ipHash: input.ip ? this.hashIp(input.ip) : null,
        userAgentHash: input.userAgent
          ? createHash('sha256').update(input.userAgent).digest('hex').slice(0, 32)
          : null,
        countryCode: input.countryCode || null,
        signals: input.signals || null,
        lastSeenAt: new Date(),
      }),
    );
  }

  async linkedUsersByDevice(fingerprintHash: string): Promise<string[]> {
    const rows = await this.deviceRepo.find({ where: { fingerprintHash } });
    return Array.from(new Set(rows.map((r) => r.userId)));
  }

  async linkedUsersByIp(ip: string): Promise<string[]> {
    const ipHash = this.hashIp(ip);
    const rows = await this.deviceRepo.find({ where: { ipHash } });
    return Array.from(new Set(rows.map((r) => r.userId)));
  }

  /**
   * Run full AML evaluation for a transaction event.
   * Returns findings; caller MUST abort if any blockOperation is true.
   */
  async evaluateTransaction(
    event: TxEvent,
    ctx: RiskContext,
  ): Promise<{ findings: AmlFinding[]; blocked: boolean; alertIds: string[] }> {
    const prior = this.recentTx.get(event.userId) || [];
    const findings: AmlFinding[] = [
      ...evaluateVelocity(event, prior),
      ...evaluatePatterns(event, prior),
      ...evaluateCountry(ctx),
    ];

    if (ctx.deviceFingerprint) {
      const linked = await this.linkedUsersByDevice(ctx.deviceFingerprint);
      findings.push(...evaluateMultiAccount(ctx, linked));
    } else if (ctx.ip) {
      const linked = await this.linkedUsersByIp(ctx.ip);
      findings.push(...evaluateMultiAccount(ctx, linked));
    }

    // Persist alerts
    const alertIds: string[] = [];
    for (const f of findings) {
      const alert = await this.alertRepo.save(
        this.alertRepo.create({
          userId: event.userId,
          rule: f.rule,
          severity: f.severity,
          summary: f.summary,
          evidence: f.evidence,
          status: 'OPEN',
        }),
      );
      alertIds.push(alert.id);
      this.logger.warn(`AML ${f.severity} ${f.rule}: ${f.summary}`);
    }

    // Update rolling window (keep 48h)
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    const next = [...prior, { ...event, at: event.at || new Date() }].filter(
      (t) => (t.at?.getTime() || 0) >= cutoff,
    );
    this.recentTx.set(event.userId, next);

    const blocked = findings.some((f) => f.blockOperation);
    return { findings, blocked, alertIds };
  }

  async listOpenAlerts(page = 1, limit = 30) {
    const [items, total] = await this.alertRepo.findAndCount({
      where: { status: 'OPEN' },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async assignReview(alertId: string, reviewerId: string) {
    const alert = await this.alertRepo.findOne({ where: { id: alertId } });
    if (!alert) return null;
    alert.status = 'IN_REVIEW';
    alert.reviewerId = reviewerId;
    return this.alertRepo.save(alert);
  }

  /**
   * Resolve alert after human review.
   * DISMISSED does not unlock a blocked tx automatically —
   * finance ops must re-submit the transaction for a fresh AML pass.
   */
  async resolveAlert(
    alertId: string,
    reviewerId: string,
    decision: 'CONFIRMED' | 'DISMISSED',
    notes: string,
  ) {
    const alert = await this.alertRepo.findOne({ where: { id: alertId } });
    if (!alert) return null;
    alert.status = decision;
    alert.reviewerId = reviewerId;
    alert.reviewNotes = notes;
    alert.resolvedAt = new Date();
    return this.alertRepo.save(alert);
  }

  async openAlertsForUser(userId: string, sinceHours = 24) {
    const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
    return this.alertRepo.find({
      where: {
        userId,
        status: 'OPEN',
        createdAt: MoreThan(since),
      },
      order: { createdAt: 'DESC' },
    });
  }
}
