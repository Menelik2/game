import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  country: z.string().length(2),
  acceptTerms: z.literal(true),
  acceptAge: z.literal(true),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const spinSchema = z.object({
  sessionId: z.string().uuid(),
  betAmount: z.number().positive().max(100000),
  idempotencyKey: z.string().min(8).max(64),
  clientSeed: z.string().max(64).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SpinInput = z.infer<typeof spinSchema>;
