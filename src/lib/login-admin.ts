import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import {
  defaultFeaturesForRole,
  featuresCreatorCanAssign,
  isFixedStaffRole,
  parseFeatureIds,
  rolesCreatorCanAssign,
  type RoleType,
} from "./auth-service";

function adminClient() {
  const url = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) {
    // Never include credential values in thrown/logged errors.
    throw new Error(
      "Server is missing Supabase service credentials (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const createStaffLogin = createServerFn({ method: "POST" })
  .validator(
    (input: {
      creatorRole: RoleType;
      creatorName?: string;
      name: string;
      email: string;
      password: string;
      phone?: string;
      /** Sticky base role — never rewritten to custom when features change. */
      role: RoleType;
      features: string[];
      companyId?: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    if (!canProposeStaff(data.creatorRole) && !canManageStaff(data.creatorRole)) {
      return { ok: false as const, error: "You cannot create team logins." };
    }
    const assignable = new Set(rolesCreatorCanAssign(data.creatorRole));
    if (!isFixedStaffRole(data.role) || !assignable.has(data.role)) {
      return { ok: false as const, error: "Choose a valid staff role (sales, logistics, supervisor, …)." };
    }
    const allowed = new Set(featuresCreatorCanAssign(data.creatorRole));
    const features = parseFeatureIds(
      data.features.length ? data.features : defaultFeaturesForRole(data.role),
    );
    if (!features.length || features.some((feature) => !allowed.has(feature))) {
      return { ok: false as const, error: "Choose one or more features you are allowed to grant." };
    }
    const name = data.name.trim();
    const email = data.email.trim().toLowerCase();
    if (!name || !email || data.password.length < 6) {
      return {
        ok: false as const,
        error: "Name, email, and a password of at least 6 characters are required.",
      };
    }

    const needsApproval = data.creatorRole === "supervisor";
    const status: StaffStatus = needsApproval ? "Pending approval" : "Active";
    const role = data.role;
    const admin = adminClient();
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      ban_duration: needsApproval ? "876600h" : undefined,
      user_metadata: {
        full_name: name,
        role,
        features,
        phone: data.phone?.trim() || "",
        company: data.companyId || "all",
        status,
        proposed_by_role: data.creatorRole,
        proposed_by_name: data.creatorName?.trim() || "",
      },
    });
    if (error || !created.user) {
      return { ok: false as const, error: error?.message || "Could not create login." };
    }

    const initials =
      name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "NA";
    await admin.from("user_profiles").insert({
      id: created.user.id,
      auth_user_id: created.user.id,
      full_name: name,
      email,
      phone: data.phone?.trim() || null,
      role_id: role,
      initials,
      default_company_id: data.companyId && data.companyId !== "all" ? data.companyId : "all",
      is_active: !needsApproval,
    });

    return {
      ok: true as const,
      email,
      pending: needsApproval,
    };
  });

export const listStaffLogins = createServerFn({ method: "GET" }).handler(async () => {
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) return { ok: false as const, error: error.message, users: [] as StaffLogin[] };

  const { data: profiles } = await admin
    .from("user_profiles")
    .select("id, email, full_name, phone, is_active");
  const profileById = new Map(
    (profiles || []).map((p) => [String(p.id), p] as const),
  );
  const profileByEmail = new Map(
    (profiles || [])
      .filter((p) => p.email)
      .map((p) => [String(p.email).toLowerCase(), p] as const),
  );

  const users = data.users
    .filter((user) => user.email && typeof user.user_metadata?.["role"] === "string")
    .map((user) => {
      const profile =
        profileById.get(user.id) || profileByEmail.get(user.email!.toLowerCase());
      const banned =
        Boolean(user.banned_until) && new Date(user.banned_until as string).getTime() > Date.now();
      const metaStatus = String(user.user_metadata?.["status"] || "");
      const inactiveProfile = profile?.is_active === false;
      const pending =
        metaStatus.toLowerCase() === "pending approval" ||
        metaStatus.toLowerCase() === "pending";
      const status: StaffStatus = pending
        ? "Pending approval"
        : banned || inactiveProfile || metaStatus.toLowerCase() === "inactive"
          ? "Inactive"
          : "Active";
      const metaName = String(user.user_metadata?.["full_name"] || "").trim();
      const profileName = String(profile?.full_name || "").trim();
      return {
        id: user.id,
        name: metaName || profileName || (user.email as string),
        email: user.email as string,
        role: String(user.user_metadata["role"]),
        features: parseFeatureIds(user.user_metadata?.["features"]),
        phone: String(user.user_metadata?.["phone"] || profile?.phone || ""),
        status,
        proposedByName: String(user.user_metadata?.["proposed_by_name"] || ""),
        proposedByRole: String(user.user_metadata?.["proposed_by_role"] || ""),
      };
    });
  return { ok: true as const, users };
});

