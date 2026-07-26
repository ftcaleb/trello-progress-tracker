-- Rollback for 0006_attendance_amendment.sql
drop function if exists public.admin_amend_attendance(uuid, uuid, text, text);
