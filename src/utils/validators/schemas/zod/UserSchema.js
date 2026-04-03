// src/utils/validators/schemas/zod/UserSchema.js

import { z } from 'zod/v4';

/**
 * Schema for updating a user profile.
 * All fields are optional — the controller validates that at least one field is present.
 */
export const UserUpdateSchema = z.object({
    name: z
        .string()
        .min(2, 'Name must be at least 2 characters.')
        .max(100, 'Name must be at most 100 characters.')
        .optional(),
    email: z
        .email('Invalid email format.')
        .optional(),
    image: z
        .string()
        .url('Image must be a valid URL.')
        .optional()
        .nullable(),
}).strict();

export default UserUpdateSchema;
