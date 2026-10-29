import {z} from 'zod';
export const creditInput=z.object({amount_minor:z.number().int().positive().max(100000000000),reason:z.string().trim().min(5).max(1000),issued_on:z.string().date()}).strict();
export const allocationInput=z.object({allocations:z.array(z.object({document_id:z.string().uuid(),amount_minor:z.number().int().positive().max(100000000000)}).strict()).min(1).max(50),reason:z.string().trim().min(5).max(1000)}).strict();
export const returnInput=z.object({type:z.enum(['refunded','reversed']),amount_minor:z.number().int().positive().max(100000000000),reason:z.string().trim().min(5).max(1000)}).strict();
export const fulfillmentInput=z.object({action:z.enum(['fulfill','skip']),record_expense:z.boolean().default(false)}).strict();
export const requestInput=z.object({document_id:z.string().uuid(),amount_minor:z.number().int().positive().max(100000000000).optional(),expires_in_hours:z.number().int().min(1).max(168).default(24)}).strict();
