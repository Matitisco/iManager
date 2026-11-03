import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { moneyInput } from '../../lib/money-input.js';
import { canSeeFinancials } from '../stores/sections.js';

// Blank means leave the inventory cost untouched, including historical sale edits.
export const saleCostInput = z.preprocess(
  value => value == null || typeof value === 'string' && value.trim() === '' ? undefined : value,
  moneyInput().optional(),
);

export function requireSaleCostAccess(request: FastifyRequest, reply: FastifyReply) {
  if (request.body && typeof request.body === 'object' && 'cost' in request.body
    && request.appUser && !canSeeFinancials(request.appUser)) {
    reply.code(403).send({ error: 'No tenés permiso para cambiar el costo' });
    return false;
  }
  return true;
}