export type StaffStatus = "Active" | "Inactive" | "Pending approval";

export type StaffLogin = {
  id: string;
  name: string;
  email: string;
  role: string;
  features: string[];
  phone: string;
  status: StaffStatus;
  proposedByName?: string;
  proposedByRole?: string;
};

/** Private Supabase Storage bucket — never public. Access only via short-lived signed URLs. */
const STAFF_BUCKET = "staff-docs";
const STAFF_BUCKET_OPTIONS = {
  public: false as const,
  fileSizeLimit: 4 * 1024 * 1024,
  allowedMimeTypes: ["application/pdf"],
};

export function canManageStaff(role: string | undefined) {
  return role === "super_admin";
}

/** Supervisors may propose logins; Super Admin activates them. */
export function canProposeStaff(role: string | undefined) {
  return role === "super_admin" || role === "supervisor";
}

export function staffPdfName(name: string) {
  const base = (name.split(/[/\\]/).pop() || "document.pdf")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 80);
  return base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
}

export function staffPdfBytes(input: string) {
  const clean = input.replace(/^data:application\/pdf;base64,/i, "").trim();
  const bytes = Buffer.from(clean, "base64");
  if (!clean || bytes.length === 0 || bytes.length > 4 * 1024 * 1024) {
    return { ok: false as const, error: "PDF must be under 4 MB." };
  }
  if (bytes.subarray(0, 5).toString() !== "%PDF-") {
    return { ok: false as const, error: "Only PDF files can be stored." };
  }
  return { ok: true as const, bytes };
}

function ownerGate(role: string) {
  if (!canManageStaff(role)) return { ok: false as const, error: "Only the owner can do that." };
  return null;
}

/** Ensures staff PDFs land in a private bucket (forces public=false even if it already existed). */
async function docsBucket() {
  const admin = adminClient();
  const { data: buckets, error: listError } = await admin.storage.listBuckets();
  if (listError) throw new Error(listError.message);

  const existing = buckets?.find((bucket) => bucket.name === STAFF_BUCKET || bucket.id === STAFF_BUCKET);
  if (!existing) {
    const { error } = await admin.storage.createBucket(STAFF_BUCKET, STAFF_BUCKET_OPTIONS);
    if (error && !/exist/i.test(error.message)) throw new Error(error.message);
  }

  const { error: updateError } = await admin.storage.updateBucket(
    STAFF_BUCKET,
    STAFF_BUCKET_OPTIONS,
  );
  if (updateError && !/not\s*found|exist/i.test(updateError.message)) {
    throw new Error(updateError.message);
  }
  return admin;
}

