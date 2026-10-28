import { z } from 'zod';
import {passwordIssue} from './password-strength';
export {passwordIssue} from './password-strength';
export const newPassword = z.string().max(400).refine(value => !passwordIssue(value), {message:'Use a unique password of 8–200 characters.'});
