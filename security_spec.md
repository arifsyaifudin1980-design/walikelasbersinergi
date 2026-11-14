# Security Specification — Presensi Pintar Madrasah

## 1. Data Invariants & Master Source of Truth
1. **Master Identity (`admins/{uid}`, `users/{userId}`, `staff_bindings/{uid}`)**:
   - Bootstrapped administrator (`arifsyaifudin1980@gmail.com`, `email_verified == true`) and UIDs present in `/admins/{uid}` hold administrative privileges (`isAdmin()`).
   - Non-admin staff (`wali_kelas`) must first be provisioned by Admin in `/users/{userId}` with an explicit Google email and `isActive: true`. Upon Google login (`email_verified == true`), the client binds their UID in `/staff_bindings/{uid}` ONLY when Firestore rules verify that `users/{userId}` exists, `email` matches `request.auth.token.email`, `isActive == true`, and `role` & `assignedClassId` match the Admin-assigned values verbatim. Users cannot self-assign roles or escalate privileges.
2. **Institutional Config (`/madrasah_config/main`, `/madrasah_config/academic_snapshot`)**:
   - Readable via `get` only by verified Admins or bound Staff; writable strictly by Admin. `logoUrl` is bounded to `<= 750000` chars to remain well below Firestore's 1 MiB document cap.
3. **Classroom QR Verification (`/classes/{classId}`, `/class_qr_codes/{qrId}`)**:
   - Student/teacher PII (emails, WhatsApp numbers) is isolated to Admin & assigned Wali Kelas (`/classes`, `/students`, `/daily_attendance`, `/report_archives`, `/correction_logs`).
   - `/class_qr_codes/{classId}` stores only non-PII classroom identifiers (`classId`, `className`, `grade`, `homeroomTeacherName`, `homeroomTeacherUid`, `qrToken`, `isActive`). Any verified teacher scanning a physical QR code reads only the target document via `allow get`.
4. **Teacher Teaching Attendance (`/teaching_attendance/{sessionId}`)**:
   - Creation requires `request.auth.token.email_verified == true`, `status == 'mengajar'`, `recordedByUid == request.auth.uid`, `recordedByEmail == request.auth.token.email`, `arrivalAt == request.time`, AND relational verification (`exists()` & `get()`) that `/class_qr_codes/{classId}` exists, `isActive == true`, and `qrToken` matches the classroom's active QR token.
   - Checkout (`status: 'mengajar' -> 'selesai'`) uses an explicit action branch with `affectedKeys().hasOnly(...)` and enforces **Terminal State Locking**: once `status == 'selesai'`, non-admin users cannot update the record again.
5. **List Query Hardening**:
   - Every `allow list` rule enforces `isBootstrappedAdmin()` (pure auth-token claim check, zero DB reads) or evaluates `resource.data` directly against `request.auth.uid` / `request.auth.token.email` with zero `get()` or `exists()` lookups.

---

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return `PERMISSION_DENIED`)

1. **Unauthenticated Write (`students`)**:
   - Actor: `request.auth == null`
   - Action: `create /students/std_evil` with `{ id: "std_evil", name: "Anon", ... }`
   - Expected: `PERMISSION_DENIED` (no verified authentication).
2. **Email Spoofing Without Verification (`classes`)**:
   - Actor: `request.auth.token.email == "arifsyaifudin1980@gmail.com"`, `email_verified == false`
   - Action: `create /classes/cls_spoof`
   - Expected: `PERMISSION_DENIED` (`isBootstrappedAdmin()` enforces `email_verified == true`).
3. **Self-Assigned Privilege Escalation (`staff_bindings`)**:
   - Actor: Verified user `uid_attacker` (`attacker@gmail.com`) without a matching `users` record
   - Action: `create /staff_bindings/uid_attacker` with `{ role: "opm", assignedClassId: "cls_1" }`
   - Expected: `PERMISSION_DENIED` (`exists` & `get` check on `/users/{userId}` fails).
4. **Ghost / Shadow Field Injection (`daily_attendance`)**:
   - Actor: Verified Wali Kelas updating status
   - Action: `update /daily_attendance/att_1` adding `{ status: "H", isVerifiedOverride: true }`
   - Expected: `PERMISSION_DENIED` (blocked by `isValidDailyAttendance()` `hasOnly` and `affectedKeys().hasOnly`).
5. **QR Token Forgery on Teacher Check-In (`teaching_attendance`)**:
   - Actor: Verified teacher `uid_teacher`
   - Action: `create /teaching_attendance/teach_fake` with `{ classId: "cls_1", qrToken: "WRONG_TOKEN", status: "mengajar", ... }`
   - Expected: `PERMISSION_DENIED` (`get(/class_qr_codes/cls_1).data.qrToken == incoming().qrToken` fails).
6. **Teaching Status Shortcutting (`teaching_attendance`)**:
   - Actor: Verified teacher `uid_teacher`
   - Action: `create /teaching_attendance/teach_skip` directly with `{ status: "selesai", ... }`
   - Expected: `PERMISSION_DENIED` (create requires `incoming().status == 'mengajar'`).
7. **Post-Completion Tampering / Terminal State Unlock (`teaching_attendance`)**:
   - Actor: Verified teacher `uid_teacher` who owns the session
   - Action: `update /teaching_attendance/teach_done` (where `existing().status == 'selesai'`) changing `durationMinutes` or `status`
   - Expected: `PERMISSION_DENIED` (non-admin update requires `existing().status == 'mengajar'`).
8. **Cross-Class Student PII Snooping (`students`)**:
   - Actor: Verified Wali Kelas for `cls_A`
   - Action: `get /students/std_in_cls_B` (where `homeroomTeacherEmail` belongs to `cls_B`)
   - Expected: `PERMISSION_DENIED` (`homeroomTeacherEmail != request.auth.token.email`).
9. **Blanket Collection Scraping (`students` / `users`)**:
   - Actor: Any verified non-admin user calling `getDocs(collection(db, 'students'))` without `where('homeroomTeacherEmail', '==', myEmail)`
   - Action: `list /students`
   - Expected: `PERMISSION_DENIED` (`allow list` requires `resource.data.homeroomTeacherEmail == request.auth.token.email`).
10. **ID Poisoning / Resource Exhaustion (`teaching_attendance`)**:
    - Actor: Verified user
    - Action: `create /teaching_attendance/invalid$id..200bytes...`
    - Expected: `PERMISSION_DENIED` (`isValidId()` regex `^[a-zA-Z0-9_\\-]+$` rejects invalid doc ID).
11. **Client Timestamp Forgery (`daily_attendance`)**:
    - Actor: Verified Wali Kelas
    - Action: `create /daily_attendance/att_backdate` with `createdAt` set to `"2020-01-01T00:00:00Z"` instead of `serverTimestamp()`
    - Expected: `PERMISSION_DENIED` (`incoming().createdAt == request.time` fails).
12. **Immortal Audit Log Tampering (`audit_logs` / `correction_logs`)**:
    - Actor: Verified user or Wali Kelas
    - Action: `update /audit_logs/aud_1` or `delete /correction_logs/cor_1`
    - Expected: `PERMISSION_DENIED` (`allow update: if false;` on audit & correction logs).