export const updateStaffLogin = createServerFn({ method: "POST" })
  .validator(
    (input: {
      actorRole: RoleType;
      userId: string;
      /** Optional sticky role fix (e.g. migrate legacy "custom" → sales). */
      role?: RoleType;
      features?: string[];
      password?: string;
      status?: StaffStatus;
    }) => input,
  )
  .handler(async ({ data }) => {
    const denied = ownerGate(data.actorRole);
    if (denied) return denied;
    const features = data.features ? parseFeatureIds(data.features) : undefined;
    if (!data.password && !features && !data.status && !data.role) {
      return { ok: false as const, error: "Nothing to update." };
    }
    if (data.role && !isFixedStaffRole(data.role)) {
      return { ok: false as const, error: "Role must be a fixed staff role." };
    }
    if (data.password !== undefined && data.password.length < 6) {
      return { ok: false as const, error: "Password must be at least 6 characters." };
    }
    if (features && (!features.length || features.length !== data.features?.length)) {
      return { ok: false as const, error: "Choose one or more known features." };
    }
    if (
      data.status &&
      data.status !== "Active" &&
      data.status !== "Inactive" &&
      data.status !== "Pending approval"
    ) {
      return { ok: false as const, error: "Invalid status." };
    }

    const admin = adminClient();
    const existing = await admin.auth.admin.getUserById(data.userId);
    if (existing.error || !existing.data.user) {
      return { ok: false as const, error: existing.error?.message || "Could not load login." };
    }

    const meta = { ...(existing.data.user.user_metadata || {}) };
    if (features) {
      meta["features"] = features;
      // Sticky: never rewrite role from the feature matrix.
    }
    if (data.role && isFixedStaffRole(data.role)) {
      meta["role"] = data.role;
    }
    if (data.status) meta["status"] = data.status;

    // Older role saves replaced metadata and dropped full_name — restore from profile.
    if (!meta["full_name"]) {
      let profile: {
        full_name?: string | null;
        phone?: string | null;
        default_company_id?: string | null;
      } | null = null;
      const byId = await admin
        .from("user_profiles")
        .select("full_name, phone, default_company_id")
        .eq("id", data.userId)
        .maybeSingle();
      profile = byId.data;
      if (!profile?.full_name && existing.data.user.email) {
        const byEmail = await admin
          .from("user_profiles")
          .select("full_name, phone, default_company_id")
          .eq("email", existing.data.user.email)
          .maybeSingle();
        profile = byEmail.data;
      }
      if (profile?.full_name) meta["full_name"] = profile.full_name;
      if (!meta["phone"] && profile?.phone) meta["phone"] = profile.phone;
      if (!meta["company"] && profile?.default_company_id) {
        meta["company"] = profile.default_company_id;
      }
    }

    const patch: {
      password?: string;
      user_metadata?: Record<string, unknown>;
      ban_duration?: string;
    } = {
      user_metadata: meta,
    };
    if (data.password !== undefined) patch.password = data.password;
    if (data.status === "Inactive") patch.ban_duration = "876600h";
    if (data.status === "Active") patch.ban_duration = "none";

    const { data: updated, error } = await admin.auth.admin.updateUserById(data.userId, patch);
    if (error || !updated.user) {
      return { ok: false as const, error: error?.message || "Could not update login." };
    }

    const profilePatch: Record<string, unknown> = {};
    if (data.role || (features && isFixedStaffRole(String(meta["role"])))) {
      profilePatch["role_id"] = meta["role"];
    }
    if (data.status) profilePatch["is_active"] = data.status === "Active";
    if (Object.keys(profilePatch).length > 0) {
      await admin.from("user_profiles").update(profilePatch).eq("id", data.userId);
      if (updated.user.email) {
        await admin.from("user_profiles").update(profilePatch).eq("email", updated.user.email);
      }
    }
    return { ok: true as const };
  });

export const approveStaffLogin = createServerFn({ method: "POST" })
  .validator((input: { actorRole: RoleType; userId: string }) => input)
  .handler(async ({ data }) => {
    const denied = ownerGate(data.actorRole);
    if (denied) return denied;
    const admin = adminClient();
    const existing = await admin.auth.admin.getUserById(data.userId);
    if (existing.error || !existing.data.user) {
      return { ok: false as const, error: existing.error?.message || "Could not load login." };
    }
    const meta = { ...(existing.data.user.user_metadata || {}) };
    const current = String(meta["status"] || "");
    if (current.toLowerCase() !== "pending approval" && current.toLowerCase() !== "pending") {
      return { ok: false as const, error: "This login is not waiting for approval." };
    }
    meta["status"] = "Active";
    meta["approved_by_role"] = "super_admin";
    meta["approved_at"] = new Date().toISOString();
    const { error } = await admin.auth.admin.updateUserById(data.userId, {
      ban_duration: "none",
      user_metadata: meta,
    });
    if (error) return { ok: false as const, error: error.message };
    await admin.from("user_profiles").update({ is_active: true }).eq("id", data.userId);
    if (existing.data.user.email) {
      await admin
        .from("user_profiles")
        .update({ is_active: true })
        .eq("email", existing.data.user.email);
    }
    return { ok: true as const };
  });

