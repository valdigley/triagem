/*
  # Add index to photographers user_id column

  1. Performance Optimization
    - Add index on `user_id` column in `photographers` table
    - This will significantly speed up queries that filter by `user_id`
    - Resolves statement timeout issues when fetching photographer data

  2. Index Details
    - Creates a B-tree index on the `user_id` column
    - Uses IF NOT EXISTS to prevent errors if index already exists
    - Named `photographers_user_id_idx` for clarity
*/

-- Add index to photographers.user_id column to improve query performance
CREATE INDEX IF NOT EXISTS photographers_user_id_idx ON photographers (user_id);