export const rejectStaffLogin = createServerFn({ method: "POST" })
  .validator((input: { actorRole: RoleType; userId: string }) => input)
  .handler(async ({ data }) => {
    const denied = ownerGate(data.actorRole);
    if (denied) return denied;
    const admin = adminClient();
    const existing = await admin.auth.admin.getUserById(data.userId);
    if (existing.error || !existing.data.user) {
      return { ok: false as const, error: existing.error?.message || "Could not load login." };
    }
    const metaStatus = String(existing.data.user.user_metadata?.["status"] || "");
    if (metaStatus.toLowerCase() !== "pending approval" && metaStatus.toLowerCase() !== "pending") {
      return { ok: false as const, error: "Only pending login requests can be rejected." };
    }
    const listed = await admin.storage.from(STAFF_BUCKET).list(data.userId);
    if (listed.data?.length) {
      await admin.storage
        .from(STAFF_BUCKET)
        .remove(listed.data.map((file) => `${data.userId}/${file.name}`));
    }
    await admin.from("user_profiles").delete().eq("id", data.userId);
    const { error } = await admin.auth.admin.deleteUser(data.userId);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const deleteStaffLogin = createServerFn({ method: "POST" })
  .validator((input: { actorRole: RoleType; userId: string }) => input)
  .handler(async ({ data }) => {
    const denied = ownerGate(data.actorRole);
    if (denied) return denied;
    const admin = adminClient();
    const listed = await admin.storage.from(STAFF_BUCKET).list(data.userId);
    if (listed.data?.length) {
      await admin.storage
        .from(STAFF_BUCKET)
        .remove(listed.data.map((file) => `${data.userId}/${file.name}`));
    }
    const removed = await admin.from("user_profiles").delete().eq("id", data.userId);
    if (removed.error) return { ok: false as const, error: removed.error.message };
    const { error } = await admin.auth.admin.deleteUser(data.userId);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const listStaffDocuments = createServerFn({ method: "POST" })
  .validator((input: { actorRole: RoleType; userId: string }) => input)
  .handler(async ({ data }) => {
    const denied = ownerGate(data.actorRole);
    if (denied) return { ...denied, files: [] as string[] };
    const admin = await docsBucket();
    const { data: files, error } = await admin.storage.from(STAFF_BUCKET).list(data.userId);
    if (error) return { ok: false as const, error: error.message, files: [] as string[] };
    return {
      ok: true as const,
      files: (files ?? []).map((file) => file.name).filter((name) => name && name !== ".emptyFolderPlaceholder"),
    };
  });

export const uploadStaffDocument = createServerFn({ method: "POST" })
  .validator((input: { actorRole: RoleType; userId: string; fileName: string; base64: string }) => input)
  .handler(async ({ data }) => {
    const denied = ownerGate(data.actorRole);
    if (denied) return denied;
    const pdf = staffPdfBytes(data.base64);
    if (!pdf.ok) return pdf;
    const admin = await docsBucket();
    const path = `${data.userId}/${staffPdfName(data.fileName)}`;
    const { error } = await admin.storage.from(STAFF_BUCKET).upload(path, pdf.bytes, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, name: staffPdfName(data.fileName) };
  });

export const openStaffDocument = createServerFn({ method: "POST" })
  .validator((input: { actorRole: RoleType; userId: string; fileName: string }) => input)
  .handler(async ({ data }) => {
    const denied = ownerGate(data.actorRole);
    if (denied) return denied;
    // Private bucket only — never getPublicUrl; short-lived signed URL for owner.
    const admin = await docsBucket();
    const { data: signed, error } = await admin.storage
      .from(STAFF_BUCKET)
      .createSignedUrl(`${data.userId}/${staffPdfName(data.fileName)}`, 600);
    if (error || !signed?.signedUrl) {
      return { ok: false as const, error: error?.message || "Could not open the PDF." };
    }
    return { ok: true as const, url: signed.signedUrl };
  });
